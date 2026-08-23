#!/usr/bin/env node

/**
 * 온통청년(youthcenter.go.kr) Open API에서 청년정책 목록을 통째로 긁어와서 Supabase의
 * public.policies 테이블(supabase/policies.sql)에 upsert하는 서버 전용 동기화 스크립트.
 *
 * 실행: node --env-file=.env scripts/syncYouthPolicies.js
 * (Node 20.6+엔 --env-file 플래그가 내장돼있어서 dotenv 패키지 없이 .env를 바로 읽을 수 있음)
 *
 * 필요한 .env 값(.env.example 참고):
 *  - YOUTHCENTER_API_KEY      온통청년 발급 키(서버 전용, EXPO_PUBLIC_ 접두사 절대 금지)
 *  - EXPO_PUBLIC_SUPABASE_URL 이미 앱이 쓰는 값 그대로 재사용
 *  - SUPABASE_SERVICE_ROLE_KEY  RLS를 우회해서 쓰기 위한 관리자급 키(서버 전용)
 *
 * 엔드포인트는 온통청년 공식 문서에 있던 옛날 경로(/opi/youthPlcyList.do)가 아니라
 * /go/ythip/getPlcy임 — 2026-08-23에 실제로 동작하는 걸 확인한 값. 자세한 배경은
 * 메모리(youthcenter-api-key-renewal) 참고.
 */

const { createClient } = require('@supabase/supabase-js');

const API_BASE = 'https://www.youthcenter.go.kr/go/ythip/getPlcy';
const PAGE_SIZE = 100;
// 온통청년 서버에 페이지 요청을 너무 빨리 연속으로 쏘지 않으려고 요청 사이에 살짝 간격을 둠
const REQUEST_DELAY_MS = 350;
// Supabase upsert 1회에 너무 많은 row를 한꺼번에 보내면 타임아웃/페이로드 문제가 생길 수 있어서 나눠서 보냄
const UPSERT_CHUNK_SIZE = 300;

// 이 앱의 카테고리 정의(constants/moa-colors.ts)와 항상 같이 맞춰야 함 — 저기서 카테고리가
// 바뀌면 여기도 같이 고칠 것. TS 파일을 이 CommonJS 스크립트에서 바로 import하기 번거로워서
// 값만 그대로 복제해둠(신뢰 원본은 constants/moa-colors.ts)
const CATEGORY_LABEL = {
  housing: '주거',
  money: '자산',
  job: '취업',
  edu: '교육',
  welfare: '복지',
  participation: '참여',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 온통청년 대분류(lclsfNm)/중분류(mclsfNm) 텍스트를 우리 6개 카테고리로 매핑함.
//
// participation("참여")은 2026-08-23에 추가됨 — 처음엔 "참여･기반"(청년참여활동/정책인프라구축/
// 국제교류/권익보호 등, 300건 이상)을 대응 카테고리가 없어서 전부 welfare로 몰아넣었는데, 그러니
// 복지 칩이 지나치게 커지고 분류도 부정확해져서(참여 활동 모집을 "복지"라고 부르는 셈) 사용자
// 요청으로 별도 카테고리로 분리함(constants/moa-colors.ts도 같이 고침).
//
// 2026-08-23 실측 확인: 온통청년 중분류엔 "자산형성" 같은 항목이 아예 없고, 가장 가까운 게
// "취약계층 및 금융지원"인데 실제로 열어보니(mclsfNm 정확히 일치하는 74건 표본) 거기 담긴 건
// 학자금대출이자지원/재무상담/보험/공제처럼 복지 성격이 대부분이고, 진짜 저축·자산형성 상품
// (청년내일저축계좌 등)은 15%(11/74)뿐이었음. 그래서 "취약계층 및 금융지원"은 기본 welfare로
// 보내고, 대신 제목/설명에 자산형성 키워드가 있는 건 대/중분류가 뭐든 money로 끌어옴
// (아래 applyAssetKeywordOverride) — 공식 분류보다 실제 내용을 우선시함.
function mapCategory(lclsfNm) {
  const l = (lclsfNm || '').trim();
  if (l.includes('일자리')) return 'job';
  if (l.includes('교육')) return 'edu';
  if (l.includes('주거')) return 'housing';
  if (l.includes('참여')) return 'participation';
  return 'welfare';
}

const ASSET_KEYWORD_RE = /저축|적금|자산형성|도약계좌|내일저축|재형저축|희망디딤돌|희망사다리\s?통장|13\(?일\+?삶\)?통장/;

// 공식 대/중분류와 무관하게, 제목/설명에 진짜 저축·자산형성 상품 키워드가 있으면 money로 강제 지정
function applyAssetKeywordOverride(categoryId, title, detail) {
  if (ASSET_KEYWORD_RE.test(title || '') || ASSET_KEYWORD_RE.test(detail || '')) {
    return 'money';
  }
  return categoryId;
}

// 온통청년 날짜 필드에 '00010101'(연도 0001) · '29991231'(연도 2999) 같은 사실상 "값 없음"을
// 뜻하는 더미 날짜가 실제로 섞여있는 걸 실측으로 확인함(자릿수는 맞아서 정규식만으론 못 거름) —
// 이 앱이 다루는 정책 데이터의 현실적인 연도 범위로 한 번 더 검증해서, 범위 밖이면 파싱 실패로
// 취급함(→ 호출부에서 상시모집으로 폴백).
const MIN_PLAUSIBLE_YEAR = 2015;
const MAX_PLAUSIBLE_YEAR = 2035;

// 'YYYYMMDD'(공백 포함 가능) -> 'YYYY-MM-DD'. 형식이 아니거나 연도가 비현실적이면 null.
function parseYmd(raw) {
  if (!raw) return null;
  const t = String(raw).trim();
  if (!/^\d{8}$/.test(t)) return null;
  const year = Number(t.slice(0, 4));
  if (year < MIN_PLAUSIBLE_YEAR || year > MAX_PLAUSIBLE_YEAR) return null;
  return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`;
}

// 'YYYYMMDD ~ YYYYMMDD' 형태의 aplyYmd 파싱. 하나라도 실패하면 통째로 null(호출부에서
// bizPrdBgngYmd/EndYmd로 한 번 더 시도함).
function parseAplyYmd(aplyYmd) {
  if (!aplyYmd) return null;
  const parts = String(aplyYmd).split('~').map((s) => s.trim());
  if (parts.length !== 2) return null;
  const start = parseYmd(parts[0]);
  const end = parseYmd(parts[1]);
  if (!start || !end) return null;
  return { start, end };
}

// 신청 기간(startDate/deadlineDate) 결정 — aplyYmd 우선, 없으면 bizPrdBgngYmd/EndYmd로 대체
// 시도. 그래도 없거나(연중/상시모집) 앞뒤가 뒤집혀있으면(데이터 이상) is_rolling=true로 표시하고
// 날짜는 null로 둠 — 캘린더엔 안 찍히지만 목록에서는 "상시모집" 배지로 계속 보이게 함(app 쪽에서 처리).
function resolveDates(item) {
  let start = null;
  let end = null;

  const fromAplyYmd = parseAplyYmd(item.aplyYmd);
  if (fromAplyYmd) {
    ({ start, end } = fromAplyYmd);
  } else {
    const bStart = parseYmd(item.bizPrdBgngYmd);
    const bEnd = parseYmd(item.bizPrdEndYmd);
    if (bStart && bEnd) {
      start = bStart;
      end = bEnd;
    }
  }

  if (start && end && end < start) {
    start = null;
    end = null;
  }

  return { startDate: start, deadlineDate: end, isRolling: !start || !end };
}

// 지역 조건 추정(2026-08-23 추가, 같은 날 두 번 더 보강) — 1차로 주관기관명(sprvsnInstCdNm)에
// 시/도 축약형/정식명칭이 들어있는지로 추정함 — "산림청"/"중소벤처기업부" 같은 중앙정부 부처는
// 시/도 이름이 안 들어있어서 자연스럽게 "지역 제한 없음"으로 처리되고, "부산광역시 바이오헬스과"
// 처럼 지자체가 주관이면 그 지역으로 잡힘. 값은 축약형이 아니라 정식 시/도 명칭으로 저장함 —
// lib/matching.ts의 normalizeRegion()이 "전라남도"→"전라남"처럼 원래 명칭 기준으로 접미사를
// 떼기 때문에, 축약형 "전남"을 그대로 넣으면 "전라남"과 문자열이 안 맞아서 매칭이 깨짐.
//
// "전남광주통합특별시" — 처음엔 우리 지역 목록에 없는 지자체명이라 "두 지역이 합쳐진 것처럼
// 보이는 이름" 정도로만 취급했었는데, 실제로 확인해보니 진짜로 광주광역시+전라남도가 통합된
// 현재(2026년 기준) 정식 광역자치단체명임(위키백과로 확인) — 온통청년 데이터의 관련 정책
// 94건이 전부 org_name에 이 이름을 정확히 그대로 쓰고 있었음. 그래서 별도 항목으로 추가하고,
// 기존 "광주"/"전남" 약칭 체크보다 먼저 검사하게 앞에 둠(안 그러면 "전남광주통합특별시"라는
// 토큰이 "광주" 약칭에 먼저 걸려서 옛 지역명인 "광주광역시"로 잘못 잡힘).
const PROVINCE_ABBR_TO_FULL = {
  전남광주통합: '전남광주통합특별시',
  서울: '서울특별시',
  부산: '부산광역시',
  대구: '대구광역시',
  인천: '인천광역시',
  광주: '광주광역시',
  대전: '대전광역시',
  울산: '울산광역시',
  세종: '세종특별자치시',
  경기: '경기도',
  강원: '강원특별자치도',
  충북: '충청북도',
  충남: '충청남도',
  전북: '전북특별자치도',
  전남: '전라남도',
  경북: '경상북도',
  경남: '경상남도',
  제주: '제주특별자치도',
};

// "OO시/군/구"처럼 도(道) 이름 바로 다음에 오는 관할 시/군/구 단위 — 1~3글자 + 시/군/구.
// (예: "평택시", "예천군", "해운대구". "정책과"/"경제국"처럼 부서명은 시/군/구로 끝나지 않아 안 걸림)
// 처음엔 2~3글자로 뒀었는데, 광역시 자치구 중엔 "동구"/"중구"/"남구"/"북구"/"서구"처럼 1글자+구인
// 경우가 흔해서(부산/대구/인천/광주/대전/울산 전부 "동구"가 있음) "울산 동구 청년의 날"처럼 시/도
// 바로 다음이 이런 1글자 구인 경우를 놓치고 있었음(2026-08-23 사용자가 발견) — 1글자까지 허용함.
const CITY_UNIT_RE = /^[가-힣]{1,3}(시|군|구)$/;

// zipCd(법정동 코드) 앞 2자리 → 정식 시/도 명칭. org_name에 지역이 안 드러나는 정책(부서명만
// 있는 경우, 예: "일자리경제과")을 위한 2차 보강 수단(2026-08-23 추가) — 사용자가 "아산시
// 쉼표청년 지원사업"(org_name: "일자리경제과", 지역 정보 전무)이 지역 제한 없이 신청 가능하다고
// 잘못 뜨는 걸 제보해서 원인 조사하다가, 온통청년이 정책마다 zipCd(적용 법정동 코드, 콤마로 여러
// 개)를 이미 내려주고 있다는 걸 활용하기로 함 — "아산시"는 zipCd 44200, "홍성"은 44800처럼 실제
// 코드가 정확히 들어있음.
// 코드값은 문서화된 표를 그대로 베끼지 않고, 이미 org_name으로 확실하게 지역이 잡힌 정책들의
// zipCd를 역으로 모아서 실측 검증함(강원/전북이 특별자치도 지정 이후 zipCd가 42→51, 45→52로
// 바뀌어 있었고, 광주+전남 통합 이후엔 옛 29/46 대신 새 "12"를 쓰고 있는 등 최신 상태와 다른
// 문서가 많아서 실측이 안전함).
const PROVINCE_PREFIX_TO_FULL = {
  11: '서울특별시',
  26: '부산광역시',
  27: '대구광역시',
  28: '인천광역시',
  30: '대전광역시',
  31: '울산광역시',
  36: '세종특별자치시',
  41: '경기도',
  43: '충청북도',
  44: '충청남도',
  47: '경상북도',
  48: '경상남도',
  50: '제주특별자치도',
  51: '강원특별자치도', // 강원특별자치도 출범(2023) 이후 코드
  52: '전북특별자치도', // 전북특별자치도 출범(2024) 이후 코드
  12: '전남광주통합특별시', // 광주+전남 통합 이후 코드(옛 29=광주/46=전남 대신)
};

function resolveRegionFromZipCd(zipCd) {
  const codes = (zipCd || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (codes.length === 0) return undefined;
  const provinces = new Set(
    codes.map((c) => PROVINCE_PREFIX_TO_FULL[c.slice(0, 2)]).filter(Boolean)
  );
  // 코드가 여러 개(한 도 안의 여러 시/군)여도 전부 같은 시/도 소속이면 그 시/도로 확정함.
  // 서로 다른 시/도가 섞여 있으면(전국/광역 지원사업) 특정 지역으로 단정할 수 없으니
  // "지역 제한 없음"으로 처리함 — 잘못 좁혀서 엉뚱한 사람을 걸러내는 것보단 나음.
  if (provinces.size === 1) return [...provinces][0];
  return undefined;
}

// 텍스트를 토큰으로 쪼개서 "시/도 이름(약칭/정식 둘 다) → 바로 다음 토큰이 시/군/구 단위면 그걸
// 우선 사용" 패턴을 찾음. org_name과 title 둘 다 이 패턴을 쓸 수 있어서 공통 함수로 뺌
// (2026-08-23, title 스캔 추가하면서 분리).
function findProvinceInTokens(tokens, startIndex) {
  for (let i = startIndex; i < tokens.length; i++) {
    const token = tokens[i];
    for (const [abbr, full] of Object.entries(PROVINCE_ABBR_TO_FULL)) {
      // 경상북도/경상남도/충청북도/충청남도/전라북도/전라남도는 정식 명칭에 "라"/"청"/"상"이
      // 끼어 있어서 약칭(경북 등)이 정식 명칭의 부분 문자열이 아님(예: "경상북도"에 "경북"이
      // 안 들어있음) — 약칭/정식 명칭 둘 다 검사함.
      if (!token.includes(abbr) && !token.includes(full)) continue;
      // 도 이름 바로 다음 토큰이 "평택시"처럼 더 구체적인 시/군/구 단위면 그걸 우선 씀.
      // 도 단위(예: "경기도")만 저장하면 그 도의 다른 시에 사는 사람도 매칭돼버림 — 실제로
      // "경기도 평택시 기획항만경제실"이 주관하는, 평택 "관내" 거주자만 대상인 정책이
      // 도 전체(경기도) 거주자에게 신청 가능하다고 잘못 표시되는 걸 사용자가 발견함(2026-08-23).
      const next = tokens[i + 1];
      if (next && CITY_UNIT_RE.test(next) && next !== full) {
        return { keyword: next, province: full };
      }
      return { keyword: full, province: full };
    }
  }
  return {};
}

// regionKeyword(자격 판정용, 시/군/구까지 구체화될 수 있음)와 regionProvince(검색 화면 지역
// 필터 칩용, 항상 17개 시/도 중 하나)를 한 번에 계산함. 3단계로 시도함:
// 1) 주관기관명(가장 신뢰도 높음 — 실제 주관 주체) 2) zipCd(법정동 코드) 3) 제목 맨 앞 단어
// (2026-08-23 추가 — 아래 참고).
function resolveRegion(item) {
  const orgName = (item.sprvsnInstCdNm || item.operInstCdNm || '').trim();
  if (orgName) {
    const result = findProvinceInTokens(orgName.split(/\s+/), 0);
    if (result.keyword) return result;
  }

  // org_name으로 못 찾았으면 zipCd로 한 번 더 시도함 — "아산시 쉼표청년 지원사업"/"홍성 청년의
  // 날" 등 org_name이 "일자리경제과"/"경제정책과"처럼 부서명뿐이라 지역이 아예 안 잡히던
  // 정책들이 이걸로 잡힘. 시/군/구 단위까지는 못 잡고(정확한 법정동 코드표가 없어서) 시/도
  // 단위까지만 잡지만, 지역 제한을 아예 놓치는 것보단 훨씬 나음.
  const zipProvince = resolveRegionFromZipCd(item.zipCd);
  if (zipProvince) {
    return { keyword: zipProvince, province: zipProvince };
  }

  // zipCd도 못 잡았으면(코드가 아예 없거나, "울산 동구 청년의 날 기념행사 운영"처럼 원본 데이터의
  // zipCd 자체가 전국 코드 목록으로 잘못 채워져 있는 경우 — 실제로 발견함, 2026-08-23) 제목
  // 전체에서 시/도 이름을 찾음(처음엔 맨 앞 1~2단어만 봤는데, 지역명이 제목 중간에 나오는
  // 경우도 있어서 사용자 요청으로 전체 스캔으로 넓힘, 2026-08-23). 시/군/구 단위 이름
  // (예: "아산", "홍성")까지 전체 스캔하면 흔한 단어와 겹칠 위험이 커서(예: "영양"=nutrition,
  // "장수"=longevity도 실제 군 이름) 그건 여전히 안 하고, 상대적으로 안전한 17개 시/도 이름
  // (서울/부산/울산 등)만 제목 어디에 있든 인정함 — org명/zipCd 둘 다 실패했을 때만 쓰는
  // 마지막 수단이라, 아주 드물게 본문과 무관한 지역이 우연히 언급돼 오판할 여지는 있지만(예:
  // "OO시 청년 서울여행 지원" 같은 제목이면 서울로 잘못 잡힐 수 있음), 지금처럼 지역 조건을
  // 완전히 놓치는 것보다는 낫다고 판단함.
  const titleResult = findProvinceInTokens((item.plcyNm || '').trim().split(/\s+/), 0);
  if (titleResult.keyword) return titleResult;

  return {};
}

// schoolCd(학력요건)/jobCd(취업요건)/sbizCd(특화요건) — 온통청년 공식 코드정의서
// (youthcenter.go.kr 오픈API 소개 페이지의 "API코드정보.xlsx", 2026-08-23 다운받아 실측 확인)
// 기준값. 이 세 코드가 있다는 것 자체는 진작부터 raw에 담겨 있었는데, Requirements엔 연령/소득/
// 무주택/지역 4개만 있어서 프로필에 대학생 여부/취업준비생 여부 필드가 있어도 실제 판정엔
// 전혀 안 쓰이고 있었음 — 사용자가 "대학생 대상 공고인데 나(비대학생)한테 지원 가능이라고 뜬다"고
// 지적해서 발견함.
const SCHOOL_UNIV_ENROLLED = '0049005'; // 대학 재학
const JOB_UNEMPLOYED = '0013003'; // 미취업자
const SBIZ_BASIC_LIVELIHOOD = '0014003'; // 기초생활수급자
const SBIZ_SINGLE_PARENT = '0014004'; // 한부모가정

function parseCodeList(raw) {
  return (raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// schoolCd/jobCd는 콤마로 여러 값이 같이 올 수 있는데("대학 재학,석·박사"처럼 OR 조건인 경우 등),
// 우리 프로필엔 그 조합을 정확히 표현할 필드가 없어서, "이 코드 하나만 단독으로 걸린 경우"일 때만
// 확실한 신호로 보고 반영함 — 여러 값이 섞여 있으면 어설프게 판단하느니 조건 없음(지원 가능)으로
// 안전하게 둠.
function resolveStatusRequirements(item) {
  const requirements = {};

  const schoolCodes = parseCodeList(item.schoolCd);
  if (schoolCodes.length === 1 && schoolCodes[0] === SCHOOL_UNIV_ENROLLED) {
    requirements.requiresUniversityStudent = true;
  }

  const jobCodes = parseCodeList(item.jobCd);
  if (jobCodes.length === 1 && jobCodes[0] === JOB_UNEMPLOYED) {
    requirements.requiresJobSeeker = true;
  }

  // sbizCd(특화요건)는 "이 대상군도 포함"에 가까운 태그라 다른 값과 같이 와도(예: 여성+한부모가정)
  // 그 자체로 유효한 신호라서 단독 여부와 무관하게 포함 여부만 봄.
  const sbizCodes = parseCodeList(item.sbizCd);
  if (sbizCodes.includes(SBIZ_BASIC_LIVELIHOOD)) {
    requirements.requiresBasicLivelihoodRecipient = true;
  }
  if (sbizCodes.includes(SBIZ_SINGLE_PARENT)) {
    requirements.requiresSingleParentFamily = true;
  }

  return requirements;
}

// 소득 조건(2026-08-23 추가, earnCndSeCd/earnMinAmt/earnMaxAmt) — 처음엔 "금액 단위가 정책마다
// 제각각이라 잘못 해석할 위험이 크다"는 이유로 아예 스킵했었는데, 사용자가 그래도 넣어달라고
// 요청해서 실제 값들을 원문 설명(addAplyQlfcCndCn/plcySprtCn)과 대조해서 규칙을 만듦.
// earnCndSeCd === '0043002'(연소득 조건 있음)인 9건을 전수 확인한 결과:
//   - earnMaxAmt가 그대로 "만원" 단위인 경우(5000→5,000만원, 3692→3,692만원 등)가 대부분이었고
//   - 딱 1건(청년부부 주거환경 개선사업)만 "43056240"처럼 원(KRW) 단위로 들어있었음(만원으로 읽으면
//     430억원이 돼서 말이 안 됨 — 10000으로 나누면 4,306만원 정도로 현실적인 값이 됨)
// → 100만(RAW_WON_THRESHOLD) 이상이면 원 단위로 보고 10000으로 나눠서 만원으로 통일함. 실제
// 연소득 상한이 "만원 단위로 100만"(=100억원)일 수는 없으니 이 문턱값으로 두 단위를 안전하게 구분함.
//
// 개인 소득인지 가구(부부합산) 소득인지는 원본에 별도 필드가 없어서, 설명 텍스트에 "부부합산"
// 같은 표현이 있는지로 구분함 — 9건 중 "청년 신혼부부 월세지원" 계열 2건만 "연소득(부부합산)"이라고
// 명시돼 있었고 나머지는 "직전년도 신고소득이 있는 자"/"근로소득 청년"처럼 개인 소득으로 읽혔음.
// earnMinAmt는 안 씀 — 9건 중 1건(전세보증금반환보증, 청년/청년외/신혼부부별로 5천~7.5천만원 등
// 구간이 다름)만 0이 아니었는데, 우리 시스템엔 "하한" 개념이 없어서(신청 자격 상 하한이 있는
// 사업은 극히 드묾) 상한(earnMaxAmt)만 반영함.
const EARN_COND_ANNUAL_INCOME = '0043002'; // 연소득 조건 있음(0043001=무관, 0043003=기타)
const HOUSEHOLD_INCOME_HINT_RE = /부부합산|가구\s?소득|세대\s?소득/;
const RAW_WON_THRESHOLD = 1_000_000;

function normalizeAnnualIncomeManwon(rawAmount) {
  const n = parseInt(rawAmount, 10);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n >= RAW_WON_THRESHOLD ? Math.round(n / 10000) : n;
}

function resolveIncomeRequirement(item) {
  const requirements = {};
  if (item.earnCndSeCd !== EARN_COND_ANNUAL_INCOME) return requirements;
  const capManwon = normalizeAnnualIncomeManwon(item.earnMaxAmt);
  if (capManwon == null) return requirements;

  const text = `${item.addAplyQlfcCndCn || ''} ${item.plcySprtCn || ''}`;
  if (HOUSEHOLD_INCOME_HINT_RE.test(text)) {
    requirements.maxHouseholdAnnualIncome = capManwon;
  } else {
    requirements.maxPersonalAnnualIncome = capManwon;
  }
  return requirements;
}

function resolveRequirements(item) {
  const requirements = {};
  const maxAge = parseInt(item.sprtTrgtMaxAge, 10);
  if (item.sprtTrgtAgeLmtYn === 'Y' && Number.isFinite(maxAge) && maxAge > 0) {
    requirements.maxAge = maxAge;
  }
  const { keyword: regionKeyword, province: regionProvince } = resolveRegion(item);
  if (regionKeyword) {
    requirements.regionKeyword = regionKeyword;
  }
  if (regionProvince) {
    requirements.regionProvince = regionProvince;
  }
  Object.assign(requirements, resolveStatusRequirements(item));
  Object.assign(requirements, resolveIncomeRequirement(item));
  return requirements;
}

// 온통청년 원문 URL 필드에 "https://" 없이 도메인만 적혀있는 경우가 있음(예: "www.btp.or.kr").
// 앱에서 그대로 Linking.openURL()에 넘기면 절대경로가 아니라 상대경로로 오인해서
// "Unable to open URL"/이상한 file:// 에러가 남(2026-08-23 사용자가 실제 크래시로 발견).
// 그리고 아예 URL이 아니라 "전화문의"처럼 안내 문구가 들어있는 경우도 있어서, 도메인처럼 생긴
// 값만 https://를 붙여 살리고 나머진 버림(잘못된 링크를 보여주는 것보단 아예 안 보여주는 게 나음).
const BARE_DOMAIN_RE = /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(\/.*)?$/i;

function normalizeUrl(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (BARE_DOMAIN_RE.test(trimmed)) return `https://${trimmed}`;
  return null;
}

function resolveLinks(item) {
  const links = [];
  const apply = normalizeUrl(item.aplyUrlAddr);
  const ref1 = normalizeUrl(item.refUrlAddr1);
  const ref2 = normalizeUrl(item.refUrlAddr2);
  if (apply) links.push({ label: '신청 바로가기', url: apply });
  if (ref1 && ref1 !== apply) links.push({ label: '관련 링크', url: ref1 });
  if (ref2 && ref2 !== apply && ref2 !== ref1) links.push({ label: '관련 링크 2', url: ref2 });
  return links;
}

function mapItemToRow(item) {
  const title = (item.plcyNm || '').trim() || '(제목 없음)';
  const detail = (item.plcyExplnCn || '').trim();
  const categoryId = applyAssetKeywordOverride(mapCategory(item.lclsfNm), title, detail);
  const { startDate, deadlineDate, isRolling } = resolveDates(item);
  const orgName = (item.sprvsnInstCdNm || '').trim() || null;
  const metaParts = [item.mclsfNm && item.mclsfNm.trim(), orgName].filter(Boolean);

  return {
    id: item.plcyNo,
    category_id: categoryId,
    category: CATEGORY_LABEL[categoryId],
    title,
    meta: metaParts.join(' · '),
    detail,
    org_name: orgName,
    start_date: startDate,
    deadline_date: deadlineDate,
    is_rolling: isRolling,
    requirements: resolveRequirements(item),
    perks: [],
    links: resolveLinks(item),
    raw: item,
    synced_at: new Date().toISOString(),
  };
}

// 2,728건을 다 저장하면 너무 많아서(사용자 요청), 동기화 자체를 이 기간 안에 드는 것만 저장하게
// 걸러냄 — data/deadlines.ts가 예전에 EXPIRY_WINDOW_DAYS로 "마감 14일 지난 건 화면에서 숨김"
// 하던 것과 비슷한 개념인데, 소스가 Supabase로 옮겨가면서 "저장 자체를 안 함"으로 바뀜:
//  - 시작일이 오늘로부터 1달 이내(이미 시작한 것도 포함, 즉 start_date <= 오늘+1달)
//  - 마감일이 2주 이내 지난 것까지(deadline_date >= 오늘-2주)
//  - 상시모집(is_rolling)은 **제외**함 — 처음엔 "무조건 포함"이었는데, 실제로 동기화해보니 전체
//    1,248건 중 740건(59%)이 상시모집이라 날짜 필터를 아무리 좁혀도 "너무 많다"는 문제가 거의
//    안 줄어드는 게 확인돼서(2026-08-23) 사용자 요청으로 뺌. 스키마의 is_rolling 필드/로직 자체는
//    남겨둠 — 나중에 다시 포함하고 싶어지면 아래 isWithinSyncWindow 한 줄만 되돌리면 됨.
//  - **단, money(자산) 카테고리는 상시모집 제외 규칙에서 예외**임(2026-08-23) — 자산형성 상품은
//    연 1~2회만 짧게 신청받는 특성이라 날짜 창을 아무리 잘 잡아도 대부분 "이미 마감" 아니면
//    "상시모집(=계속 가입 가능한 상품)"뿐이라, 상시모집까지 빼면 거의 안 남게 됨(48건 중 4건).
//    반면 청년주택드림청약통장처럼 "상시모집"인 자산상품은 실질적으로 항상 가입 가능한 상태라
//    계속 보여주는 게 사용자에게 더 유용하다고 판단함.
// 재동기화(npm run sync-policies)를 다시 돌릴 때마다 이 기준으로 다시 걸러지므로, 시간이
// 지나면서 창 밖으로 나간 건 자동으로 정리되고(main()의 delete 단계) 새로 창 안에 들어온 건
// 새로 채워짐 — 그래서 이 스크립트를 주기적으로 재실행하는 게 중요함(아직 자동 스케줄은 없음,
// 지금은 수동 실행).
const START_WINDOW_MONTHS_AHEAD = 1;
const CLOSED_WINDOW_DAYS_BEHIND = 14;

function toIsoDate(d) {
  return d.toISOString().slice(0, 10);
}

function computeWindowBounds() {
  const maxStart = new Date();
  maxStart.setMonth(maxStart.getMonth() + START_WINDOW_MONTHS_AHEAD);
  const minDeadline = new Date();
  minDeadline.setDate(minDeadline.getDate() - CLOSED_WINDOW_DAYS_BEHIND);
  return { maxStartDate: toIsoDate(maxStart), minDeadlineDate: toIsoDate(minDeadline) };
}

function isWithinSyncWindow(row, bounds) {
  if (row.is_rolling) return row.category_id === 'money'; // money만 상시모집 제외 규칙에서 예외(위 주석 참고)
  // is_rolling이 false면 resolveDates()에 의해 start_date/deadline_date 둘 다 값이 있음이 보장됨
  return row.start_date <= bounds.maxStartDate && row.deadline_date >= bounds.minDeadlineDate;
}

const MAX_RETRIES_PER_PAGE = 5;

// 페이지 하나를 재시도 포함해서 가져옴. 온통청년 서버가 가끔(요청을 좀 빨리 여러 번 보내면
// 특히) HTML 에러 페이지를 주거나, JSON은 맞는데 totCount가 갑자기 0으로 나오는 등 일시적으로
// 이상한 응답을 주는 걸 실측으로 확인해서(2026-08-23) 지수 백오프로 재시도하게 함.
// knownTotCount가 이미 있는데 이번 응답의 totCount가 그거랑 다르면(그것도 일시적 오류 신호로
// 보고) 재시도함 — 진짜 totCount가 동기화 도중 바뀔 일은 거의 없다고 가정.
async function fetchPageWithRetry(apiKey, pageNum, knownTotCount) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES_PER_PAGE; attempt++) {
    try {
      const url = `${API_BASE}?apiKeyNm=${encodeURIComponent(apiKey)}&pageNum=${pageNum}&pageSize=${PAGE_SIZE}&rtnType=json`;
      const res = await fetch(url);
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        throw new Error(`JSON 아님 (응답 앞부분: ${text.slice(0, 120).replace(/\s+/g, ' ')})`);
      }
      if (body.resultCode !== 200) {
        throw new Error(`resultCode ${body.resultCode} ${body.resultMessage}`);
      }
      const list = body.result?.youthPolicyList ?? [];
      const totCount = body.result?.pagging?.totCount ?? list.length;
      if (knownTotCount != null && totCount !== knownTotCount) {
        throw new Error(`totCount 불일치(기대 ${knownTotCount}, 응답 ${totCount}) — 일시적 오류로 보고 재시도`);
      }
      return { list, totCount };
    } catch (err) {
      lastError = err;
      const backoffMs = 500 * 2 ** (attempt - 1);
      console.log(`  page ${pageNum} 실패(시도 ${attempt}/${MAX_RETRIES_PER_PAGE}): ${err.message} — ${backoffMs}ms 후 재시도`);
      await sleep(backoffMs);
    }
  }
  throw new Error(`page ${pageNum}: ${MAX_RETRIES_PER_PAGE}번 재시도 후에도 실패 — ${lastError.message}`);
}

async function fetchAllPolicies(apiKey) {
  const all = [];
  let pageNum = 1;
  let totCount = null;

  while (totCount == null || (pageNum - 1) * PAGE_SIZE < totCount) {
    const { list, totCount: pageTotCount } = await fetchPageWithRetry(apiKey, pageNum, totCount);
    totCount = pageTotCount;
    all.push(...list);
    console.log(`  page ${pageNum}: +${list.length}건 (누적 ${all.length}/${totCount})`);
    pageNum += 1;
    if ((pageNum - 1) * PAGE_SIZE < totCount) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  return all;
}

async function main() {
  const apiKey = process.env.YOUTHCENTER_API_KEY;
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiKey) throw new Error('YOUTHCENTER_API_KEY가 .env에 없음');
  if (!supabaseUrl) throw new Error('EXPO_PUBLIC_SUPABASE_URL이 .env에 없음');
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY가 .env에 없음');

  console.log('1/4 온통청년 API에서 정책 목록 가져오는 중...');
  const rawItems = await fetchAllPolicies(apiKey);
  console.log(`  총 ${rawItems.length}건 수신 완료`);

  console.log('2/4 앱 스키마로 변환 중...');
  const allRows = rawItems.map(mapItemToRow);

  const bounds = computeWindowBounds();
  console.log(`  동기화 기간 필터: 시작일 <= ${bounds.maxStartDate} (오늘+${START_WINDOW_MONTHS_AHEAD}달) / 마감일 >= ${bounds.minDeadlineDate} (오늘-${CLOSED_WINDOW_DAYS_BEHIND}일) / 상시모집은 제외(money 예외)`);
  const rows = allRows.filter((r) => isWithinSyncWindow(r, bounds));
  const excludedRows = allRows.filter((r) => !isWithinSyncWindow(r, bounds));
  console.log(`  기간 필터 결과: ${rows.length}건 유지 / ${excludedRows.length}건 제외 (원본 ${allRows.length}건)`);

  const rollingCount = rows.filter((r) => r.is_rolling).length;
  const categoryBreakdown = rows.reduce((acc, r) => {
    acc[r.category_id] = (acc[r.category_id] || 0) + 1;
    return acc;
  }, {});
  console.log(`  상시모집(마감일 없음): ${rollingCount}건`);
  console.log('  카테고리 분포:', categoryBreakdown);

  console.log('3/4 Supabase에 upsert 중...');
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  let upserted = 0;
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK_SIZE);
    const { error } = await supabase.from('policies').upsert(chunk, { onConflict: 'id' });
    if (error) {
      throw new Error(`Supabase upsert 실패 (rows ${i}~${i + chunk.length}): ${error.message}`);
    }
    upserted += chunk.length;
    console.log(`  upsert ${upserted}/${rows.length}`);
  }

  // 기간 창 밖으로 벗어난(예: 예전엔 "2달 이내 시작"이었는데 재동기화 시점엔 아닌) 정책을
  // 테이블에서 정리함 — 안 지우면 옛날 데이터가 계속 쌓여있게 됨. excludedRows엔 애초에 한 번도
  // 저장 안 된 것도 섞여있지만, upsert처럼 있으면 지우고 없으면 조용히 넘어가서 상관없음.
  console.log('4/4 기간 밖으로 벗어난 기존 데이터 정리 중...');
  const excludedIds = excludedRows.map((r) => r.id);
  let deleted = 0;
  for (let i = 0; i < excludedIds.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = excludedIds.slice(i, i + UPSERT_CHUNK_SIZE);
    const { error, count } = await supabase
      .from('policies')
      .delete({ count: 'exact' })
      .in('id', chunk);
    if (error) {
      throw new Error(`Supabase delete 실패 (ids ${i}~${i + chunk.length}): ${error.message}`);
    }
    deleted += count ?? 0;
  }
  console.log(`  정리 완료: ${deleted}건 삭제`);

  console.log(`\n완료! policies 테이블에 ${upserted}건 반영함 (기간 밖 ${deleted}건 정리).`);
}

main().catch((err) => {
  console.error('\n동기화 실패:', err.message);
  process.exit(1);
});
