import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

// 정책별 "찜 개수" — 인기순 정렬/카드에 찜한 사람 수 표시용. supabase/policy_save_counts.sql로
// 만들어둔 뷰(policy_id별 count만 집계, 누가 찜했는지는 노출 안 함)를 읽어옴.
// ⚠️ 그 SQL을 Supabase 대시보드에서 먼저 실행해둬야 이 훅이 정상 동작함(안 해두면 뷰가 없어서 에러 나고, 빈 Map으로 남음).
export function usePolicySaveCounts() {
  const [counts, setCounts] = useState<Map<string, number>>(new Map());

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('policy_save_counts').select('policy_id, save_count');
    if (error) {
      // 뷰를 아직 안 만들었을 때도 앱이 죽지 않게(찜 개수는 그냥 0으로 보임) 경고만 남기고 넘어감
      console.warn('[usePolicySaveCounts] 조회 실패(SQL 마이그레이션을 실행했는지 확인해주세요):', error.message);
      return;
    }
    const next = new Map<string, number>();
    for (const row of data ?? []) {
      next.set(row.policy_id, row.save_count);
    }
    setCounts(next);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { counts, refresh };
}
