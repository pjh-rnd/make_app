import type { Profile } from '@/lib/useProfile';

export type FieldType = 'text' | 'number' | 'date' | 'boolean' | 'money' | 'picker';
export type FieldConfig = {
  key: keyof Profile;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: string[]; // type: 'picker'일 때만 씀
};
export type SectionConfig = { title: string; fields: FieldConfig[] };

// 17개 광역 행정구역 — 자유 텍스트로 입력받으면 "서울"/"서울시"/"서울특별시"처럼 사람마다 다르게
// 적어서 매칭이 실패하는 문제가 있었음. 시/도는 개수가 고정돼 있어서 선택형으로 바꿈.
export const PROVINCE_OPTIONS = [
  '서울특별시',
  '부산광역시',
  '대구광역시',
  '인천광역시',
  '광주광역시',
  '대전광역시',
  '울산광역시',
  '세종특별자치시',
  '경기도',
  '강원특별자치도',
  '충청북도',
  '충청남도',
  '전북특별자치도',
  '전라남도',
  '경상북도',
  '경상남도',
  '제주특별자치도',
];

// 큰 틀(SectionConfig) 5개 × 작은 틀(FieldConfig). edit-profile.tsx가 이 배열로 폼을 그리고,
// index.tsx가 이 배열로 "몇 개 입력했는지" 완성도를 계산함 — 필드 하나 추가/삭제할 땐 여기만 고치면 됨.
// money 타입 필드는 전부 "만원" 단위로 저장/표시함 (원 단위 아님).
export const SECTIONS: SectionConfig[] = [
  {
    title: '개인정보',
    fields: [
      { key: 'birth_date', label: '생년월일', type: 'date', placeholder: 'YYYY-MM-DD' },
      { key: 'is_university_student', label: '대학생 여부', type: 'boolean' },
      { key: 'is_job_seeker', label: '취업준비생 여부', type: 'boolean' },
      { key: 'region_province', label: '거주지 (시/도)', type: 'picker', options: PROVINCE_OPTIONS },
      { key: 'region_city', label: '거주지 (시/군)', type: 'text', placeholder: '해당 없으면 비워두기' },
      { key: 'region_district', label: '거주지 (구)', type: 'text', placeholder: '예: 관악구' },
    ],
  },
  {
    title: '개인 소득 / 자산',
    fields: [
      { key: 'personal_monthly_income', label: '월 평균 소득', type: 'money' },
      { key: 'personal_assets', label: '자산', type: 'money' },
      { key: 'owns_house', label: '주택 소유 여부', type: 'boolean' },
      { key: 'owns_car', label: '자동차 소유 여부', type: 'boolean' },
    ],
  },
  {
    title: '가족 정보',
    fields: [
      { key: 'family_member_count', label: '가족 구성원 수', type: 'number' },
      { key: 'family_type', label: '가족 형태', type: 'text', placeholder: '예: 1인가구, 부모동거 등' },
    ],
  },
  {
    title: '가구 소득 / 자산',
    fields: [
      { key: 'household_monthly_income', label: '월 평균 소득', type: 'money' },
      { key: 'household_assets', label: '자산', type: 'money' },
      { key: 'household_owns_house', label: '주택 소유 여부', type: 'boolean' },
      { key: 'household_owns_car', label: '자동차 소유 여부', type: 'boolean' },
    ],
  },
  {
    title: '추가정보',
    fields: [
      { key: 'university_location', label: '대학 소재지', type: 'text' },
      { key: 'income_base_location', label: '소득 근거지', type: 'text' },
      { key: 'subscription_account_payment_count', label: '청약통장 납입 횟수', type: 'number' },
      { key: 'subscription_account_payment_amount', label: '청약통장 납입 금액', type: 'money' },
      {
        key: 'subscription_account_payment_period',
        label: '청약통장 납입 기간',
        type: 'number',
        placeholder: '단위: 개월',
      },
      { key: 'parents_income', label: '부모님 소득', type: 'money' },
      { key: 'parents_assets', label: '부모님 자산', type: 'money' },
      { key: 'parents_car_value', label: '부모님 차량가액', type: 'money' },
      { key: 'parents_count', label: '부모님 수', type: 'number' },
      { key: 'is_basic_livelihood_recipient', label: '기초생활 수급자 여부', type: 'boolean' },
      { key: 'is_near_poverty', label: '차상위계층 여부', type: 'boolean' },
      { key: 'is_supported_single_parent_family', label: '지원대상 한부모가족 여부', type: 'boolean' },
    ],
  },
];

export const ALL_FIELDS: FieldConfig[] = SECTIONS.flatMap((s) => s.fields);
export const TOTAL_FIELD_COUNT = ALL_FIELDS.length;

// 프로필에서 실제로 값이 채워진 필드 개수를 셈 (boolean은 true/false 둘 다 "입력됨"으로 침, null만 미입력)
export function countFilledFields(profile: Profile | null): number {
  if (!profile) return 0;
  return ALL_FIELDS.filter((f) => {
    const value = profile[f.key];
    return value !== null && value !== undefined && value !== '';
  }).length;
}

// 개인 → 가구 항목으로 그대로 복사할 때 쓰는 대응표 ("개인정보와 동일" 버튼용)
export const HOUSEHOLD_COPY_MAP: [keyof Profile, keyof Profile][] = [
  ['personal_monthly_income', 'household_monthly_income'],
  ['personal_assets', 'household_assets'],
  ['owns_house', 'household_owns_house'],
  ['owns_car', 'household_owns_car'],
];
