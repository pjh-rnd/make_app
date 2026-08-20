import { useFocusEffect } from '@react-navigation/native';
import { Link } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CATEGORY_COLOR, COLORS, ddayStyle } from '@/constants/moa-colors';
import { DEADLINES } from '@/data/deadlines';
import { calculateMatch } from '@/lib/matching';
import { useSavedPolicies } from '@/lib/useSavedPolicies';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/lib/useProfile';
import { useSession } from '@/lib/useSession';

// 칩의 "초기값"일 뿐, 실제 켜짐/꺼짐 상태는 컴포넌트 안 useState가 들고 있음
// id는 DEADLINES의 categoryId와 매칭시켜서 필터링에 씀
const INITIAL_INTERESTS = [
  { id: 'housing', label: '🏠 주거', active: true },
  { id: 'money', label: '💰 자산형성', active: true },
  { id: 'job', label: '💼 취업', active: false },
  { id: 'edu', label: '📚 교육', active: false },
  { id: 'welfare', label: '🏥 복지', active: false },
];

// 날짜(day 숫자)별로 어떤 정책 마감이 있는지 - 진짜로는 Supabase에서 가져올 데이터, 지금은 가짜값
const DEADLINE_DAYS: Record<number, { category: keyof typeof CATEGORY_COLOR }[]> = {
  12: [{ category: 'money' }],
  18: [{ category: 'housing' }, { category: 'job' }],
  19: [{ category: 'housing' }],
  26: [{ category: 'money' }],
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// 특정 연/월(month는 0=1월)의 달력 칸을 만드는 함수.
// 이번 달 앞뒤로 빈 칸을 채워서 7의 배수(한 주 단위)로 맞춰줌.
function buildMonthGrid(year: number, month: number) {
  const firstWeekday = new Date(year, month, 1).getDay(); // 0=일요일
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: { day: number; inMonth: boolean }[] = [];
  for (let i = firstWeekday - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, inMonth: true });
  }
  let next = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ day: next++, inMonth: false });
  }

  // 7개씩 끊어서 "주" 단위 배열로 변환
  const weeks: { day: number; inMonth: boolean }[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export default function HomeScreen() {
  const today = new Date();

  // 달력에 보여줄 연/월. 처음엔 오늘 날짜 기준으로 시작하고, 화살표로 이전/다음 달 이동 가능
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const weeks = buildMonthGrid(viewYear, viewMonth);

  function goToPrevMonth() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  }
  function goToNextMonth() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  const { session } = useSession();
  const { profile, loading: profileLoading, refresh: refreshProfile } = useProfile(
    session?.user.id
  );
  const { savedIds, toggle: toggleSaved, refresh: refreshSaved } = useSavedPolicies(
    session?.user.id
  );

  // 이 화면에 다시 돌아올 때마다(수정 화면·상세페이지에서 뒤로 왔을 때 등) 최신 프로필/찜 목록을 다시 불러옴
  // (상세페이지에서 찜했는데 리스트가 예전 상태를 들고 있으면, 다시 찜하려다 "이미 있음" 에러로 안 눌리는 것처럼 보임)
  useFocusEffect(
    useCallback(() => {
      refreshProfile();
      refreshSaved();
    }, [refreshProfile, refreshSaved])
  );

  const hasProfile = !!profile && (profile.age || profile.region || profile.income_level || profile.housing_status);

  // interests가 "state" — 값이 바뀌면 이 값을 쓰는 화면 부분이 자동으로 다시 그려짐
  const [interests, setInterests] = useState(INITIAL_INTERESTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSavedOnly, setShowSavedOnly] = useState(false);

  // 특정 칩을 눌렀을 때, 그 칩의 active만 반대로 뒤집은 새 배열로 교체
  function toggleInterest(id: string) {
    setInterests((prev) =>
      prev.map((item) => (item.id === id ? { ...item, active: !item.active } : item))
    );
  }

  // 켜져있는 칩들의 id 목록
  const activeIds = interests.filter((item) => item.active).map((item) => item.id);
  const trimmedQuery = searchQuery.trim();

  // 관심분야 → 검색어 → 찜한 것만 순서로 좁혀나감
  const filteredDeadlines = DEADLINES.filter((d) => activeIds.includes(d.categoryId))
    .filter(
      (d) =>
        trimmedQuery === '' ||
        d.title.includes(trimmedQuery) ||
        d.category.includes(trimmedQuery) ||
        d.meta.includes(trimmedQuery)
    )
    .filter((d) => !showSavedOnly || savedIds.has(d.id));

  // 각 마감일마다 내 프로필과 비교해서 자격 여부 계산, 그 중 실제로 지원 가능한 것 하나를 배너에 띄움
  const deadlinesWithMatch = filteredDeadlines.map((d) => ({
    ...d,
    match: calculateMatch(profile, d.requirements),
  }));
  const bestMatch = deadlinesWithMatch.find((d) => d.match.eligible) ?? null;
  // 딱 맞는 게 없을 때, 조건이 제일 적게 모자란(=가장 아깝게 놓친) 정책을 하나 골라서 보여줌
  const nearMissCandidates = deadlinesWithMatch.filter((d) => d.match.criteria.length > 0);
  const nearMiss =
    !bestMatch && nearMissCandidates.length > 0
      ? [...nearMissCandidates].sort(
          (a, b) =>
            a.match.criteria.filter((c) => !c.met).length -
            b.match.criteria.filter((c) => !c.met).length
        )[0]
      : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.brand}>Fit Me</Text>
      <Text style={styles.brandSub}>나에게 맞는 청년정책 캘린더</Text>

      {/* 프로필 카드 - 이제 Supabase의 profiles 테이블에서 실제로 불러옴 */}
      <View style={styles.profileCard}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardLabel}>내 조건</Text>
          <Link href="/edit-profile" style={styles.editLink}>
            수정
          </Link>
        </View>
        {profileLoading ? (
          <Text style={styles.profileEmptyText}>불러오는 중...</Text>
        ) : hasProfile ? (
          <>
            <ProfileRow label="나이" value={profile?.age ? `${profile.age}세` : '미입력'} />
            <ProfileRow label="지역" value={profile?.region || '미입력'} />
            <ProfileRow label="소득" value={profile?.income_level || '미입력'} />
            <ProfileRow label="주거" value={profile?.housing_status || '미입력'} last />
          </>
        ) : (
          <Text style={styles.profileEmptyText}>
            아직 프로필이 없어요. 위 &quot;수정&quot;을 눌러 입력해주세요.
          </Text>
        )}
      </View>

      <Pressable style={styles.logoutButton} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.logoutButtonText}>로그아웃</Text>
      </Pressable>

      {/* 검색 */}
      <TextInput
        style={styles.searchInput}
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="정책 제목·카테고리 검색"
        placeholderTextColor="#B6B0A0"
      />

      {/* 관심 분야 칩 */}
      <Text style={styles.sectionLabel}>관심 분야</Text>
      <View style={styles.chipRow}>
        {interests.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => toggleInterest(item.id)}
            style={[styles.chip, item.active && styles.chipActive]}>
            <Text style={[styles.chipText, item.active && styles.chipTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setShowSavedOnly((v) => !v)}
          style={[styles.chip, showSavedOnly && styles.chipActive]}>
          <Text style={[styles.chipText, showSavedOnly && styles.chipTextActive]}>
            🤍 찜한 것만
          </Text>
        </Pressable>
      </View>

      {/* 달력 */}
      <View style={styles.calendarHeaderRow}>
        <Pressable onPress={goToPrevMonth} hitSlop={8} style={styles.monthNavButton}>
          <Text style={styles.monthNavText}>‹</Text>
        </Pressable>
        <Text style={styles.sectionLabel}>{viewYear}년 {viewMonth + 1}월</Text>
        <Pressable onPress={goToNextMonth} hitSlop={8} style={styles.monthNavButton}>
          <Text style={styles.monthNavText}>›</Text>
        </Pressable>
      </View>
      <View style={styles.calendar}>
        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((w) => (
            <Text key={w} style={styles.weekdayText}>{w}</Text>
          ))}
        </View>
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.weekRow}>
            {week.map((cell, ci) => {
              const isToday =
                cell.inMonth &&
                cell.day === today.getDate() &&
                viewMonth === today.getMonth() &&
                viewYear === today.getFullYear();
              const dots = cell.inMonth ? DEADLINE_DAYS[cell.day] : undefined;
              return (
                <View key={ci} style={[styles.dayCell, isToday && styles.dayCellToday]}>
                  <Text
                    style={[
                      styles.dayNum,
                      !cell.inMonth && styles.dayNumDim,
                      isToday && styles.dayNumToday,
                    ]}>
                    {cell.day}
                  </Text>
                  {dots && (
                    <View style={styles.dotRow}>
                      {dots.map((d, di) => (
                        <View
                          key={di}
                          style={[styles.dot, { backgroundColor: CATEGORY_COLOR[d.category] }]}
                        />
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {/* 다가오는 마감 */}
      <Text style={styles.sectionLabel}>다가오는 마감</Text>
      {deadlinesWithMatch.length === 0 && (
        <Text style={styles.emptyText}>선택된 관심 분야에 해당하는 마감이 없어요</Text>
      )}
      {deadlinesWithMatch.map((d) => {
        const dstyle = ddayStyle(d.urgency);
        const catColor = CATEGORY_COLOR[d.categoryId];
        const unmetCount = d.match.criteria.filter((c) => !c.met).length;
        const isAlmost = !!(hasProfile && !d.match.eligible && d.match.criteria.length > 0 && unmetCount === 1);
        const isSaved = savedIds.has(d.id);
        return (
          // 하트 버튼을 카드(Link/Pressable) "안"에 중첩시키지 않고 밖에 별도로 얹음
          // — 중첩 Pressable이 가끔 터치를 동시에 가로채면서 화면이 튀는 현상이 있었음
          <View key={d.id} style={styles.deadlineCardWrap}>
            <Link href={`/deadline/${d.id}`} asChild>
              <Pressable style={styles.deadlineCard}>
                <View style={[styles.ddayBadge, { backgroundColor: dstyle.bg }]}>
                  <Text style={[styles.ddayText, { color: dstyle.text }]}>{d.dday}</Text>
                </View>
                <View style={styles.deadlineInfo}>
                  <View style={styles.deadlineTopRow}>
                    <Text style={[styles.deadlineCat, { color: catColor }]}>{d.category}</Text>
                    {hasProfile && (
                      <Text
                        style={[
                          styles.matchBadge,
                          !d.match.eligible && styles.matchBadgeFail,
                          isAlmost && styles.matchBadgeAlmost,
                        ]}>
                        {d.match.eligible
                          ? '지원 가능'
                          : isAlmost
                            ? '조건 1개만 더 맞으면'
                            : '조건 미충족'}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.deadlineTitle}>{d.title}</Text>
                  <Text style={styles.deadlineMeta}>{d.meta}</Text>
                </View>
              </Pressable>
            </Link>
            <Pressable
              onPress={() => toggleSaved(d.id)}
              hitSlop={10}
              style={styles.heartButton}>
              <Text style={styles.heartIcon}>{isSaved ? '❤️' : '🤍'}</Text>
            </Pressable>
          </View>
        );
      })}

      {/* 매칭 배너 - 내 프로필로 "실제 신청 자격이 되는" 정책이 있는지 보여줌 */}
      <View style={styles.matchBanner}>
        {!hasProfile ? (
          <Text style={styles.matchDesc}>
            프로필을 입력하면 나에게 맞는 정책을 알려드려요.
          </Text>
        ) : bestMatch ? (
          <>
            <Text style={styles.matchNum}>✅ 지원 가능</Text>
            <Text style={styles.matchDesc}>{bestMatch.title}</Text>
            {bestMatch.match.criteria.map((c) => (
              <Text key={c.label} style={styles.matchCriterion}>
                ✓ {c.label}
              </Text>
            ))}
          </>
        ) : nearMiss ? (
          <>
            <Text style={styles.matchNum}>조금만 더 가까워요</Text>
            <Text style={styles.matchDesc}>{nearMiss.title}</Text>
            {nearMiss.match.criteria.map((c) => (
              <Text
                key={c.label}
                style={[styles.matchCriterion, !c.met && styles.matchCriterionUnmet]}>
                {c.met ? '✓' : '✗'} {c.label}
              </Text>
            ))}
          </>
        ) : (
          <>
            <Text style={styles.matchNum}>지금은 없어요</Text>
            <Text style={styles.matchDesc}>
              현재 조건으로는 신청 가능한 정책이 없어요. 아래 카드에서 어떤 조건이 안 맞는지 확인해보세요.
            </Text>
          </>
        )}
      </View>
    </ScrollView>
  );
}

// 반복되는 "라벨: 값" 줄을 위한 작은 컴포넌트 (Props로 label/value/last를 받음)
function ProfileRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.profileRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.profileRowLabel}>{label}</Text>
      <Text style={styles.profileRowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.paper },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },

  brand: { fontSize: 24, fontWeight: '700', color: COLORS.ink },
  brandSub: { fontSize: 12, color: COLORS.inkSoft, marginTop: 2, marginBottom: 20 },

  profileCard: {
    backgroundColor: COLORS.ink,
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: 11,
    color: '#8FA3C8',
    textTransform: 'uppercase',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  editLink: { fontSize: 12, color: '#8FA3C8', textDecorationLine: 'underline' },
  profileEmptyText: { fontSize: 12.5, color: '#A9B4CB', lineHeight: 18 },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  profileRowLabel: { fontSize: 13, color: '#A9B4CB' },
  profileRowValue: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },

  logoutButton: { alignSelf: 'flex-start', marginBottom: 24 },
  logoutButtonText: { fontSize: 12, color: COLORS.inkSoft, textDecorationLine: 'underline' },

  sectionLabel: {
    fontSize: 11,
    color: COLORS.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 4,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },

  searchInput: {
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.ink,
    backgroundColor: COLORS.paperRaise,
    marginBottom: 20,
  },

  calendarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 10,
    marginTop: 4,
  },
  monthNavButton: { paddingHorizontal: 10, paddingVertical: 2 },
  monthNavText: { fontSize: 16, fontWeight: '700', color: COLORS.inkSoft },

  calendar: {
    backgroundColor: COLORS.paperRaise,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 16,
    padding: 12,
    marginBottom: 24,
  },
  weekdayRow: { flexDirection: 'row', marginBottom: 4 },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.inkSoft,
  },
  weekRow: { flexDirection: 'row' },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 6,
    margin: 1,
    borderRadius: 8,
  },
  dayCellToday: { backgroundColor: COLORS.mintSoft },
  dayNum: { fontSize: 12, color: COLORS.inkSoft },
  dayNumDim: { color: '#C7C2B4' },
  dayNumToday: { color: COLORS.mint, fontWeight: '700' },
  dotRow: { flexDirection: 'row', gap: 3, marginTop: 4 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 100,
    backgroundColor: COLORS.paperRaise,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  chipActive: { backgroundColor: COLORS.mint, borderColor: COLORS.mint },
  chipText: { fontSize: 13, color: COLORS.inkSoft },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },

  deadlineCardWrap: { position: 'relative', marginBottom: 10 },
  deadlineCard: {
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
  deadlineInfo: { flex: 1 },
  deadlineTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  matchBadge: { fontSize: 10.5, fontWeight: '700', color: COLORS.mint },
  matchBadgeFail: { color: COLORS.inkSoft },
  matchBadgeAlmost: { color: COLORS.amber },
  deadlineCat: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  deadlineTitle: { fontSize: 14, fontWeight: '600', color: COLORS.ink, marginTop: 3 },
  deadlineMeta: { fontSize: 11.5, color: COLORS.inkSoft, marginTop: 4 },
  emptyText: { fontSize: 13, color: COLORS.inkSoft, marginBottom: 12 },

  heartButton: { position: 'absolute', top: 10, right: 10, padding: 4 },
  heartIcon: { fontSize: 16 },

  matchBanner: {
    backgroundColor: COLORS.ink,
    borderRadius: 14,
    padding: 18,
    marginTop: 8,
  },
  matchNum: { fontSize: 24, fontWeight: '700', color: '#FFFFFF' },
  matchPercent: { color: '#7BD8B0' },
  matchDesc: { fontSize: 12, color: '#B8C2DC', marginTop: 6, lineHeight: 18 },
  matchCriterion: { fontSize: 11.5, color: '#B8C2DC', marginTop: 4 },
  matchCriterionUnmet: { color: '#E8A7A0' },
});
