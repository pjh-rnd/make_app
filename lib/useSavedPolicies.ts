import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

// 사용자가 "찜"한 정책 id들을 관리하는 훅.
// saved_policies 테이블: user_id + policy_id 조합이 있으면 찜한 것, 없으면 안 한 것.
export function useSavedPolicies(userId: string | undefined) {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setSavedIds(new Set());
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('saved_policies')
      .select('policy_id')
      .eq('user_id', userId);

    if (error) {
      console.warn('[useSavedPolicies] 조회 실패:', error.message);
    } else {
      setSavedIds(new Set((data ?? []).map((row) => row.policy_id)));
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // 찜/찜해제를 반대로 뒤집는 함수. 먼저 화면부터 바꾸고(낙관적 업데이트),
  // 서버 요청이 실패하면 원래대로 되돌림.
  async function toggle(policyId: string) {
    if (!userId) return;
    const wasSaved = savedIds.has(policyId);

    setSavedIds((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(policyId);
      else next.add(policyId);
      return next;
    });

    const { error } = wasSaved
      ? await supabase.from('saved_policies').delete().eq('user_id', userId).eq('policy_id', policyId)
      : await supabase.from('saved_policies').insert({ user_id: userId, policy_id: policyId });

    if (error) {
      console.warn('[useSavedPolicies] 저장 실패:', error.message);
      // 실패했으니 화면 상태를 원래대로 되돌림
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.add(policyId);
        else next.delete(policyId);
        return next;
      });
    }
  }

  return { savedIds, loading, toggle, refresh };
}
