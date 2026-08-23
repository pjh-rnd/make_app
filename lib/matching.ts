import { calculateAge, type Profile } from '@/lib/useProfile';

export type Requirements = {
  maxAge?: number;
  maxPersonalMonthlyIncome?: number; // 만원 단위, 개인 월 소득 상한
  maxHouseholdMonthlyIncome?: number; // 만원 단위, 가구 월 소득 상한
  requiresNoHouse?: boolean; // 개인 무주택 요건
  regionKeyword?: string; // 거주지(도/시/구) 중 하나에 이 단어가 포함돼야 함 (예: '서울', '관악')
  // regionKeyword보다 넓은 시/도 단위 값 (2026-08-23 검색 화면 지역 필터용으로 추가) — regionKeyword가
  // "평택시"처럼 시/군/구 단위로 더 구체화된 경우에도 regionProvince엔 그 상위 도("경기도")가 항상
  // 같이 들어있음. calculateMatch()의 자격 판정(지원 가능/조건 미충족 배지)엔 안 쓰고, 정확도가
  // 필요없는 "지역별로 대충 걸러보기" 용도인 app/search.tsx의 지역 필터 칩에서만 씀 — 시/군/구까지
  // 몇백 개를 칩으로 늘어놓을 수 없어서, 17개 시/도로만 굵게 거르고 세부 자격은 배지로 따로 보여줌.
  regionProvince?: string;
  // 아래 4개는 2026-08-23 추가 — 온통청년 원본 데이터의 학력요건코드(schoolCd)/취업요건코드(jobCd)/
  // 특화요건코드(sbizCd)에서 뽑아냄(scripts/syncYouthPolicies.js). 사용자가 "대학생 대상 공고인데
  // 프로필에 대학생 여부 넣어놨는데도 지원 가능으로 뜬다"고 지적해서 보니, Requirements 자체에
  // 이 조건들이 아예 없어서(연령/소득/무주택/지역 4개만 있었음) 프로필에 필드는 있어도 실제
  // 판정에는 전혀 안 쓰이고 있었음.
  requiresUniversityStudent?: boolean; // 학력요건이 "대학 재학"만 단독으로 걸린 경우만 true
  requiresJobSeeker?: boolean; // 취업요건이 "미취업자"만 단독으로 걸린 경우만 true
  requiresBasicLivelihoodRecipient?: boolean; // 특화요건에 "기초생활수급자"가 포함된 경우
  requiresSingleParentFamily?: boolean; // 특화요건에 "한부모가정"이 포함된 경우
};

export type MatchCriterion = { label: string; met: boolean };
export type MatchResult = { eligible: boolean; percent: number; criteria: MatchCriterion[] };

function formatManwon(amount: number): string {
  return `${amount.toLocaleString()}만원`;
}

// "서울특별시"/"서울시"/"서울"처럼 사람마다 다르게 적는 지역 표기를 매칭 비교용으로만 통일함
// (저장은 원래 텍스트 그대로 두고, 비교할 때만 접미사를 뗌)
function normalizeRegion(text: string): string {
  return text
    .replace(/특별자치시|특별자치도|광역시|특별시|자치도|자치시/g, '')
    .replace(/(.{2,})(도|시|군|구)$/, '$1')
    .trim();
}

// 프로필과 정책의 자격 조건을 비교해서, 몇 %나 맞는지 계산
export function calculateMatch(profile: Profile | null, requirements: Requirements): MatchResult {
  const criteria: MatchCriterion[] = [];

  if (requirements.maxAge != null) {
    const age = calculateAge(profile?.birth_date);
    criteria.push({
      label: `만 ${requirements.maxAge}세 이하`,
      met: age != null && age <= requirements.maxAge,
    });
  }

  if (requirements.maxPersonalMonthlyIncome != null) {
    criteria.push({
      label: `개인 월소득 ${formatManwon(requirements.maxPersonalMonthlyIncome)} 이하`,
      met:
        profile?.personal_monthly_income != null &&
        profile.personal_monthly_income <= requirements.maxPersonalMonthlyIncome,
    });
  }

  if (requirements.maxHouseholdMonthlyIncome != null) {
    criteria.push({
      label: `가구 월소득 ${formatManwon(requirements.maxHouseholdMonthlyIncome)} 이하`,
      met:
        profile?.household_monthly_income != null &&
        profile.household_monthly_income <= requirements.maxHouseholdMonthlyIncome,
    });
  }

  if (requirements.requiresNoHouse) {
    criteria.push({
      label: '무주택자',
      met: profile?.owns_house === false,
    });
  }

  if (requirements.regionKeyword) {
    const regionText = [profile?.region_province, profile?.region_city, profile?.region_district]
      .filter(Boolean)
      .join(' ');
    criteria.push({
      label: `${requirements.regionKeyword} 거주`,
      met: normalizeRegion(regionText).includes(normalizeRegion(requirements.regionKeyword)),
    });
  }

  if (requirements.requiresUniversityStudent) {
    criteria.push({
      label: '대학 재학 중',
      met: profile?.is_university_student === true,
    });
  }

  if (requirements.requiresJobSeeker) {
    criteria.push({
      label: '미취업 상태(구직 중)',
      met: profile?.is_job_seeker === true,
    });
  }

  if (requirements.requiresBasicLivelihoodRecipient) {
    criteria.push({
      label: '기초생활수급자',
      met: profile?.is_basic_livelihood_recipient === true,
    });
  }

  if (requirements.requiresSingleParentFamily) {
    criteria.push({
      label: '한부모가정',
      met: profile?.is_supported_single_parent_family === true,
    });
  }

  // 판정할 필수 조건을 하나도 못 찾았으면(연령/소득/무주택/지역 전부 데이터에 없는 경우) 자격이
  // 없는 게 아니라 반대로 "막는 조건이 없다"는 뜻이라 지원 가능이 맞음 — 예전엔 여기서 무조건
  // 자격 없음(eligible: false)으로 처리해서, 실제로는 아무 제한도 없는 정책들이 죄다 "조건
  // 미충족"으로 잘못 뜨고 있었음(2026-08-23 사용자가 발견).
  if (criteria.length === 0) {
    return { eligible: true, percent: 100, criteria };
  }

  // 이 조건들은 정부 지원사업의 "필수 자격요건"이라, 부분 충족이라는 게 없음.
  // 하나라도 만족 못하면 아예 신청 자격이 없는 거라서, 몇 개 맞았는지 평균 내지 않고
  // 전부(every) 만족했을 때만 자격이 있다고 판단함.
  const eligible = criteria.every((c) => c.met);
  return { eligible, percent: eligible ? 100 : 0, criteria };
}
