import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type PolicyComment = {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
};

// supabase/policy_comments.sql로 만든 테이블을 읽고/쓰는 훅. 이 앱은 로그인해야만 들어올 수
// 있는 구조라(app/(tabs)/_layout.tsx) 비로그인 상태를 따로 다룰 필요는 없지만, userId가 아직
// 안 왔을 수도 있는 타이밍(세션 로딩 중)은 방어적으로 처리함.
export function usePolicyComments(policyId: string | undefined, userId: string | undefined) {
  const [comments, setComments] = useState<PolicyComment[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!policyId) {
      setComments([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('policy_comments')
      .select('id, user_id, content, created_at')
      .eq('policy_id', policyId)
      .order('created_at', { ascending: true });

    if (error) {
      // 테이블을 아직 안 만들었을 때도 화면이 죽지 않게(댓글 0개로 보임) 경고만 남기고 넘어감
      console.warn('[usePolicyComments] 조회 실패(supabase/policy_comments.sql 실행 여부 확인):', error.message);
      setLoading(false);
      return;
    }

    setComments(
      (data ?? []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        content: row.content,
        createdAt: row.created_at,
      }))
    );
    setLoading(false);
  }, [policyId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const post = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!policyId || !userId || !trimmed) return;
      const { error } = await supabase
        .from('policy_comments')
        .insert({ policy_id: policyId, user_id: userId, content: trimmed });
      if (error) {
        console.warn('[usePolicyComments] 등록 실패:', error.message);
        return;
      }
      await refresh();
    },
    [policyId, userId, refresh]
  );

  const remove = useCallback(async (commentId: string) => {
    // 낙관적으로 먼저 화면에서 지움 — RLS가 본인 댓글이 아니면 어차피 delete 자체가 안 먹히므로
    // (0행 삭제) 실패해도 다시 refresh하면 원상복구됨
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    const { error } = await supabase.from('policy_comments').delete().eq('id', commentId);
    if (error) {
      console.warn('[usePolicyComments] 삭제 실패:', error.message);
    }
  }, []);

  return { comments, loading, post, remove, refresh };
}
