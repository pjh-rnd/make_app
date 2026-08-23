import { Stack, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HeaderBackButton } from '@/components/header-back-button';
import { CATEGORY_COLOR, COLORS, ddayStyle } from '@/constants/moa-colors';
import { computeDday, formatMonthDay } from '@/lib/deadlineUtils';
import { calculateMatch } from '@/lib/matching';
import { usePolicies } from '@/lib/usePolicies';
import { useProfile } from '@/lib/useProfile';
import { useSavedPolicies } from '@/lib/useSavedPolicies';
import { useSession } from '@/lib/useSession';

export default function DeadlineDetailScreen() {
  // URL의 [id] 부분이 여기로 들어옴 (예: /deadline/happy-housing -> id === 'happy-housing')
  const { id } = useLocalSearchParams<{ id: string }>();
  const { policies, loading: policiesLoading } = usePolicies();
  const item = policies.find((d) => d.id === id);

  const { session } = useSession();
  const { profile } = useProfile(session?.user.id);
  const { savedIds, toggle: toggleSaved } = useSavedPolicies(session?.user.id, policies);

  if (!item) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="정책 상세" />
        {/* Supabase에서 policies를 아직 불러오는 중일 수 있어서(비동기), 로딩 중과 진짜
            "없는 정책"을 구분해서 보여줌 — 안 그러면 데이터 오는 짧은 순간 "못 찾음" 문구가
            잠깐 번쩍이는 것처럼 보임 */}
        <Text style={styles.notFound}>
          {policiesLoading ? '불러오는 중...' : '해당 정책을 찾을 수 없어요.'}
        </Text>
      </View>
    );
  }

  const { label: ddayLabel, phase } = computeDday(item.startDate, item.deadlineDate);
  const dstyle = ddayStyle(phase);
  const catColor = CATEGORY_COLOR[item.categoryId];
  const match = calculateMatch(profile, item.requirements);

  return (
    <View style={styles.screen}>
      {/* 네이티브 헤더 대신 화면 안에서 직접 그림 (iOS가 헤더 버튼에 씌우는 원형 배경이 계속
          깜빡이는 문제가 있어서 — app/_layout.tsx에서 이 화면은 headerShown: false로 처리해둠) */}
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title={item.category} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <View style={[styles.ddayBadge, { backgroundColor: dstyle.bg }]}>
            <Text style={[styles.ddayText, { color: dstyle.text }]}>{ddayLabel}</Text>
          </View>
          {session && (
            <Pressable
              onPress={() =>
                toggleSaved({ id: item.id, title: item.title, deadlineDate: item.deadlineDate })
              }
              hitSlop={10}>
              <Text style={styles.heartIcon}>{savedIds.has(item.id) ? '❤️' : '🤍'}</Text>
            </Pressable>
          )}
        </View>

        <Text style={[styles.category, { color: catColor }]}>{item.category}</Text>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.meta}>{item.meta}</Text>
        <Text style={styles.period}>
          {phase === 'rolling'
            ? '상시 접수 · 신청 기간이 정해져 있지 않아요'
            : `신청기간 ${formatMonthDay(item.startDate!)} ~ ${formatMonthDay(item.deadlineDate!)}`}
        </Text>

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>안내</Text>
        <Text style={styles.detail}>{item.detail}</Text>

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>
          내 조건으로 {match.eligible ? '신청 가능해요' : '신청할 수 없어요'}
        </Text>
        {match.criteria.map((c) => (
          <Text key={c.label} style={[styles.criterion, c.met ? styles.criterionMet : styles.criterionUnmet]}>
            {c.met ? '✓' : '✗'} {c.label}
          </Text>
        ))}

        {item.perks.length > 0 && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionLabel}>이런 점이 좋아요!</Text>
            {item.perks.map((perk) => (
              <Text key={perk} style={styles.perk}>
                ✨ {perk}
              </Text>
            ))}
          </>
        )}

        {item.links.length > 0 && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionLabel}>관련 링크</Text>
            {item.links.map((link) => (
              <Pressable key={link.url} onPress={() => Linking.openURL(link.url)}>
                <Text style={styles.link}>🔗 {link.label}</Text>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// 네이티브 헤더 대신 화면 안에서 직접 그리는 헤더 (뒤로가기 + 카테고리명)
function ScreenHeader({ title }: { title: string }) {
  return (
    <View style={styles.header}>
      <HeaderBackButton />
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerSpacer} />
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
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: COLORS.ink },
  headerSpacer: { width: 40 },
  content: { padding: 20, paddingTop: 4, paddingBottom: 40 },
  notFound: { fontSize: 14, color: COLORS.inkSoft, padding: 20 },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  ddayBadge: {
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  ddayText: { fontWeight: '700', fontSize: 15 },
  heartIcon: { fontSize: 22 },

  category: { fontSize: 13.5, fontWeight: '700', letterSpacing: 0.3 },
  title: { fontSize: 23, fontWeight: '700', color: COLORS.ink, marginTop: 7, lineHeight: 30 },
  meta: { fontSize: 15, color: COLORS.inkSoft, marginTop: 9 },
  period: { fontSize: 14, color: COLORS.inkSoft, marginTop: 7, opacity: 0.8 },

  divider: { height: 1, backgroundColor: COLORS.line, marginVertical: 20 },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.inkSoft,
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  detail: { fontSize: 16, color: COLORS.ink, lineHeight: 24 },
  criterion: { fontSize: 15.5, marginTop: 7, lineHeight: 21 },
  criterionMet: { color: COLORS.mint },
  criterionUnmet: { color: COLORS.coral },
  perk: { fontSize: 15.5, color: COLORS.ink, marginTop: 7, lineHeight: 21 },
  link: { fontSize: 15.5, color: COLORS.mint, fontWeight: '600', marginTop: 9, lineHeight: 21 },
});
