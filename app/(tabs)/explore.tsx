import { useFocusEffect } from '@react-navigation/native';
import { Link } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CATEGORY_COLOR, COLORS, ddayStyle } from '@/constants/moa-colors';
import { DEADLINES } from '@/data/deadlines';
import { computeDday } from '@/lib/deadlineUtils';
import { useSavedPolicies } from '@/lib/useSavedPolicies';
import { useSession } from '@/lib/useSession';

// 찜한 정책만 모아보는 화면 (예전엔 Expo 기본 템플릿 화면이었음)
export default function SavedScreen() {
  const { session } = useSession();
  const { savedIds, toggle: toggleSaved, refresh } = useSavedPolicies(session?.user.id);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const savedDeadlines = DEADLINES.filter((d) => savedIds.has(d.id));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>찜한 정책</Text>
      <Text style={styles.subtitle}>
        하트 누른 정책들을 여기 모아뒀어요. 마감 하루 전엔 알림도 보내드려요.
      </Text>

      {savedDeadlines.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>🤍</Text>
          <Text style={styles.emptyText}>아직 찜한 정책이 없어요.{'\n'}홈 화면에서 하트를 눌러보세요.</Text>
        </View>
      ) : (
        savedDeadlines.map((d) => {
          const { label: ddayLabel, urgency } = computeDday(d.deadlineDate);
          const dstyle = ddayStyle(urgency);
          const catColor = CATEGORY_COLOR[d.categoryId];
          return (
            <View key={d.id} style={styles.cardWrap}>
              <Link href={`/deadline/${d.id}`} asChild>
                <Pressable style={styles.card}>
                  <View style={[styles.ddayBadge, { backgroundColor: dstyle.bg }]}>
                    <Text style={[styles.ddayText, { color: dstyle.text }]}>{ddayLabel}</Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={[styles.cardCat, { color: catColor }]}>{d.category}</Text>
                    <Text style={styles.cardTitle}>{d.title}</Text>
                    <Text style={styles.cardMeta}>{d.meta}</Text>
                  </View>
                </Pressable>
              </Link>
              <Pressable
                onPress={() => toggleSaved({ id: d.id, title: d.title, deadlineDate: d.deadlineDate })}
                hitSlop={10}
                style={styles.heartButton}>
                <Text style={styles.heartIcon}>❤️</Text>
              </Pressable>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.paper },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },

  title: { fontSize: 24, fontWeight: '700', color: COLORS.ink },
  subtitle: { fontSize: 12, color: COLORS.inkSoft, marginTop: 4, marginBottom: 24, lineHeight: 18 },

  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 32, marginBottom: 10 },
  emptyText: { fontSize: 13, color: COLORS.inkSoft, textAlign: 'center', lineHeight: 20 },

  cardWrap: { position: 'relative', marginBottom: 10 },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: COLORS.paperRaise,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 14,
    padding: 14,
    paddingRight: 36,
  },
  ddayBadge: { borderRadius: 8, paddingVertical: 5, paddingHorizontal: 9, alignSelf: 'flex-start' },
  ddayText: { fontWeight: '700', fontSize: 13 },
  cardInfo: { flex: 1 },
  cardCat: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: COLORS.ink, marginTop: 3 },
  cardMeta: { fontSize: 11.5, color: COLORS.inkSoft, marginTop: 4 },

  heartButton: { position: 'absolute', top: 10, right: 10, padding: 4 },
  heartIcon: { fontSize: 16 },
});
