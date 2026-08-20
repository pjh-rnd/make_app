import { Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HeaderBackButton } from '@/components/header-back-button';
import { CATEGORY_COLOR, COLORS, ddayStyle } from '@/constants/moa-colors';
import { DEADLINES } from '@/data/deadlines';
import { calculateMatch } from '@/lib/matching';
import { useProfile } from '@/lib/useProfile';
import { useSavedPolicies } from '@/lib/useSavedPolicies';
import { useSession } from '@/lib/useSession';

export default function DeadlineDetailScreen() {
  // URL의 [id] 부분이 여기로 들어옴 (예: /deadline/happy-housing -> id === 'happy-housing')
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = DEADLINES.find((d) => d.id === id);

  const { session } = useSession();
  const { profile } = useProfile(session?.user.id);
  const { savedIds, toggle: toggleSaved } = useSavedPolicies(session?.user.id);

  if (!item) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="정책 상세" />
        <Text style={styles.notFound}>해당 정책을 찾을 수 없어요.</Text>
      </View>
    );
  }

  const dstyle = ddayStyle(item.urgency);
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
            <Text style={[styles.ddayText, { color: dstyle.text }]}>{item.dday}</Text>
          </View>
          {session && (
            <Pressable onPress={() => toggleSaved(item.id)} hitSlop={10}>
              <Text style={styles.heartIcon}>{savedIds.has(item.id) ? '❤️' : '🤍'}</Text>
            </Pressable>
          )}
        </View>

        <Text style={[styles.category, { color: catColor }]}>{item.category}</Text>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.meta}>{item.meta}</Text>

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
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: COLORS.ink },
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
  ddayText: { fontWeight: '700', fontSize: 14 },
  heartIcon: { fontSize: 20 },

  category: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.ink, marginTop: 6, lineHeight: 27 },
  meta: { fontSize: 13, color: COLORS.inkSoft, marginTop: 8 },

  divider: { height: 1, backgroundColor: COLORS.line, marginVertical: 20 },

  sectionLabel: {
    fontSize: 11,
    color: COLORS.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  detail: { fontSize: 14, color: COLORS.ink, lineHeight: 22 },
  criterion: { fontSize: 13.5, marginTop: 6 },
  criterionMet: { color: COLORS.mint },
  criterionUnmet: { color: COLORS.coral },
});
