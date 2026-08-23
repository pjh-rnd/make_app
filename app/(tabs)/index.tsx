import { useFocusEffect } from '@react-navigation/native';
import { Link, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DeadlineCard, type DeadlineWithMatch } from '@/components/deadline-card';
import { FitMeLogo } from '@/components/fit-me-logo';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  CATEGORY_COLOR,
  CATEGORY_ICON,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  COLORS,
} from '@/constants/moa-colors';
import { buildMonthGrid, groupDeadlinesByDay, WEEKDAYS } from '@/lib/calendarUtils';
import { computeDday } from '@/lib/deadlineUtils';
import { calculateMatch } from '@/lib/matching';
import { usePolicies } from '@/lib/usePolicies';
import { usePolicySaveCounts } from '@/lib/usePolicySaveCounts';
import { useSavedPolicies } from '@/lib/useSavedPolicies';
import { useProfile } from '@/lib/useProfile';
import { useSession } from '@/lib/useSession';

// 검색 화면(app/search.tsx)의 인기순/지원 가능순 토글과 똑같이 서로 독립적인 체크박스형
// 토글임(배타적이지 않음) — 둘 다 켜면 검색 화면과 동일하게 인기순이 먼저 적용되고, 그 안에서
// 동점일 때만 지원 가능순으로 다시 나뉨. 둘 다 꺼져있으면 기본값(마감순)
function sortHomeList<
  T extends { id: string; deadlineDate: string | null; match: { criteria: { met: boolean }[] } },
>(items: T[], popular: boolean, eligible: boolean, saveCounts: Map<string, number>, closed = false): T[] {
  return [...items].sort((a, b) => {
    if (popular) {
      const aCount = saveCounts.get(a.id) ?? 0;
      const bCount = saveCounts.get(b.id) ?? 0;
      if (aCount !== bCount) return bCount - aCount;
    }
    if (eligible) {
      const aUnmet = a.match.criteria.filter((c) => !c.met).length;
      const bUnmet = b.match.criteria.filter((c) => !c.met).length;
      if (aUnmet !== bUnmet) return aUnmet - bUnmet;
    }
    // 상시모집(deadlineDate 없음)은 날짜 비교가 의미 없어서 항상 맨 뒤로 보냄
    if (a.deadlineDate == null && b.deadlineDate == null) return 0;
    if (a.deadlineDate == null) return 1;
    if (b.deadlineDate == null) return -1;
    if (closed) {
      return a.deadlineDate > b.deadlineDate ? -1 : a.deadlineDate < b.deadlineDate ? 1 : 0;
    }
    return a.deadlineDate < b.deadlineDate ? -1 : a.deadlineDate > b.deadlineDate ? 1 : 0;
  });
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
  const { profile, refresh: refreshProfile } = useProfile(session?.user.id);
  const { policies, refresh: refreshPolicies } = usePolicies();
  const { savedIds, toggle: toggleSaved, refresh: refreshSaved } = useSavedPolicies(
    session?.user.id,
    policies
  );
  const { counts: saveCounts, refresh: refreshSaveCounts } = usePolicySaveCounts();

  // 이 화면에 다시 돌아올 때마다(수정 화면·상세페이지에서 뒤로 왔을 때 등) 최신 프로필/정책/찜 목록을
  // 다시 불러옴(상세페이지에서 찜했는데 리스트가 예전 상태를 들고 있으면, 다시 찜하려다 "이미 있음"
  // 에러로 안 눌리는 것처럼 보임)
  useFocusEffect(
    useCallback(() => {
      refreshProfile();
      refreshPolicies();
      refreshSaved();
      refreshSaveCounts();
    }, [refreshProfile, refreshPolicies, refreshSaved, refreshSaveCounts])
  );

  const hasProfile = !!(
    profile &&
    (profile.birth_date ||
      profile.region_province ||
      profile.personal_monthly_income != null ||
      profile.owns_house != null)
  );

  // 검색 화면(app/search.tsx) 맨 위 카테고리 줄과 똑같은 방식 — "전체"가 켜져있으면 카테고리와
  // 무관하게 다 보여주고, 카테고리를 하나라도 직접 누르면 전체는 자동으로 꺼지고 누른 것들만(OR)
  // 보여줌. 마지막 남은 하나까지 꺼서 0개가 되면 자동으로 "전체"로 되돌림(검색 화면과 동일)
  const [showAllInterests, setShowAllInterests] = useState(true);
  const [interestIds, setInterestIds] = useState<Set<string>>(new Set());
  // 캘린더에서 점(dot) 찍힌 날짜를 탭하면 그 날의 "모든" 공고를 아래에 보여줌. 같은 날 다시 탭하면 해제.
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  // 날짜를 선택했을 때 카테고리별로 묶어 보여주는데, 그 중 접어둔(collapse) 카테고리 id 목록
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  // "마감" 섹션을 펼쳤는지 여부 — 기본은 접힌 상태(이미 끝난 거라 평소엔 안 보여도 됨)
  const [showClosedDeadlines, setShowClosedDeadlines] = useState(false);
  // "진행 중"(지금 신청 가능)·"예정"(아직 신청 시작 전) 두 섹션도 화살표로 각각 접고 펼 수 있게 함
  // — 기본은 둘 다 펼쳐진 상태. 전엔 이 둘이 "다가오는 마감" 하나로 합쳐져 있었는데, 지금 바로
  // 신청 가능한 것과 아직 시작 전인 것을 섞어서 보여주면 헷갈린다고 해서 나눔
  const [showActiveDeadlines, setShowActiveDeadlines] = useState(true);
  const [showBeforeDeadlines, setShowBeforeDeadlines] = useState(true);
  // "진행 중"·"예정"(그리고 날짜 선택 목록) 세 곳이 같이 쓰는 정렬 토글 — 검색 화면과 똑같이
  // 인기순/지원 가능순이 서로 독립적인 체크박스라 둘 다 켤 수 있음(배타적이지 않음).
  // 둘 다 꺼져있으면 기본값(마감순)
  const [homeSortPopular, setHomeSortPopular] = useState(false);
  const [homeSortEligible, setHomeSortEligible] = useState(false);

  function handleDayPress(day: number) {
    setSelectedDay((prev) => (prev === day ? null : day));
  }

  function toggleCategoryCollapse(catId: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }

  function toggleInterest(catId: string) {
    setInterestIds((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      // 마지막 하나를 꺼서 아무것도 안 남으면 "전체"로 되돌림
      setShowAllInterests(next.size === 0);
      return next;
    });
  }

  function selectAllInterests() {
    setShowAllInterests(true);
    setInterestIds(new Set());
  }

  // 켜져있는 칩들의 id 목록 — "전체"가 켜져있으면 CATEGORY_ORDER 전부
  const activeIds = showAllInterests ? CATEGORY_ORDER : Array.from(interestIds);

  // 홈 화면 = "내가 찜한 것만" 보여주는 달력/목록으로 바뀜(예전엔 전체 공고 중 관심분야로만
  // 걸렀는데, 찜한 정책 탭을 없애면서 그 역할을 여기로 합침) — savedIds에 없으면 관심분야가
  // 맞아도 아예 안 보임. 전체 공고를 둘러보고 싶을 땐 위 검색창(검색은 찜 여부와 무관하게 전체에서 찾음)을 씀

  // 달력 점도 관심분야 칩으로 필터링함 — 칩을 꺼도 점 색깔이 그대로면 "필터가 안 먹힌다"고
  // 오해하기 쉬워서, 켜진 카테고리의 점만 찍히게 함
  const deadlineDays = groupDeadlinesByDay(
    policies.filter((d) => activeIds.includes(d.categoryId) && savedIds.has(d.id)),
    viewYear,
    viewMonth
  );

  // 찜한 것 중에서 관심분야 칩으로 다시 좁혀나감 (날짜 선택도 이 목록엔 영향 안 줌 — 날짜를
  // 선택하면 관심분야+찜 기준에 한해 "그 날 시작하는 공고"를 아래에 따로 보여주기 때문)
  const filteredDeadlines = policies.filter(
    (d) => activeIds.includes(d.categoryId) && savedIds.has(d.id)
  );

  // 각 마감일마다 내 프로필과 비교해서 자격 여부 계산, 그 중 실제로 지원 가능한 것 하나를 배너에 띄움
  const deadlinesWithMatch = filteredDeadlines.map((d) => ({
    ...d,
    match: calculateMatch(profile, d.requirements),
  }));

  // computeDday의 phase에 그대로 맞춰서 세 섹션으로 나눔 —
  // "진행 중"(지금 신청 가능)·"예정"(아직 신청 시작 전)·"마감"(끝난 것, 기본은 접힌 상태).
  // 상시모집(phase: 'rolling')은 "언제든 신청 가능"이라는 점에서 진행 중과 같은 성격이라
  // 진행 중 섹션에 같이 넣음(2026-08-23, 실제 데이터 연동하면서 추가된 phase).
  // longterm(장기/다회차)도 같은 이유로 같이 넣음(2026-08-23, 마감일 자체를 못 믿는 것뿐이지
  // 신청 자체는 지금도 가능한 상태라서 — lib/deadlineUtils.ts LONG_TERM_SPAN_DAYS 주석 참고).
  // 사용자가 고른 인기순/지원 가능순 토글(homeSortPopular/homeSortEligible)을 그대로 적용함
  const activeDeadlines = sortHomeList<DeadlineWithMatch>(
    deadlinesWithMatch.filter((d) => {
      const phase = computeDday(d.startDate, d.deadlineDate).phase;
      return phase === 'active' || phase === 'rolling' || phase === 'longterm';
    }),
    homeSortPopular,
    homeSortEligible,
    saveCounts
  );
  const beforeDeadlines = sortHomeList<DeadlineWithMatch>(
    deadlinesWithMatch.filter((d) => computeDday(d.startDate, d.deadlineDate).phase === 'before'),
    homeSortPopular,
    homeSortEligible,
    saveCounts
  );
  const closedDeadlines = sortHomeList<DeadlineWithMatch>(
    deadlinesWithMatch.filter((d) => computeDday(d.startDate, d.deadlineDate).phase === 'closed'),
    homeSortPopular,
    homeSortEligible,
    saveCounts,
    true
  );

  // 날짜를 선택했을 때: 찜한 것 중 켜져있는 관심분야에 한해서, 그 날짜에 "신청이 시작"되는
  // 공고를 카테고리별로 묶음 (달력 점이 startDate 기준이라, 목록도 점과 똑같은 기준으로 보여줘야 서로 안 어긋남)
  const selectedDayDeadlines =
    selectedDay === null
      ? []
      : policies
          .filter((d) => {
            if (!activeIds.includes(d.categoryId) || !savedIds.has(d.id)) return false;
            if (!d.startDate) return false; // 상시모집은 특정 날짜가 없어서 날짜별 목록엔 안 잡힘(달력 점도 안 찍힘)
            const dt = new Date(d.startDate);
            return (
              dt.getFullYear() === viewYear &&
              dt.getMonth() === viewMonth &&
              dt.getDate() === selectedDay
            );
          })
          .map((d) => ({ ...d, match: calculateMatch(profile, d.requirements) }));
  // 날짜 선택 시에도 진행 중/예정과 똑같은 인기순/지원 가능순 토글을 씀
  const selectedDayGroups = CATEGORY_ORDER.map((catId) => ({
    catId,
    items: sortHomeList<DeadlineWithMatch>(
      selectedDayDeadlines.filter((d) => d.categoryId === catId),
      homeSortPopular,
      homeSortEligible,
      saveCounts
    ),
  })).filter((g) => g.items.length > 0);

  // "다가오는 마감" 목록과 날짜별 카테고리 그룹 목록이 카드 UI를 그대로 공유해서 컴포넌트로 뺌
  // (검색 화면도 똑같은 컴포넌트를 씀 — components/deadline-card.tsx)
  function renderDeadlineCard(d: (typeof deadlinesWithMatch)[number]) {
    return (
      <DeadlineCard
        key={d.id}
        item={d}
        hasProfile={hasProfile}
        isSaved={savedIds.has(d.id)}
        // 찜 개수(saveCounts)는 화면 focus 때만 새로고침되는데, 그럼 방금 누른 찜이 카드에
        // 바로 반영이 안 되고 다른 화면 갔다 와야 보임 — 그래서 찜 누른 직후에도 바로 새로고침함
        onToggleSave={async () => {
          await toggleSaved({ id: d.id, title: d.title, deadlineDate: d.deadlineDate });
          refreshSaveCounts();
        }}
        saveCount={saveCounts.get(d.id) ?? 0}
      />
    );
  }

  // 진행 중/예정/마감 섹션과 날짜별 목록이 똑같이 쓰는 정렬 토글 — 검색 화면과 똑같이 인기순/
  // 지원 가능순이 서로 독립적인 체크박스라 둘 다 켤 수 있음(기본값은 마감순)
  function renderSortToggle() {
    return (
      <View style={styles.homeSortRow}>
        <Pressable
          onPress={() => setHomeSortPopular((v) => !v)}
          style={[styles.sortChip, homeSortPopular && styles.chipActive]}>
          <Text style={[styles.chipText, homeSortPopular && styles.chipTextActive]}>
            인기순
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setHomeSortEligible((v) => !v)}
          style={[styles.sortChip, homeSortEligible && styles.chipActive]}>
          <Text style={[styles.chipText, homeSortEligible && styles.chipTextActive]}>
            지원 가능순
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <View>
          <FitMeLogo compact />
          <Text style={styles.brandSub}>나에게 맞는 청년정책 캘린더</Text>
        </View>
        {/* 연두(lime) 계열 대신 "주거" 카테고리 색(COLORS.mint, 초록 계열)보다 더 연한 톤을 씀 */}
        <View style={styles.topBarButtons}>
          <Link href="/notifications" asChild>
            <Pressable style={styles.myPageButton} hitSlop={8}>
              <IconSymbol name="bell.fill" size={24} color="#9FDAC0" />
            </Pressable>
          </Link>
          <Link href="/edit-profile" asChild>
            <Pressable style={styles.myPageButton} hitSlop={8}>
              <IconSymbol name="person.crop.circle.fill" size={24} color="#9FDAC0" />
            </Pressable>
          </Link>
        </View>
      </View>

      {/* 검색 — 누르면 검색 화면(app/search.tsx)으로 이동함(관심분야 칩과 무관하게 전체 공고에서
          찾아줌). 예전엔 Modal로 이 화면 위에 띄웠는데, 그러면 검색 결과에서 카드를 눌러 상세로
          이동할 때 모달을 닫아야 해서 홈 화면이 잠깐 보였다 사라지는 어색함이 있었음. 진짜
          네비게이션 화면으로 만들어서 홈 → 검색 → 상세로 자연스럽게 쌓이고 뒤로가기도 매끄러움.
          달력보다 위, 화면 맨 위에 둬서 항상 먼저 보이게 함 */}
      <Pressable style={styles.searchTrigger} onPress={() => router.push('/search')}>
        <View style={styles.searchTriggerTextWrap}>
          <Text style={styles.searchTriggerHint} numberOfLines={1}>
            모든 공고가 보고싶다면?
          </Text>
          <Text style={styles.searchTriggerText} numberOfLines={1}>
            나와 &apos;Fit&apos;한 공고 &apos;찜&apos;하기!
          </Text>
        </View>
        {/* 검색창 느낌이 나게 오른쪽 끝에 돋보기 아이콘을 얹음 */}
        <Text style={styles.searchTriggerIcon}>🔍</Text>
      </Pressable>

      {/* 달력 — 개인정보 카드보다 먼저 보여줌 (마감일 한눈에 보는 게 이 화면의 핵심).
          찜한 게 없어도 달력/진행 중/예정/마감 구성은 그대로 유지하고, 빈 상태는 각 섹션 안의
          "~ 없어요" 문구가 자연스럽게 알려줌(따로 화면을 통째로 안내문으로 바꾸지 않음) */}
      <View style={styles.calendarHeaderRow}>
        <Pressable onPress={goToPrevMonth} hitSlop={8} style={styles.monthNavButton}>
          <Text style={styles.monthNavText}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{viewYear}년 {viewMonth + 1}월</Text>
        <Pressable onPress={goToNextMonth} hitSlop={8} style={styles.monthNavButton}>
          <Text style={styles.monthNavText}>›</Text>
        </Pressable>
      </View>

      {/* 관심 분야 칩 — 검색 화면 맨 위 줄과 똑같은 구성(전체 + CATEGORY_ORDER 전부). 달력 점 색깔이
          뭘 뜻하는지 여기서 바로 고를 수 있음. 끄면 그 카테고리 점이 달력에서도 사라지고,
          목록에서도 빠짐 (칩과 달력이 항상 같은 기준으로 맞춰짐). 좁은 화면에서도 항상 한 줄로
          보이게 가로 스크롤로 둠(줄바꿈 대신 스크롤) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipRowScroll}
        contentContainerStyle={styles.chipRow}>
        <Pressable
          onPress={selectAllInterests}
          style={[
            styles.categoryChip,
            showAllInterests && { backgroundColor: '#4FC3EE', borderColor: '#4FC3EE' },
          ]}>
          <Text style={[styles.categoryChipText, showAllInterests && styles.chipTextActive]}>
            전체
          </Text>
        </Pressable>
        {CATEGORY_ORDER.map((catId) => {
          const active = !showAllInterests && interestIds.has(catId);
          return (
            <Pressable
              key={catId}
              onPress={() => toggleInterest(catId)}
              style={[
                styles.categoryChip,
                active && { backgroundColor: CATEGORY_COLOR[catId], borderColor: CATEGORY_COLOR[catId] },
              ]}>
              <Text style={[styles.categoryChipText, active && styles.chipTextActive]}>
                {CATEGORY_ICON[catId]} {CATEGORY_LABEL[catId]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.calendar}>
        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((w, wi) => (
            <Text
              key={w}
              style={[styles.weekdayText, (wi === 0 || wi === 6) && styles.weekdayTextWeekend]}>
              {w}
            </Text>
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
              const dots = cell.inMonth ? deadlineDays[cell.day] : undefined;
              const isSelected = cell.inMonth && selectedDay === cell.day;
              // 일(ci=0)·토(ci=6) 칸은 요일 헤더와 같은 기준으로 빨간색 표기
              const isWeekend = ci === 0 || ci === 6;
              return (
                <Pressable
                  key={ci}
                  disabled={!cell.inMonth || !dots}
                  onPress={() => handleDayPress(cell.day)}
                  style={[
                    styles.dayCell,
                    isToday && styles.dayCellToday,
                    isSelected && styles.dayCellSelected,
                  ]}>
                  <Text
                    style={[
                      styles.dayNum,
                      isWeekend && styles.dayNumWeekend,
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
                          style={[styles.dot, { backgroundColor: CATEGORY_COLOR[d.categoryId] }]}
                        />
                      ))}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
        <Text style={styles.calendarHint}>캘린더는 &apos;찜&apos;한 공고 신청 시작일을 표시합니다</Text>
      </View>
      {selectedDay !== null && (
        <Pressable onPress={() => setSelectedDay(null)} style={styles.selectedDayBanner}>
          <Text style={styles.selectedDayBannerText}>
            {viewMonth + 1}월 {selectedDay}일 시작 공고 {selectedDayDeadlines.length}건 보는 중 · 눌러서 해제
          </Text>
        </Pressable>
      )}

      {selectedDay === null ? (
        <>
          {renderSortToggle()}

          {/* 진행 중 — 지금 바로 신청 가능한 것(phase: 'active'). 관심분야 칩 필터가 적용됨
              (검색은 위 검색창 → 별도 전체화면 결과). 전엔 "예정"과 합쳐서 "다가오는 마감" 하나였는데,
              지금 신청 가능한 거랑 아직 시작 전인 걸 섞어서 보여주면 헷갈린다고 해서 나눔 */}
          <View style={styles.categoryGroup}>
            <Pressable
              onPress={() => setShowActiveDeadlines((v) => !v)}
              style={styles.categoryGroupHeader}>
              <View style={styles.categoryGroupHeaderLeft}>
                <Text style={styles.categoryGroupTitle}>진행 중</Text>
                <Text style={styles.categoryGroupCount}>{activeDeadlines.length}</Text>
              </View>
              <Text style={styles.categoryGroupChevron}>{showActiveDeadlines ? '▾' : '▸'}</Text>
            </Pressable>
            {showActiveDeadlines && activeDeadlines.length === 0 && (
              <Text style={styles.emptyText}>선택된 관심 분야에 해당하는 진행 중인 공고가 없어요</Text>
            )}
            {showActiveDeadlines && activeDeadlines.map(renderDeadlineCard)}
          </View>

          {/* 예정 — 아직 신청 시작 전인 것(phase: 'before') */}
          <View style={styles.categoryGroup}>
            <Pressable
              onPress={() => setShowBeforeDeadlines((v) => !v)}
              style={styles.categoryGroupHeader}>
              <View style={styles.categoryGroupHeaderLeft}>
                <Text style={styles.categoryGroupTitle}>예정</Text>
                <Text style={styles.categoryGroupCount}>{beforeDeadlines.length}</Text>
              </View>
              <Text style={styles.categoryGroupChevron}>{showBeforeDeadlines ? '▾' : '▸'}</Text>
            </Pressable>
            {showBeforeDeadlines && beforeDeadlines.length === 0 && (
              <Text style={styles.emptyText}>선택된 관심 분야에 해당하는 예정 공고가 없어요</Text>
            )}
            {showBeforeDeadlines && beforeDeadlines.map(renderDeadlineCard)}
          </View>

          {/* 마감 — 전엔 0건이면 섹션 자체를 숨겼는데, 그러면 진행 중/예정이랑 다르게 갑자기
              사라진 것처럼 보여서(특히 찜한 게 마감된 건 없을 때) 다른 두 섹션과 똑같이
              항상 보이게 하고 0건일 땐 빈 문구만 보여줌 */}
          <View style={styles.categoryGroup}>
            <Pressable
              onPress={() => setShowClosedDeadlines((v) => !v)}
              style={styles.categoryGroupHeader}>
              <View style={styles.categoryGroupHeaderLeft}>
                <Text style={styles.categoryGroupTitle}>마감</Text>
                <Text style={styles.categoryGroupCount}>{closedDeadlines.length}</Text>
              </View>
              <Text style={styles.categoryGroupChevron}>{showClosedDeadlines ? '▾' : '▸'}</Text>
            </Pressable>
            {showClosedDeadlines && closedDeadlines.length === 0 && (
              <Text style={styles.emptyText}>선택된 관심 분야에 해당하는 마감된 공고가 없어요</Text>
            )}
            {showClosedDeadlines && closedDeadlines.map(renderDeadlineCard)}
          </View>
        </>
      ) : (
        <>
          {/* 날짜 선택 시 — 그 날 "신청이 시작"되는 공고를 카테고리별로 묶어서 보여줌.
              카테고리 헤더를 눌러 접고 펼 수 있음(토글). 여기서도 위와 똑같은 정렬 토글을 보여줘서
              어떤 기준으로 정렬돼있는지 알 수 있게 함 */}
          <Text style={styles.sectionLabel}>
            {viewMonth + 1}월 {selectedDay}일에 시작하는 공고
          </Text>
          {renderSortToggle()}
          {selectedDayGroups.length === 0 && (
            <Text style={styles.emptyText}>이 날 신청이 시작되는 공고가 없어요</Text>
          )}
          {selectedDayGroups.map((group) => {
            const collapsed = collapsedCategories.has(group.catId);
            return (
              <View key={group.catId} style={styles.categoryGroup}>
                <Pressable
                  onPress={() => toggleCategoryCollapse(group.catId)}
                  style={styles.categoryGroupHeader}>
                  <View style={styles.categoryGroupHeaderLeft}>
                    <View
                      style={[styles.legendDot, { backgroundColor: CATEGORY_COLOR[group.catId] }]}
                    />
                    <Text style={styles.categoryGroupTitle}>{CATEGORY_LABEL[group.catId]}</Text>
                    <Text style={styles.categoryGroupCount}>{group.items.length}</Text>
                  </View>
                  <Text style={styles.categoryGroupChevron}>{collapsed ? '▸' : '▾'}</Text>
                </Pressable>
                {!collapsed && group.items.map(renderDeadlineCard)}
              </View>
            );
          })}
        </>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.paper },
  // 예전엔 좌우 20px이라 검색 화면 위쪽 줄들(10~16px)보다 여백이 넉넉해서 양옆이 더 좁아
  // 보였음 — 좌우를 5px로 줄여서 화면 가장자리에 훨씬 가깝게 붙게 함
  content: { paddingHorizontal: 11, paddingTop: 60, paddingBottom: 40 },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  // "Fit Me" 글자 자체는 이제 components/fit-me-logo.tsx(FitMeLogo)가 그림 — 폰트 선택 로직도 거기로 옮김.
  // FitMeLogo(compact)가 자기 안에 좌우 padding을 갖고 있어서 글자가 살짝 안쪽에서 시작하는데,
  // 그 시작 위치에 맞춰 marginLeft를 줘서 부제목이 "Fit Me" 글자 바로 아래 정렬되게 함
  brandSub: { fontSize: 12, color: COLORS.inkSoft, marginTop: 2, marginLeft: 18 },
  topBarButtons: { flexDirection: 'row', gap: 4 },
  // 예전엔 이 버튼들에 흰 원(배경+테두리)을 씌웠었는데, 뒤로가기 화살표(<)를 감싸던 흰 원을
  // 없앴던 것처럼 여기도 그냥 아이콘만 남기고 원형 배경은 없앰
  myPageButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionLabel: {
    fontSize: 17.6,
    fontWeight: '700',
    color: COLORS.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 4,
  },

  // 검색 화면(app/search.tsx)의 categoryChipScroll/categoryChipRow와 값을 똑같이 맞춤
  // (간격·글자크기·칩 크기가 서로 다르면 같은 종류의 칩인데 왜 다르게 보이나 헷갈리기 쉬움)
  chipRowScroll: { height: 64, marginBottom: 8 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 12 },

  // 카테고리 칩(주거/자산/취업/교육/복지) 전용 — 검색 화면(app/search.tsx)의 카테고리 칩도
  // 똑같은 값을 씀(글자 크기로 강조하는 디자인이라 두 군데가 늘 맞아야 함)
  categoryChip: {
    paddingVertical: 8,
    paddingHorizontal: 9,
    borderRadius: 100,
    backgroundColor: COLORS.paperRaise,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  categoryChipText: { fontSize: 15.5, fontWeight: '700', color: COLORS.inkSoft },

  searchTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: COLORS.paperRaise,
    marginBottom: 20,
  },
  searchTriggerTextWrap: { flex: 1 },
  searchTriggerHint: { fontSize: 18, fontWeight: '700', color: COLORS.mint },
  searchTriggerText: { fontSize: 13.5, fontWeight: '600', color: COLORS.ink, marginTop: 5 },
  searchTriggerIcon: { fontSize: 20, color: COLORS.inkSoft, marginLeft: 10 },

  calendarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 4,
    marginTop: 4,
  },
  monthNavButton: { paddingHorizontal: 10, paddingVertical: 2 },
  monthNavText: { fontSize: 28, fontWeight: '700', color: COLORS.inkSoft },
  // sectionLabel(원래 "다가오는 마감" 등에도 같이 쓰던 작은 라벨)에서 분리 — 여기 월 표시만 두 배로 키움
  monthLabel: { fontSize: 22, fontWeight: '700', color: COLORS.ink },

  // 카테고리 그룹 헤더의 작은 색 점(범례 역할) — 관심분야 칩 배경색으로 이미 색을 보여주고 있어서
  // 별도 범례 줄은 없앴고, 이 dot만 날짜별 그룹 헤더에 남겨둠
  legendDot: { width: 8, height: 8, borderRadius: 4 },

  calendar: {
    backgroundColor: COLORS.paperRaise,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  // 달력 점이 "신청 시작일" 기준이라는 걸 안내하는 작은 문구 — 마감일이 아니라서 헷갈릴 수 있어서
  calendarHint: {
    fontSize: 10.5,
    color: COLORS.inkSoft,
    textAlign: 'right',
    marginTop: 6,
    opacity: 0.7,
  },
  weekdayRow: { flexDirection: 'row', marginBottom: 4 },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.inkSoft,
  },
  weekdayTextWeekend: { color: '#E0483F' },
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
  dayCellSelected: { borderWidth: 1.5, borderColor: COLORS.mint },
  dayNum: { fontSize: 15, color: COLORS.inkSoft },
  dayNumWeekend: { color: '#E0483F' },
  dayNumDim: { color: '#C7C2B4' },
  dayNumToday: { color: COLORS.mint, fontWeight: '700' },
  // 한 줄에 점 3개까지만 두고 그 이상은 다음 줄로 넘김(5개면 3/2로 보임) — maxWidth를
  // "점 3개 + 사이 여백 2칸" 너비로 딱 맞춰서 4번째 점부터 강제로 줄바꿈되게 함
  dotRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 3, marginTop: 4, maxWidth: 21 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  selectedDayBanner: {
    backgroundColor: COLORS.mintSoft,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  selectedDayBannerText: { fontSize: 12, color: COLORS.mint, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },

  // "진행 중"·"예정" 정렬 토글(인기순/마감순) — 검색 화면 정렬 칩과 같은 크기감으로 맞춤
  homeSortRow: { flexDirection: 'row', gap: 8, marginBottom: 0 },
  sortChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 100,
    backgroundColor: COLORS.paperRaise,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  chipActive: { backgroundColor: COLORS.mint, borderColor: COLORS.mint },
  chipText: { fontSize: 13.7, color: COLORS.inkSoft },

  emptyText: { fontSize: 13, color: COLORS.inkSoft, marginBottom: 12 },

  categoryGroup: { marginBottom: 16 },
  categoryGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  categoryGroupHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  categoryGroupTitle: { fontSize: 17, fontWeight: '700', color: COLORS.ink },
  categoryGroupCount: { fontSize: 13, color: COLORS.inkSoft },
  categoryGroupChevron: { fontSize: 27, color: COLORS.inkSoft, fontWeight: '700' },
});
