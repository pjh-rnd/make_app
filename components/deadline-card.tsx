import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CATEGORY_COLOR, COLORS, ddayStyle } from '@/constants/moa-colors';
import type { Deadline } from '@/data/deadlines';
import { computeDday, formatMonthDay } from '@/lib/deadlineUtils';
import type { MatchResult } from '@/lib/matching';

// 홈 화면(다가오는 마감/마감된 공고/날짜별 그룹)과 검색 화면(app/search.tsx)이 완전히 똑같은
// 카드 UI를 썼었는데, 두 군데에 코드가 복붙돼있으니 스타일 하나 고칠 때마다 두 파일을 같이 고쳐야
// 했음. 그래서 컴포넌트로 뺌 — 이동은 항상 router.push로 직접 하므로(Link/Modal 조합 없음),
// 검색 화면이 진짜 네비게이션 스택 화면이 된 지금은 "모달을 닫고 이동" 같은 우회가 필요 없음.
export type DeadlineWithMatch = Deadline & { match: MatchResult };

export function DeadlineCard({
  item,
  hasProfile,
  isSaved,
  onToggleSave,
  saveCount = 0,
  fontScale = 1,
}: {
  item: DeadlineWithMatch;
  hasProfile: boolean;
  isSaved: boolean;
  onToggleSave: () => void;
  // 이 공고를 찜한 전체 사용자 수 — "인기 있는 공고"를 알아볼 수 있게 하트 밑에 작게 보여줌.
  // 안 넘기면(값이 없는 화면 등) 그냥 숫자를 안 보여줌
  saveCount?: number;
  // 카드 안 "공고문" 글자(카테고리·매칭 배지·제목·메타·기간·지역)만 키우는 배율(2026-08-23 추가)
  // — 검색 화면에서만 1.2배로 키워달라는 요청이 있었는데, 이 컴포넌트는 홈 화면과 공용이라 여기
  // 스타일을 직접 고치면 홈 화면까지 같이 커짐. D-day 배지/하트 아이콘은 대상에서 제외해달라고
  // 했으므로 얘는 안 건드림. 기본값 1이라 안 넘기면(홈 화면) 기존 크기 그대로.
  fontScale?: number;
}) {
  const { label: ddayLabel, phase } = computeDday(item.startDate, item.deadlineDate);
  const dstyle = ddayStyle(phase);
  const catColor = CATEGORY_COLOR[item.categoryId];
  const unmetCount = item.match.criteria.filter((c) => !c.met).length;
  const isAlmost = !!(
    hasProfile &&
    !item.match.eligible &&
    item.match.criteria.length > 0 &&
    unmetCount === 1
  );

  return (
    // 하트 버튼을 카드(Pressable) "안"에 중첩시키지 않고 밖에 별도로 얹음
    // — 중첩 Pressable이 가끔 터치를 동시에 가로채면서 화면이 튀는 현상이 있었음
    <View style={styles.wrap}>
      <Pressable style={styles.card} onPress={() => router.push(`/deadline/${item.id}`)}>
        <View style={[styles.ddayBadge, { backgroundColor: dstyle.bg }]}>
          <Text style={[styles.ddayText, { color: dstyle.text }]}>{ddayLabel}</Text>
        </View>
        <View style={styles.info}>
          <View style={styles.topRow}>
            <Text style={[styles.cat, { color: catColor, fontSize: 12 * fontScale }]}>
              {item.category}
            </Text>
            {hasProfile && (
              <Text
                style={[
                  styles.matchBadge,
                  { fontSize: 12.5 * fontScale },
                  !item.match.eligible && styles.matchBadgeFail,
                  isAlmost && styles.matchBadgeAlmost,
                ]}>
                {item.match.eligible
                  ? '지원 가능'
                  : isAlmost
                    ? '조건 1개만 더 맞으면'
                    : '조건 미충족'}
              </Text>
            )}
          </View>
          <Text style={[styles.title, { fontSize: 16.5 * fontScale }]}>{item.title}</Text>
          <Text style={[styles.meta, { fontSize: 13.5 * fontScale }]}>{item.meta}</Text>
          {/* 상시모집(phase==='rolling')은 startDate/deadlineDate가 둘 다 null이라 날짜를 못 보여주고,
              대신 "언제든 신청 가능"이라는 걸 알려줌 */}
          <Text style={[styles.period, { fontSize: 12.5 * fontScale }]}>
            {phase === 'rolling'
              ? '상시 접수 중 · 언제든 신청 가능해요'
              : `신청 ${formatMonthDay(item.startDate!)} 시작 · ${formatMonthDay(item.deadlineDate!)} 마감`}
          </Text>
          {/* 지역 조건을 항상 명시적으로 보여줌(2026-08-23 추가) — regionKeyword가 없는 공고를
              보고 "이거 지역 상관없이 다 되는 건가?"라고 헷갈려하는 사용자 피드백이 있었음.
              값이 있든 없든 뭐라도 보여줘야 "안 보이는 건 아직 못 찾은 거"와 "진짜 전국 대상"이
              구분됨 */}
          <Text style={[styles.region, { fontSize: 12 * fontScale }]}>
            📍 {item.requirements.regionKeyword ?? '전국'}
          </Text>
        </View>
      </Pressable>
      {/* 하트 버튼 바로 밑에 "이 공고를 찜한 사람 수"를 작게 붙여둠 — 인스타그램 좋아요 개수처럼
          하트와 세트로 보이는 자리가 제일 직관적이라(누르는 곳 = 세는 곳) 여기로 정함.
          0명이면 굳이 "0"을 보여줄 필요 없어서 숨김 */}
      <View style={styles.heartColumn}>
        <Pressable onPress={onToggleSave} hitSlop={10} style={styles.heartButton}>
          <Text style={styles.heartIcon}>{isSaved ? '❤️' : '🤍'}</Text>
        </Pressable>
        {saveCount > 0 && <Text style={styles.saveCount}>{saveCount}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', marginBottom: 10 },
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
  ddayText: { fontWeight: '700', fontSize: 14.5 },
  info: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  matchBadge: { fontSize: 12.5, fontWeight: '700', color: COLORS.mint },
  matchBadgeFail: { color: COLORS.inkSoft },
  matchBadgeAlmost: { color: COLORS.amber },
  cat: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  title: { fontSize: 16.5, fontWeight: '600', color: COLORS.ink, marginTop: 3 },
  meta: { fontSize: 13.5, color: COLORS.inkSoft, marginTop: 4 },
  period: { fontSize: 12.5, color: COLORS.inkSoft, marginTop: 4, opacity: 0.75 },
  region: { fontSize: 12, color: COLORS.inkSoft, marginTop: 2, opacity: 0.65 },

  heartColumn: { position: 'absolute', top: 8, right: 8, alignItems: 'center' },
  heartButton: { padding: 4 },
  heartIcon: { fontSize: 16 },
  saveCount: { fontSize: 10.5, color: COLORS.inkSoft, fontWeight: '600', marginTop: -2 },
});
