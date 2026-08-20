import { calculateAge, type Profile } from '@/lib/useProfile';

export type Requirements = {
  maxAge?: number;
  maxPersonalMonthlyIncome?: number; // 만원 단위, 개인 월 소득 상한
  maxHouseholdMonthlyIncome?: number; // 만원 단위, 가구 월 소득 상한
  requiresNoHouse?: boolean; // 개인 무주택 요건
  regionKeyword?: string; // 거주지(도/시/구) 중 하나에 이 단어가 포함돼야 함 (예: '서울', '관악')
};

export type MatchCriterion = { label: string; met: boolean };
export type MatchResult = { eligible: boolean; percent: number; criteria: MatchCriterion[] };

function formatManwon(amount: number): string {
  return `${amount.toLocaleString()}만원`;
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
      met: regionText.includes(requirements.regionKeyword),
    });
  }

  if (criteria.length === 0) {
    return { eligible: false, percent: 0, criteria };
  }

  // 이 조건들은 정부 지원사업의 "필수 자격요건"이라, 부분 충족이라는 게 없음.
  // 하나라도 만족 못하면 아예 신청 자격이 없는 거라서, 몇 개 맞았는지 평균 내지 않고
  // 전부(every) 만족했을 때만 자격이 있다고 판단함.
  const eligible = criteria.every((c) => c.met);
  return { eligible, percent: eligible ? 100 : 0, criteria };
}
