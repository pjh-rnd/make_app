import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CATEGORY_COLOR, COLORS, ddayStyle } from '@/constants/moa-colors';
import { DEADLINES } from '@/data/deadlines';
import { calculateMatch } from '@/lib/matching';
import { useProfile } from '@/lib/useProfile';
import { useSession } from '@/lib/useSession';

export default function DeadlineDetailScreen() {
  // URL의 [id] 부분이 여기로 들어옴 (예: /deadline/happy-housing -> id === 'happy-housing')
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = DEADLINES.find((d) => d.id === id);

  const { session } = useSession();
  const { profile } = useProfile(session?.user.id);

  if (!item) {
    return (
      <View style={styles.screen}>
        <Text style={styles.notFound}>해당 정책을 찾을 수 없어요.</Text>
      </View>
    );
  }

  const dstyle = ddayStyle(item.urgency);
  const catColor = CATEGORY_COLOR[item.categoryId];
  const match = calculateMatch(profile, item.requirements);

  return (
    <>
      {/* 상단 헤더 제목을 카테고리명으로 지정 */}
      <Stack.Screen options={{ title: item.category }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={[styles.ddayBadge, { backgroundColor: dstyle.bg }]}>
          <Text style={[styles.ddayText, { color: dstyle.text }]}>{item.dday}</Text>
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
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.paper },
  content: { padding: 20, paddingTop: 24, paddingBottom: 40 },
  notFound: { fontSize: 14, color: COLORS.inkSoft, padding: 20 },

  ddayBadge: {
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  ddayText: { fontWeight: '700', fontSize: 14 },

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
