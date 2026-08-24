import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

// supabase/policy_ai_summaries.sql로 만든 테이블을 읽는 훅. 이 테이블은
// scripts/syncYouthPolicies.js(자동 동기화)가 절대 안 건드리는, 사람이 정책 원문을 직접 읽고
// 손으로 채워넣는 데이터라(scripts/policyAiSummaries.js 참고) 아직 극히 일부 정책에만 있음 —
// 없는 정책이 훨씬 많은 게 정상이고, 그럴 땐 null을 돌려줘서 상세 화면이 기존 방식(원문 그대로
// 보여주기)으로 자연스럽게 대체함.
export type PolicyAiSummary = {
  summaryIntro: string;
  summarySupport: string;
  summaryApply: string;
  targetDetail: string[];
  supportDetail: string[];
  applyMethodDetail: string[];
  documentsDetail: string[];
  // 연중접수/상시모집 정책의 실제 운영 방식(예: "연 2~3회 나눠서 접수") — 2026-08-24 추가,
  // supabase/policy_ai_summaries.sql의 마이그레이션을 아직 안 돌렸으면 컬럼 자체가 없어서 항상
  // null로 옴(아래 refresh()가 그 경우도 에러 없이 처리함). 대부분 정책엔 아직 없는 게 정상.
  rollingDetail: string | null;
  finalApplyDate: string | null; // YYYY-MM-DD, 못 찾았으면 null
};

const BASE_COLUMNS =
  'summary_intro, summary_support, summary_apply, target_detail, support_detail, apply_method_detail, documents_detail';
const EXTENDED_COLUMNS = `${BASE_COLUMNS}, rolling_detail, final_apply_date`;

export function usePolicyAiSummary(policyId: string | undefined) {
  const [summary, setSummary] = useState<PolicyAiSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!policyId) {
      setSummary(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    // rolling_detail/final_apply_date는 2026-08-24에 추가된 컬럼이라, 마이그레이션(위 SQL 파일의
    // alter table 부분)을 아직 안 돌린 프로젝트에서는 이 컬럼들이 없어서 select 자체가 에러남 —
    // 그러면 기존 7개 컬럼만으로 한 번 더 시도해서, 새 기능 하나 때문에 요약 전체가 안 보이는
    // 일이 없게 함(마이그레이션 전이든 후든 항상 동작).
    let { data, error } = await supabase
      .from('policy_ai_summaries')
      .select(EXTENDED_COLUMNS)
      .eq('policy_id', policyId)
      .maybeSingle();

    if (error) {
      ({ data, error } = await supabase
        .from('policy_ai_summaries')
        .select(BASE_COLUMNS)
        .eq('policy_id', policyId)
        .maybeSingle());
    }

    if (error) {
      // 테이블을 아직 안 만들었거나(supabase/policy_ai_summaries.sql 미실행), 이 정책엔 아직
      // 요약이 없는 경우 — 둘 다 화면이 안 죽고 기존 방식으로 자연스럽게 대체돼야 하므로 경고만 남김
      console.warn('[usePolicyAiSummary] 조회 실패(supabase/policy_ai_summaries.sql 실행 여부 확인):', error.message);
      setSummary(null);
      setLoading(false);
      return;
    }

    if (!data) {
      setSummary(null);
      setLoading(false);
      return;
    }

    setSummary({
      summaryIntro: data.summary_intro,
      summarySupport: data.summary_support,
      summaryApply: data.summary_apply,
      targetDetail: data.target_detail ?? [],
      supportDetail: data.support_detail ?? [],
      applyMethodDetail: data.apply_method_detail ?? [],
      documentsDetail: data.documents_detail ?? [],
      rollingDetail: 'rolling_detail' in data ? (data.rolling_detail ?? null) : null,
      finalApplyDate: 'final_apply_date' in data ? (data.final_apply_date ?? null) : null,
    });
    setLoading(false);
  }, [policyId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { summary, loading, refresh };
}
