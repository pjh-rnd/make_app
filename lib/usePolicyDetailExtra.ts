import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

// 홈/검색/알림 화면이 공용으로 쓰는 usePolicies()는 정책을 최대 500여 건 한 번에 불러오는
// 목록용 훅이라, 목록 카드엔 안 쓰이는 무거운 필드(raw jsonb 전체 — 정책 하나당 원본 API 응답
// 전부)는 일부러 select에서 뺐음(2026-08-23, 리스트 화면 성능 문제를 이미 겪어봐서 — 자세한 건
// docs/PROGRESS.md 참고). 정책 상세 화면(app/deadline/[id].tsx)에서만 필요한 신청방법/제출서류/
// 상세 지원대상/지원내용 원문은 여기서 그 한 건만 따로 조회함 — 한 건짜리 요청이라 부담 없음.
export type PolicyDetailExtra = {
  orgName: string;
  applyMethod: string | null; // plcyAplyMthdCn — 신청방법
  requiredDocuments: string | null; // sbmsnDcmntCn — 제출서류
  targetDetail: string | null; // addAplyQlfcCndCn — 지원대상 상세 원문
  supportDetailText: string | null; // plcySprtCn — 지원내용 원문(정책 안내 본문/지원혜택 추출에 씀)
};

export function usePolicyDetailExtra(policyId: string | undefined) {
  const [extra, setExtra] = useState<PolicyDetailExtra | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!policyId) {
      setExtra(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('policies')
      .select('org_name, raw')
      .eq('id', policyId)
      .maybeSingle();

    if (error || !data) {
      if (error) console.warn('[usePolicyDetailExtra] 조회 실패:', error.message);
      setExtra(null);
      setLoading(false);
      return;
    }

    const raw = (data.raw ?? {}) as Record<string, unknown>;
    const asText = (v: unknown): string | null =>
      typeof v === 'string' && v.trim() ? v.trim() : null;

    setExtra({
      orgName: (data.org_name as string | null) ?? '',
      applyMethod: asText(raw.plcyAplyMthdCn),
      requiredDocuments: asText(raw.sbmsnDcmntCn),
      targetDetail: asText(raw.addAplyQlfcCndCn),
      supportDetailText: asText(raw.plcySprtCn),
    });
    setLoading(false);
  }, [policyId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { extra, loading, refresh };
}
