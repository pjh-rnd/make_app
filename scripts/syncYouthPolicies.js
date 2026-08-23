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
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 온통청년 대분류(lclsfNm)/중분류(mclsfNm) 텍스트를 우리 5개 카테고리로 매핑함.
// "참여･기반"처럼 우리 카테고리에 없는 대분류는 전부 welfare로 받아서(catch-all) 정책이
// 카테고리 매칭 실패로 아예 안 보이는 일이 없게 함(사용자가 "연중/모집형도 다 포함해서 어떻게든
// 보여준다"고 명시적으로 요청함 — 같은 원칙을 카테고리 매핑에도 적용).
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

// 연령 조건만 비교적 신뢰도 높게 매핑함. 소득 조건(earnCndSeCd/earnMinAmt/earnMaxAmt)은 코드값이라
// 온통청년 공통코드 조회 없이는 "제한없음"인지 실제 금액 조건인지 구분이 안 돼서, 잘못된 조건으로
// 사람들을 거르느니 아예 안 넣는 쪽을 택함(추후 공통코드 조회 API 붙이면 채울 것 — 지금은 스킵).
function resolveRequirements(item) {
  const requirements = {};
  const maxAge = parseInt(item.sprtTrgtMaxAge, 10);
  if (item.sprtTrgtAgeLmtYn === 'Y' && Number.isFinite(maxAge) && maxAge > 0) {
    requirements.maxAge = maxAge;
  }
  return requirements;
}

function resolveLinks(item) {
  const links = [];
  const apply = (item.aplyUrlAddr || '').trim();
  const ref1 = (item.refUrlAddr1 || '').trim();
  const ref2 = (item.refUrlAddr2 || '').trim();
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
//  - 시작일이 오늘로부터 2달 이내(이미 시작한 것도 포함, 즉 start_date <= 오늘+2달)
//  - 마감일이 1달 이내 지난 것까지(deadline_date >= 오늘-1달)
//  - 상시모집(is_rolling)은 무조건 포함
// 재동기화(npm run sync-policies)를 다시 돌릴 때마다 이 기준으로 다시 걸러지므로, 시간이
// 지나면서 창 밖으로 나간 건 자동으로 정리되고(main()의 delete 단계) 새로 창 안에 들어온 건
// 새로 채워짐 — 그래서 이 스크립트를 주기적으로 재실행하는 게 중요함(아직 자동 스케줄은 없음,
// 지금은 수동 실행).
const START_WINDOW_MONTHS_AHEAD = 2;
const CLOSED_WINDOW_MONTHS_BEHIND = 1;

function toIsoDate(d) {
  return d.toISOString().slice(0, 10);
}

function computeWindowBounds() {
  const maxStart = new Date();
  maxStart.setMonth(maxStart.getMonth() + START_WINDOW_MONTHS_AHEAD);
  const minDeadline = new Date();
  minDeadline.setMonth(minDeadline.getMonth() - CLOSED_WINDOW_MONTHS_BEHIND);
  return { maxStartDate: toIsoDate(maxStart), minDeadlineDate: toIsoDate(minDeadline) };
}

function isWithinSyncWindow(row, bounds) {
  if (row.is_rolling) return true;
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
  console.log(`  동기화 기간 필터: 시작일 <= ${bounds.maxStartDate} (오늘+${START_WINDOW_MONTHS_AHEAD}달) / 마감일 >= ${bounds.minDeadlineDate} (오늘-${CLOSED_WINDOW_MONTHS_BEHIND}달) / 상시모집은 무조건 포함`);
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
