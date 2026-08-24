#!/usr/bin/env node

/**
 * scripts/policyAiSummaries.js(사람이 손으로 채워넣는 데이터)를 읽어서 Supabase의
 * public.policy_ai_summaries 테이블(supabase/policy_ai_summaries.sql)에 upsert하는 스크립트.
 * scripts/syncYouthPolicies.js와 달리 외부 API를 안 부르고, 이 저장소 안의 데이터 파일만 읽음.
 *
 * 실행: node --env-file=.env scripts/syncPolicyAiSummaries.js
 *
 * 필요한 .env 값:
 *  - EXPO_PUBLIC_SUPABASE_URL   이미 앱이 쓰는 값 그대로 재사용
 *  - SUPABASE_SERVICE_ROLE_KEY  RLS를 우회해서 쓰기 위한 관리자급 키(서버 전용)
 */

const { createClient } = require('@supabase/supabase-js');
const summaries = require('./policyAiSummaries');

async function main() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 .env에 없음');
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // policies는 동기화 기간 창(scripts/syncYouthPolicies.js)이 바뀔 때마다 오래된 행이
  // 정리(delete)될 수 있는데, 그 정책의 AI 요약이 이미 여기 이 파일에 있으면 policy_id 외래키가
  // 깨져서 upsert 전체가 실패했었음(2026-08-24 발견 — 한 번에 61건을 upsert하다가 이미 삭제된
  // 정책 6건 때문에 나머지 55건까지 통째로 실패함). 그래서 먼저 실제로 존재하는 policy_id만
  // 걸러내고, 존재하지 않는 건 upsert 대상에서 빼고 경고만 띄움(파일 자체는 그대로 둬도 안전).
  const { data: existingPolicies, error: fetchError } = await supabase.from('policies').select('id');
  if (fetchError) {
    throw new Error(`policies 조회 실패: ${fetchError.message}`);
  }
  const existingIds = new Set(existingPolicies.map((p) => p.id));

  const validSummaries = summaries.filter((s) => existingIds.has(s.policyId));
  const orphaned = summaries.filter((s) => !existingIds.has(s.policyId));
  if (orphaned.length > 0) {
    console.log(
      `  주의: ${orphaned.length}건은 policies 테이블에서 이미 사라진 정책이라 건너뜀 — ${orphaned
        .map((s) => s.policyId)
        .join(', ')}`
    );
  }

  // rolling_detail/final_apply_date(2026-08-24 추가 — supabase/policy_ai_summaries.sql의
  // alter table 부분을 먼저 실행해야 실제로 쓰임)는 값이 있는 항목에만 조건부로 넣음 — 이 두
  // 컬럼을 하나도 안 쓰는 동안엔 upsert 요청 자체에 아예 안 나타나서, 마이그레이션을 아직
  // 안 돌린 상태에서도(=DB에 이 컬럼이 없어도) 기존 7개 컬럼은 계속 정상적으로 동기화됨.
  // 마이그레이션 전에 값 있는 항목을 넣고 돌리면 "컬럼 없음" 에러로 전체 upsert가 실패하니,
  // rollingDetail/finalApplyDate를 채우기 시작했다면 그 전에 SQL을 먼저 실행해야 함.
  const rows = validSummaries.map((s) => ({
    policy_id: s.policyId,
    summary_intro: s.summaryIntro,
    summary_support: s.summarySupport,
    summary_apply: s.summaryApply,
    target_detail: s.targetDetail,
    support_detail: s.supportDetail,
    apply_method_detail: s.applyMethodDetail,
    documents_detail: s.documentsDetail,
    ...(s.rollingDetail !== undefined ? { rolling_detail: s.rollingDetail } : {}),
    ...(s.finalApplyDate !== undefined ? { final_apply_date: s.finalApplyDate } : {}),
  }));

  console.log(`policy_ai_summaries에 ${rows.length}건 upsert 중...`);
  const { error } = await supabase.from('policy_ai_summaries').upsert(rows, { onConflict: 'policy_id' });
  if (error) {
    throw new Error(`upsert 실패: ${error.message}`);
  }
  console.log('완료!');
}

main().catch((err) => {
  console.error('실패:', err.message);
  process.exit(1);
});
