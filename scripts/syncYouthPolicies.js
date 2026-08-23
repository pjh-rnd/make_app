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
const REQUEST_DELAY_MS = 150;
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
// "금융･복지･문화"는 중분류를 봐서 자산 계열이면 money, 아니면 welfare로. "참여･기반"처럼
// 우리 카테고리에 없는 대분류는 전부 welfare로 받아서(catch-all) 정책이 카테고리 매칭
// 실패로 아예 안 보이는 일이 없게 함(사용자가 "연중/모집형도 다 포함해서 어떻게든 보여준다"고
// 명시적으로 요청함 — 같은 원칙을 카테고리 매핑에도 적용).
function mapCategory(lclsfNm, mclsfNm) {
  const l = (lclsfNm || '').trim();
  const m = (mclsfNm || '').trim();
  if (l.includes('일자리')) return 'job';
  if (l.includes('교육')) return 'edu';
  if (l.includes('주거')) return 'housing';
  if (l.includes('금융') || l.includes('복지') || l.includes('문화')) {
    if (/금융|자산|소득|재테크/.test(m)) return 'money';
    return 'welfare';
  }
  return 'welfare';
}

// 'YYYYMMDD'(공백 포함 가능) -> 'YYYY-MM-DD'. 형식이 아니면 null.
function parseYmd(raw) {
  if (!raw) return null;
  const t = String(raw).trim();
  if (!/^\d{8}$/.test(t)) return null;
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
  const categoryId = mapCategory(item.lclsfNm, item.mclsfNm);
  const { startDate, deadlineDate, isRolling } = resolveDates(item);
  const orgName = (item.sprvsnInstCdNm || '').trim() || null;
  const metaParts = [item.mclsfNm && item.mclsfNm.trim(), orgName].filter(Boolean);

  return {
    id: item.plcyNo,
    category_id: categoryId,
    category: CATEGORY_LABEL[categoryId],
    title: (item.plcyNm || '').trim() || '(제목 없음)',
    meta: metaParts.join(' · '),
    detail: (item.plcyExplnCn || '').trim(),
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

async function fetchAllPolicies(apiKey) {
  const all = [];
  let pageNum = 1;
  let totCount = Infinity;

  while ((pageNum - 1) * PAGE_SIZE < totCount) {
    const url = `${API_BASE}?apiKeyNm=${encodeURIComponent(apiKey)}&pageNum=${pageNum}&pageSize=${PAGE_SIZE}&rtnType=json`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`온통청년 API 응답 실패: HTTP ${res.status} (page ${pageNum})`);
    }
    const body = await res.json();
    if (body.resultCode !== 200) {
      throw new Error(`온통청년 API 에러: ${body.resultCode} ${body.resultMessage} (page ${pageNum})`);
    }
    const list = body.result?.youthPolicyList ?? [];
    totCount = body.result?.pagging?.totCount ?? list.length;
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

  console.log('1/3 온통청년 API에서 정책 목록 가져오는 중...');
  const rawItems = await fetchAllPolicies(apiKey);
  console.log(`  총 ${rawItems.length}건 수신 완료`);

  console.log('2/3 앱 스키마로 변환 중...');
  const rows = rawItems.map(mapItemToRow);
  const rollingCount = rows.filter((r) => r.is_rolling).length;
  const categoryBreakdown = rows.reduce((acc, r) => {
    acc[r.category_id] = (acc[r.category_id] || 0) + 1;
    return acc;
  }, {});
  console.log(`  상시모집(마감일 없음): ${rollingCount}건`);
  console.log('  카테고리 분포:', categoryBreakdown);

  console.log('3/3 Supabase에 upsert 중...');
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

  console.log(`\n완료! policies 테이블에 ${upserted}건 반영함.`);
}

main().catch((err) => {
  console.error('\n동기화 실패:', err.message);
  process.exit(1);
});
