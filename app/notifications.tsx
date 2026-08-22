import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HeaderBackButton } from '@/components/header-back-button';
import { COLORS } from '@/constants/moa-colors';
import { DEADLINES } from '@/data/deadlines';
import { useSavedPolicies } from '@/lib/useSavedPolicies';
import { useSession } from '@/lib/useSession';

// 🔔 알림 화면 — 실제 알림(lib/notifications.ts가 마감 5일/3일/1일 전 오전 9시에 예약해두는 것)을
// 놓쳤거나 몰아서 보고 싶을 때를 위해, 그 세 시점(정확히 D-5/D-3/D-1)에 딱 맞는 것만 알림 카드
// 형태로 보여줌. 카드를 누르면 바로 그 공고 상세 화면으로 이동함(카드 UI가 아니라 진짜 "알림"처럼
// 보이게 하려고 components/deadline-card.tsx는 안 쓰고 이 화면 전용으로 따로 그림).
const REMINDER_DAYS = [1, 3, 5] as const;
// 마감이 가까울수록(1일 전이 제일 급함) 느낌표를 더 많이 붙여서 긴급도를 표현함
const URGENCY_MARK: Record<number, string> = { 1: '!!!', 3: '!!', 5: '!' };

function formatMonthDay(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export default function NotificationsScreen() {
  const { session } = useSession();
  const { savedIds, refresh: refreshSaved } = useSavedPolicies(session?.user.id);

  useFocusEffect(
    useCallback(() => {
      refreshSaved();
    }, [refreshSaved])
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayLabel = formatMonthDay(today.toISOString());

  // 찜한 것 중, 오늘 기준으로 마감이 정확히 1일/3일/5일 남은 것만 골라서 알림처럼 보여줌
  // (2일·4일 전 같은 애매한 시점은 실제 알림이 안 가는 시점이라 여기서도 안 보여줌)
  const notifications = DEADLINES.filter((d) => savedIds.has(d.id))
    .map((d) => {
      const deadline = new Date(d.deadlineDate);
      deadline.setHours(0, 0, 0, 0);
      const daysLeft = Math.round((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return { ...d, daysLeft };
    })
    .filter((d): d is typeof d & { daysLeft: 1 | 3 | 5 } =>
      (REMINDER_DAYS as readonly number[]).includes(d.daysLeft)
    )
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <HeaderBackButton />
        <Text style={styles.headerTitle}>알림</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {notifications.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyText}>
              마감 1일·3일·5일 전 알림이 하나도 없어요.{'\n'}공고를 찜해두면 여기서 알려드려요.
            </Text>
          </View>
        ) : (
          notifications.map((d) => (
            <Pressable
              key={d.id}
              style={styles.notifCard}
              onPress={() => router.push(`/deadline/${d.id}`)}>
              <Text style={styles.notifDate}>{todayLabel}</Text>
              <Text style={styles.notifHeadline}>
                ⏰ Fit한 공고 마감 {d.daysLeft}일 전{URGENCY_MARK[d.daysLeft]}
              </Text>
              <Text style={styles.notifBody} numberOfLines={2}>
                {d.title}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: COLORS.ink },
  headerSpacer: { width: 40 },
  content: { padding: 20, paddingBottom: 40 },

  notifCard: {
    backgroundColor: COLORS.paperRaise,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  notifDate: { fontSize: 11, color: COLORS.inkSoft, marginBottom: 6 },
  notifHeadline: { fontSize: 15.5, fontWeight: '700', color: COLORS.ink },
  notifBody: { fontSize: 13.5, color: COLORS.inkSoft, marginTop: 4 },

  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 32, marginBottom: 10 },
  emptyText: { fontSize: 13, color: COLORS.inkSoft, textAlign: 'center', lineHeight: 20 },
});
