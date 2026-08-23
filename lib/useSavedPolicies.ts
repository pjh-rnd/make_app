import { useCallback, useEffect, useState } from 'react';

import type { Deadline } from '@/data/deadlines';
import { cancelDeadlineReminders, scheduleDeadlineReminders } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';

type SavedRow = { policyId: string; notificationIds: string[] };

// D-5/D-3/D-1 세 알림 id를 DB 컬럼 하나(notification_id, text)에 그대로 쉼표로 이어붙여서 저장함
// — 원래 알림 1개짜리였던 컬럼이라 배열을 저장할 별도 컬럼이 없어서, 스키마를 안 건드리고
// 이 컬럼 안에서 여러 개를 표현하는 방식으로 처리함
function packIds(ids: string[]): string | null {
  return ids.length > 0 ? ids.join(',') : null;
}
function unpackIds(packed: string | null): string[] {
  return packed ? packed.split(',').filter(Boolean) : [];
}

// 사용자가 "찜"한 정책들을 관리하는 훅. 찜 = 그 정책의 마감 5일/3일/1일 전 알림도 같이 예약해두는 것.
// saved_policies 테이블: user_id + policy_id 조합이 있으면 찜한 것, notification_id는 예약해둔 알림 id들(쉼표 구분).
//
// policies: 알림 재예약 백필용(아래 refresh 참고) — 예전엔 data/deadlines.ts의 mock을 정적으로
// import해서 썼는데, 실제 데이터(lib/usePolicies.ts)는 비동기로 가져와야 해서 호출하는 화면이
// 이미 가진 목록을 그대로 넘겨받는 방식으로 바꿈. 안 넘기면(기본값 []) 백필만 조용히 스킵됨 —
// 찜/찜해제(toggle) 자체는 호출부에서 title/deadlineDate를 직접 넘겨주니 이 목록이 없어도 정상 동작함.
export function useSavedPolicies(userId: string | undefined, policies: Deadline[] = []) {
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
      next.set(row.policy_id, { policyId: row.policy_id, notificationIds: unpackIds(row.notification_id) });
    }
    setSaved(next);
    setLoading(false);

    // 예전에 찜했지만 알림 기능이 생기기 전이라 notification_id가 비어있는 것들을 채워넣음
    // (혹은 재설치 등으로 예약이 날아갔을 때도 다시 잡아줌)
    for (const row of next.values()) {
      if (row.notificationIds.length > 0) continue;
      const policy = policies.find((d) => d.id === row.policyId);
      // 상시모집(deadlineDate 없음)은 마감 기준 알림을 계산할 수가 없어서 예약 자체를 건너뜀
      if (!policy || !policy.deadlineDate) continue;
      const notificationIds = await scheduleDeadlineReminders(policy.title, policy.deadlineDate);
      if (notificationIds.length > 0) {
        await supabase
          .from('saved_policies')
          .update({ notification_id: packIds(notificationIds) })
          .eq('user_id', userId)
          .eq('policy_id', row.policyId);
        setSaved((prev) => {
          const updated = new Map(prev);
          updated.set(row.policyId, { policyId: row.policyId, notificationIds });
          return updated;
        });
      }
    }
  }, [userId, policies]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // 찜/찜해제를 반대로 뒤집는 함수. 먼저 화면부터 바꾸고(낙관적 업데이트),
  // 서버 요청이 실패하면 원래대로 되돌림. 찜하면 마감 5일/3일/1일 전 알림이 같이 예약됨
  // (상시모집처럼 deadlineDate가 없으면 예약할 마감 기준이 없어서 알림 없이 찜만 됨).
  async function toggle(policy: { id: string; title: string; deadlineDate: string | null }) {
    if (!userId) return;
    const existing = saved.get(policy.id);
    const wasSaved = !!existing;

    if (wasSaved) {
      setSaved((prev) => {
        const next = new Map(prev);
        next.delete(policy.id);
        return next;
      });
      if (existing) await cancelDeadlineReminders(existing.notificationIds);
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
      const notificationIds = policy.deadlineDate
        ? await scheduleDeadlineReminders(policy.title, policy.deadlineDate)
        : [];
      setSaved((prev) => new Map(prev).set(policy.id, { policyId: policy.id, notificationIds }));
      const { error } = await supabase
        .from('saved_policies')
        .insert({ user_id: userId, policy_id: policy.id, notification_id: packIds(notificationIds) });
      if (error) {
        console.warn('[useSavedPolicies] 저장 실패:', error.message);
        await cancelDeadlineReminders(notificationIds);
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
