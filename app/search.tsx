import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { DeadlineCard } from '@/components/deadline-card';
import { HeaderBackButton } from '@/components/header-back-button';
import {
  CATEGORY_COLOR,
  CATEGORY_ICON,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  COLORS,
} from '@/constants/moa-colors';
import { computeDday } from '@/lib/deadlineUtils';
import { calculateMatch } from '@/lib/matching';
import { usePolicies } from '@/lib/usePolicies';
import { usePolicySaveCounts } from '@/lib/usePolicySaveCounts';
import { useProfile } from '@/lib/useProfile';
import { useSavedPolicies } from '@/lib/useSavedPolicies';
import { useSession } from '@/lib/useSession';

// 예전엔 홈 화면 안에서 <Modal>로 띄웠는데, 그러면 카드를 눌러 상세 화면으로 이동할 때
// 모달을 닫아야만 상세 화면이 안 가려져서(모달=화면 전체를 덮는 별도 레이어라 내비게이션과 무관하게
// 항상 맨 위에 뜸) "홈 화면이 잠깐 보였다가 상세로 넘어가는" 어색한 순간이 생겼고, 뒤로 나올 때도
// 마찬가지였음. 이 화면을 아예 진짜 네비게이션 스택 화면으로 만들면(홈 → 검색 → 상세 순서로 쌓임)
// 그런 우회가 필요 없어짐 — 카드 누르면 검색 화면 위에 상세 화면이 바로 쌓이고, 뒤로가면 검색
// 화면이 있던 상태 그대로(스크롤 위치 포함) 다시 보임.
export default function SearchScreen() {
  const { session } = useSession();
  const { profile, refresh: refreshProfile } = useProfile(session?.user.id);
  const { policies, refresh: refreshPolicies } = usePolicies();
  const { savedIds, toggle: toggleSaved, refresh: refreshSaved } = useSavedPolicies(
    session?.user.id,
    policies
  );
  const { counts: saveCounts, refresh: refreshSaveCounts } = usePolicySaveCounts();

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

  const [searchQuery, setSearchQuery] = useState('');
  // 홈 화면 관심분야 칩과는 독립적인 자기만의 카테고리 필터. "전체"가 켜져있으면 카테고리와
  // 무관하게 다 보여주고, 카테고리를 하나라도 직접 누르면 전체는 자동으로 꺼지고 누른 것들만(OR)
  // 보여줌 — 마지막 남은 하나까지 꺼서 0개가 되면 자동으로 "전체"로 되돌림(아래 toggleSearchCategory
  // 참고). 예전엔 0개 선택 상태를 그대로 뒀었는데, 그 상태에서 검색 결과가 무조건 0건이 되는 것도
  // 안 좋고, 위쪽 카테고리 칩 줄 높이가 이상하게 커지는 렌더링 버그도 있어서 그 상태 자체를 없앰
  const [searchShowAllCategories, setSearchShowAllCategories] = useState(true);
  const [searchCategoryIds, setSearchCategoryIds] = useState<Set<string>>(new Set());
  // 정렬/필터 토글 4개 — 서로 배타적이지 않고 동시에 켤 수 있음(체크박스처럼 각자 독립).
  // 마감일 빠른 순 정렬은 항상 기본 적용이라 따로 토글을 안 둠.
  // "찜만 보기"는 정렬 우선순위가 아니라 순수 필터임(excludeClosed와 같은 성격) — 찜한 것만
  // 남긴 다음, 그 안에서도 진행 중·예정은 마감일 빠른 순, 마감된 건 최근에 마감된 순으로 정렬됨
  const [pinEligible, setPinEligible] = useState(false);
  const [pinPopular, setPinPopular] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [excludeClosed, setExcludeClosed] = useState(true);

  function toggleSearchCategory(catId: string) {
    setSearchCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      // 마지막 하나를 꺼서 아무것도 안 남으면 "전체"로 되돌림
      setSearchShowAllCategories(next.size === 0);
      return next;
    });
  }

  function selectAllSearchCategories() {
    setSearchShowAllCategories(true);
    setSearchCategoryIds(new Set());
  }

  const trimmedQuery = searchQuery.trim();

  // 검색어가 비어있으면 텍스트 필터링 없이 전체 공고를 다 보여줌(빈칸 상태로 열려도 뭐라도 보이게)
  const searchResults = (
    trimmedQuery === ''
      ? policies
      : policies.filter(
          (d) =>
            d.title.includes(trimmedQuery) ||
            d.category.includes(trimmedQuery) ||
            d.meta.includes(trimmedQuery)
        )
  )
    .filter((d) => searchShowAllCategories || searchCategoryIds.has(d.categoryId))
    .map((d) => ({ ...d, match: calculateMatch(profile, d.requirements) }));

  const visibleSearchResults = searchResults
    .filter((d) => !excludeClosed || computeDday(d.startDate, d.deadlineDate).phase !== 'closed')
    .filter((d) => !savedOnly || savedIds.has(d.id));

  // "지원 가능순"/"인기순"이 켜져있으면 그 순서대로 먼저 적용됨 — 사용자가 직접 켠 정렬
  // 기준이라, 마감된 공고라도 인기 많으면 그 기준으로 위로 올라올 수 있음(마감된 게 아예 보기
  // 싫으면 "마감된 공고 제외"를 쓰면 됨). 아무 정렬도 안 켜져 있을 때만 마감된 건 기본으로
  // 맨 아래로 보내고, 그 안에서/그 외에서는 마감일 순으로 정렬함
  const sortedSearchResults = [...visibleSearchResults].sort((a, b) => {
    if (pinEligible) {
      const aEligible = a.match.eligible ? 0 : 1;
      const bEligible = b.match.eligible ? 0 : 1;
      if (aEligible !== bEligible) return aEligible - bEligible;
    }
    if (pinPopular) {
      const aCount = saveCounts.get(a.id) ?? 0;
      const bCount = saveCounts.get(b.id) ?? 0;
      if (aCount !== bCount) return bCount - aCount; // 찜 많은 게 위로 오게 내림차순
    }

    // 위 정렬 기준들로 승부가 안 났을 때(다 꺼져있거나 값이 같을 때)의 기본 정렬 —
    // 마감된 건 여기서만 맨 아래로 보냄. 마감일 오름차순만 쓰면 이미 지난 날짜(마감된 것)가
    // 숫자상 더 작아서 오히려 맨 위로 올라와버리는 문제가 있었음
    const aClosed = computeDday(a.startDate, a.deadlineDate).phase === 'closed';
    const bClosed = computeDday(b.startDate, b.deadlineDate).phase === 'closed';
    if (aClosed !== bClosed) return aClosed ? 1 : -1;

    // 마감된 공고끼리는 "최근에 마감된 것 → 오래전에 마감된 것" 순(내림차순)으로,
    // 그 외(진행 중·예정·상시모집)는 마감일 빠른 순(오름차순)으로 정렬함.
    // 상시모집(deadlineDate 없음)은 phase !== 'closed'라 이 블록으로 오는데, 날짜 비교가 의미
    // 없어서 그 안에서는 항상 맨 뒤로 보냄(aClosed/bClosed가 true면 computeDday 로직상
    // deadlineDate가 항상 있는 게 보장되지만, 아래 분기는 non-null임을 타입스크립트가 몰라서
    // 그 경우엔 단언(!)을 씀)
    if (aClosed && bClosed) {
      return a.deadlineDate! > b.deadlineDate! ? -1 : a.deadlineDate! < b.deadlineDate! ? 1 : 0;
    }
    if (a.deadlineDate == null && b.deadlineDate == null) return 0;
    if (a.deadlineDate == null) return 1;
    if (b.deadlineDate == null) return -1;
    return a.deadlineDate < b.deadlineDate ? -1 : a.deadlineDate > b.deadlineDate ? 1 : 0;
  });

  return (
    <View style={styles.screen}>
      {/* 이 화면의 headerShown:false는 app/_layout.tsx에서 다른 화면들과 같이 선언함
          (여기서 <Stack.Screen>으로 직접 선언했더니 적용이 안 돼서 기본 헤더가 떴었음) */}
      <View style={styles.header}>
        <HeaderBackButton />
        <TextInput
          style={styles.input}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="모든 공고 확인 후 나와 'Fit'한 공고 '찜'하기!"
          placeholderTextColor="#B6B0A0"
          autoFocus
        />
      </View>

      {/* 카테고리 칩 — 홈 화면 관심분야 칩과는 별개로, 검색 결과 안에서만 걸러줌.
          "전체"가 켜져있는 동안은 개별 카테고리를 눌러도 색이 안 들어옴(전체 모드에선 개별 선택
          의미가 없어서) — 개별 카테고리를 누르는 순간 전체가 자동으로 꺼지고 그때부터 색이 켜짐.
          "전체"는 카테고리가 아니라서 CATEGORY_ORDER엔 없고, 맨 왼쪽에 하늘색으로 따로 얹음 */}
      {/* ScrollView 자체의 style={{height}}만으로는 안 먹힐 때가 있어서(내부 콘텐츠 크기를
          측정해서 그 크기로 다시 부풀리는 경우가 있음), 바깥에 높이 고정된 일반 View를 하나 더
          씌우고 overflow:hidden으로 확실하게 그 높이 밖으로 못 나가게 막음 */}
      <View style={styles.categoryChipWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryChipRow}>
          <Pressable
            onPress={selectAllSearchCategories}
            style={[
              styles.categoryChip,
              // COLORS.sky는 "교육" 카테고리 색이랑 같은 값이라 여기서 그대로 쓰면 너무 진한 파랑으로
              // 보여서, "전체" 칩만 더 밝은 진짜 하늘색(skyblue)을 따로 씀
              searchShowAllCategories && { backgroundColor: '#4FC3EE', borderColor: '#4FC3EE' },
            ]}>
            <Text style={[styles.categoryChipText, searchShowAllCategories && styles.chipTextActive]}>
              전체
            </Text>
          </Pressable>
          {CATEGORY_ORDER.map((catId) => {
            const active = !searchShowAllCategories && searchCategoryIds.has(catId);
            return (
              <Pressable
                key={catId}
                onPress={() => toggleSearchCategory(catId)}
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
      </View>

      {/* 정렬/필터 토글 4개 — 인기순·지원 가능순·찜만 보기·마감된 공고 제외. "전체"는 카테고리
          칩 줄로 옮겨갔고, 여긴 서로 배타적이지 않아서 전부 동시에 켤 수 있음.
          위 카테고리 줄과 똑같이 바깥 View로 높이를 고정함(overflow:hidden) */}
      <View style={styles.sortRowWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortRow}>
          <Pressable
            onPress={() => setPinPopular((v) => !v)}
            style={[styles.sortChip, pinPopular && styles.chipActive]}>
            <Text style={[styles.chipText, pinPopular && styles.chipTextActive]}>인기순</Text>
          </Pressable>
          <Pressable
            onPress={() => setPinEligible((v) => !v)}
            style={[styles.sortChip, pinEligible && styles.chipActive]}>
            <Text style={[styles.chipText, pinEligible && styles.chipTextActive]}>지원 가능순</Text>
          </Pressable>
          <Pressable
            onPress={() => setSavedOnly((v) => !v)}
            style={[styles.sortChip, savedOnly && styles.chipActive]}>
            <Text style={[styles.chipText, savedOnly && styles.chipTextActive]}>찜만 보기</Text>
          </Pressable>
          <Pressable
            onPress={() => setExcludeClosed((v) => !v)}
            style={[styles.sortChip, excludeClosed && styles.chipActive]}>
            <Text style={[styles.chipText, excludeClosed && styles.chipTextActive]}>마감된 공고 제외</Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* scripts/syncYouthPolicies.js가 온통청년 API에서 데이터를 가져올 때 이미 이 기간
          기준으로 걸러서 Supabase에 저장하기 때문에(너무 많아서), 검색해도 이 범위 밖의 공고는
          애초에 목록에 없음 — 사용자가 "왜 이것밖에 안 나오지?" 헷갈리지 않게 안내해둠 */}
      <Text style={styles.syncWindowHint}>
        마감 2주 이내 · 시작 1달 이내인 공고만 모아봤어요
      </Text>

      {/* keyboardShouldPersistTaps="handled" — 이게 없으면 키보드가 떠있는 상태에서 카드를 눌렀을 때
          첫 탭은 키보드만 내려가고(터치가 카드까지 안 전달됨) 한 번 더 눌러야 이동되는 문제가 있음 */}
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        {sortedSearchResults.length === 0 ? (
          <Text style={styles.emptyText}>검색 결과가 없어요</Text>
        ) : (
          sortedSearchResults.map((d) => (
            <DeadlineCard
              key={d.id}
              item={d}
              hasProfile={hasProfile}
              isSaved={savedIds.has(d.id)}
              onToggleSave={async () => {
                await toggleSaved({ id: d.id, title: d.title, deadlineDate: d.deadlineDate });
                refreshSaveCounts();
              }}
              saveCount={saveCounts.get(d.id) ?? 0}
            />
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
    gap: 12,
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.ink,
    backgroundColor: COLORS.paperRaise,
  },

  categoryChip: {
    paddingVertical: 8,
    paddingHorizontal: 9,
    borderRadius: 100,
    backgroundColor: COLORS.paperRaise,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  categoryChipText: { fontSize: 15.5, fontWeight: '700', color: COLORS.inkSoft },
  // ScrollView 자체의 style={{height}}만 줬을 때 검색어를 입력해서 결과가 0건이 되면 이 줄
  // 높이가 갑자기 커졌다가 검색어를 지우면 다시 줄어드는 버그가 있었음 — ScrollView가 내부
  // 콘텐츠 크기를 다시 측정해서 자기 프레임을 그 크기로 부풀리는 경우가 있는 걸로 보임.
  // 그래서 바깥에 일반 View로 높이를 고정하고 overflow:hidden으로 확실히 못 벗어나게 막음
  categoryChipWrap: { height: 64, overflow: 'hidden' },
  categoryChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 0,
  },
  // 굵은 구분선(rowDivider) 대신 이 배경색 하나만으로 위 카테고리 칩 줄과 구분되게 함.
  // 위/아래 padding을 똑같이 줘서 칩들이 회색 영역 안에서 정확히 세로 가운데에 오게 함.
  // 배경색은 바깥 Wrap View에 줘야 칩보다 내용이 짧을 때도 줄 전체가 회색으로 채워짐
  // — contentContainerStyle(sortRow)에 배경을 주면 칩들 폭만큼만 칠해짐
  sortRowWrap: { height: 46, overflow: 'hidden', backgroundColor: '#E3E1D9' },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    minWidth: '100%',
  },
  // 첫 번째 줄(categoryChip)보다 일부러 작게 둬서 대비되게 함
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
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },

  // 홈 화면 calendarHint와 같은 톤(작고 흐릿한 안내 문구)으로 맞춤
  syncWindowHint: {
    fontSize: 11,
    color: COLORS.inkSoft,
    textAlign: 'center',
    opacity: 0.7,
    paddingTop: 8,
    paddingBottom: 2,
  },

  content: { padding: 20, paddingBottom: 40 },
  emptyText: { fontSize: 13, color: COLORS.inkSoft, marginTop: 8 },
});
