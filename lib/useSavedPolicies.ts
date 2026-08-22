import { useCallback, useEffect, useState } from 'react';

import { DEADLINES } from '@/data/deadlines';
import { cancelDeadlineReminder, scheduleDeadlineReminder } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';

type SavedRow = { policyId: string; notificationId: string | null };

// 사용자가 "찜"한 정책들을 관리하는 훅. 찜 = 그 정책의 마감 알림도 같이 예약해두는 것.
// saved_policies 테이블: user_id + policy_id 조합이 있으면 찜한 것, notification_id는 예약해둔 알림 id.
export function useSavedPolicies(userId: string | undefined) {
  const [saved, setSaved] = useState<Map<string, SavedRow>>(new Map());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setSaved(new Map());
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('saved_policies')
      .select('policy_id, notification_id')
      .eq('user_id', userId);

    if (error) {
      console.warn('[useSavedPolicies] 조회 실패:', error.message);
      setLoading(false);
      return;
    }

    const next = new Map<string, SavedRow>();
    for (const row of data ?? []) {
      next.set(row.policy_id, { policyId: row.policy_id, notificationId: row.notification_id });
    }
    setSaved(next);
    setLoading(false);

    // 예전에 찜했지만 알림 기능이 생기기 전이라 notification_id가 비어있는 것들을 채워넣음
    // (혹은 재설치 등으로 예약이 날아갔을 때도 다시 잡아줌)
    for (const row of next.values()) {
      if (row.notificationId) continue;
      const policy = DEADLINES.find((d) => d.id === row.policyId);
      if (!policy) continue;
      const notificationId = await scheduleDeadlineReminder(policy.title, policy.deadlineDate);
      if (notificationId) {
        await supabase
          .from('saved_policies')
          .update({ notification_id: notificationId })
          .eq('user_id', userId)
          .eq('policy_id', row.policyId);
        setSaved((prev) => {
          const updated = new Map(prev);
          updated.set(row.policyId, { policyId: row.policyId, notificationId });
          return updated;
        });
      }
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // 찜/찜해제를 반대로 뒤집는 함수. 먼저 화면부터 바꾸고(낙관적 업데이트),
  // 서버 요청이 실패하면 원래대로 되돌림. 찜하면 마감 하루 전 알림도 같이 예약됨.
  async function toggle(policy: { id: string; title: string; deadlineDate: string }) {
    if (!userId) return;
    const existing = saved.get(policy.id);
    const wasSaved = !!existing;

    if (wasSaved) {
      setSaved((prev) => {
        const next = new Map(prev);
        next.delete(policy.id);
        return next;
      });
      if (existing?.notificationId) await cancelDeadlineReminder(existing.notificationId);
      const { error } = await supabase
        .from('saved_policies')
        .delete()
        .eq('user_id', userId)
        .eq('policy_id', policy.id);
      if (error) {
        console.warn('[useSavedPolicies] 저장 실패:', error.message);
        setSaved((prev) => new Map(prev).set(policy.id, existing));
      }
    } else {
      const notificationId = await scheduleDeadlineReminder(policy.title, policy.deadlineDate);
      setSaved((prev) => new Map(prev).set(policy.id, { policyId: policy.id, notificationId }));
      const { error } = await supabase
        .from('saved_policies')
        .insert({ user_id: userId, policy_id: policy.id, notification_id: notificationId });
      if (error) {
        console.warn('[useSavedPolicies] 저장 실패:', error.message);
        if (notificationId) await cancelDeadlineReminder(notificationId);
        setSaved((prev) => {
          const next = new Map(prev);
          next.delete(policy.id);
          return next;
        });
      }
    }
  }

  const savedIds = new Set(saved.keys());

  return { savedIds, loading, toggle, refresh };
}
