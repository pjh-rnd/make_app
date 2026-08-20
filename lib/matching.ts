import type { Profile } from '@/lib/useProfile';

export type Requirements = {
  maxAge?: number;
  maxIncomePercent?: number; // 중위소득 몇% 이하까지 대상인지
  requiresNoHouse?: boolean;
};

export type MatchCriterion = { label: string; met: boolean };
export type MatchResult = { eligible: boolean; percent: number; criteria: MatchCriterion[] };

// "중위소득 90%" 같은 문자열에서 숫자 90만 뽑아내는 함수
function parseIncomePercent(incomeLevel: string | null | undefined): number | null {
  if (!incomeLevel) return null;
  const found = incomeLevel.match(/(\d+)\s*%/);
  return found ? Number(found[1]) : null;
}

// 프로필과 정책의 자격 조건을 비교해서, 몇 %나 맞는지 계산
export function calculateMatch(profile: Profile | null, requirements: Requirements): MatchResult {
  const criteria: MatchCriterion[] = [];

  if (requirements.maxAge != null) {
    criteria.push({
      label: `만 ${requirements.maxAge}세 이하`,
      met: profile?.age != null && profile.age <= requirements.maxAge,
    });
  }

  if (requirements.maxIncomePercent != null) {
    const incomePercent = parseIncomePercent(profile?.income_level);
    criteria.push({
      label: `중위소득 ${requirements.maxIncomePercent}% 이하`,
      met: incomePercent != null && incomePercent <= requirements.maxIncomePercent,
    });
  }

  if (requirements.requiresNoHouse) {
    criteria.push({
      label: '무주택자',
      met: !!profile?.housing_status?.includes('무주택'),
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
