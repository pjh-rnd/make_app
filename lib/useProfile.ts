import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

// 큰 틀 5개(개인정보 / 개인 소득·자산 / 가족정보 / 가구 소득·자산 / 추가정보)로 묶은 프로필 필드.
// edit-profile.tsx의 섹션 구성과 1:1로 대응됨.
export type Profile = {
  id: string;

  // 개인정보
  birth_date: string | null; // 'YYYY-MM-DD'
  is_university_student: boolean | null;
  is_job_seeker: boolean | null;
  region_province: string | null; // ~도/특별시
  region_city: string | null; // 시/군
  region_district: string | null; // 구

  // 개인 소득/자산
  personal_monthly_income: number | null; // 원
  personal_assets: number | null; // 원
  owns_house: boolean | null;
  owns_car: boolean | null;

  // 가족정보
  family_member_count: number | null;
  family_type: string | null;

  // 가구 소득/자산
  household_monthly_income: number | null;
  household_assets: number | null;
  household_owns_house: boolean | null;
  household_owns_car: boolean | null;

  // 추가정보
  university_location: string | null;
  income_base_location: string | null;
  subscription_account_payment_count: number | null;
  subscription_account_payment_amount: number | null;
  subscription_account_payment_period: number | null; // 개월
  parents_income: number | null;
  parents_assets: number | null;
  parents_car_value: number | null;
  parents_count: number | null;
  is_basic_livelihood_recipient: boolean | null;
  is_near_poverty: boolean | null;
  is_supported_single_parent_family: boolean | null;
};

// 생년월일로 만 나이 계산
export function calculateAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

// userId가 있으면 profiles 테이블에서 해당 유저의 row 하나를 가져오는 훅
export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // 화면에 다시 돌아올 때(useFocusEffect)마다 refresh가 또 불리는데, 그때마다 loading을
  // true로 바꾸면 "불러오는 중..." 텍스트로 잠깐 바뀌면서 화면 높이가 출렁여 튀어 보임.
  // 그래서 "이미 한 번 불러온 적 있는지"를 기억해뒀다가, 두 번째부터는 로딩 화면 없이 조용히 갱신함.
  const hasLoadedOnce = useRef(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    if (!hasLoadedOnce.current) setLoading(true);
    // maybeSingle: row가 없으면 에러 대신 null을 줌 (아직 프로필 설정 안 한 신규 유저 대응)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[useProfile] 프로필 조회 실패:', error.message);
    } else {
      setProfile(data);
    }
    hasLoadedOnce.current = true;
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { profile, loading, refresh };
}
