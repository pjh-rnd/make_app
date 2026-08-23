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

  const rows = summaries.map((s) => ({
    policy_id: s.policyId,
    summary_intro: s.summaryIntro,
    summary_support: s.summarySupport,
    summary_apply: s.summaryApply,
    target_detail: s.targetDetail,
    support_detail: s.supportDetail,
    apply_method_detail: s.applyMethodDetail,
    documents_detail: s.documentsDetail,
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
