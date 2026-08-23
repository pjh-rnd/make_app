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

// 광역 행정구역 — 자유 텍스트로 입력받으면 "서울"/"서울시"/"서울특별시"처럼 사람마다 다르게
// 적어서 매칭이 실패하는 문제가 있었음. 시/도는 개수가 고정돼 있어서 선택형으로 바꿈.
// 광주광역시+전라남도는 실제로 "전남광주통합특별시"로 통합된 상태라(2026-08-23 확인, 위키백과
// 기준 현재 정식 광역자치단체명 — scripts/syncYouthPolicies.js가 정책 데이터에서 이미 이
// 이름으로 저장 중) 옛 두 항목 대신 이 하나만 둠. 정책 쪽 지역 필터/자격 판정과 문자열이
// 정확히 같아야 매칭되므로(정식 명칭 그대로), 여기 이름도 반드시 똑같이 맞춰야 함.
export const PROVINCE_OPTIONS = [
  '서울특별시',
  '부산광역시',
  '대구광역시',
  '인천광역시',
  '전남광주통합특별시',
  '대전광역시',
  '울산광역시',
  '세종특별자치시',
  '경기도',
  '강원특별자치도',
  '충청북도',
  '충청남도',
  '전북특별자치도',
  '경상북도',
  '경상남도',
  '제주특별자치도',
];

// 시/도 아래 행정구역 구조 — 서울/부산 같은 "특별시·광역시"는 그 아래가 바로 구/군이라 "시/군"
// 단계가 없고(kind: 'metro'), 경기도 같은 "도"는 그 아래가 시/군이라(kind: 'province') "거주지
// (시/군)" 필드가 그때만 의미가 있음. metro는 districts(구/군 목록)를, province는 cities(시/군
// 목록)를 가짐 — "거주지 (구)"는 도 안의 일부 시(수원시 등)에만 더 있는 단계라 여기선 자유 입력으로
// 남겨두고, metro일 때만 그 시/도의 구/군 목록으로 드롭다운(칩)을 보여줌.
// 세종특별자치시는 구/군 자체가 없어서 districts를 빈 배열로 둠.
export type ProvinceRegionInfo =
  | { kind: 'metro'; districts: string[] }
  | { kind: 'province'; cities: string[] };

export const REGION_DATA: Record<string, ProvinceRegionInfo> = {
  서울특별시: {
    kind: 'metro',
    districts: [
      '종로구', '중구', '용산구', '성동구', '광진구', '동대문구', '중랑구', '성북구', '강북구',
      '도봉구', '노원구', '은평구', '서대문구', '마포구', '양천구', '강서구', '구로구', '금천구',
      '영등포구', '동작구', '관악구', '서초구', '강남구', '송파구', '강동구',
    ],
  },
  부산광역시: {
    kind: 'metro',
    districts: [
      '중구', '서구', '동구', '영도구', '부산진구', '동래구', '남구', '북구', '해운대구', '사하구',
      '금정구', '강서구', '연제구', '수영구', '사상구', '기장군',
    ],
  },
  대구광역시: {
    kind: 'metro',
    districts: ['중구', '동구', '서구', '남구', '북구', '수성구', '달서구', '달성군', '군위군'],
  },
  인천광역시: {
    kind: 'metro',
    districts: [
      '중구', '동구', '미추홀구', '연수구', '남동구', '부평구', '계양구', '서구', '강화군', '옹진군',
    ],
  },
  // 원래 광주광역시(자치구 5개)와 전라남도(시/군 22개)가 따로 있었는데, 실제 통합된 지금은
  // 하나의 시/도 안에 구와 시/군이 섞여 있음 — kind: 'province'/'metro' 두 종류뿐인 기존 타입엔
  // 이런 "둘 다 있는" 경우가 없어서, 일단 구+시/군을 한 목록(cities)으로 합쳐 'province'로 둠
  // (아래에서 시/군을 고르면 "거주지 (시/군)" 단계로 보임 — 구 5개도 그 목록 안에 같이 있음).
  전남광주통합특별시: {
    kind: 'province',
    cities: [
      '동구', '서구', '남구', '북구', '광산구',
      '목포시', '여수시', '순천시', '나주시', '광양시', '담양군', '곡성군', '구례군', '고흥군',
      '보성군', '화순군', '장흥군', '강진군', '해남군', '영암군', '무안군', '함평군', '영광군',
      '장성군', '완도군', '진도군', '신안군',
    ],
  },
  대전광역시: { kind: 'metro', districts: ['동구', '중구', '서구', '유성구', '대덕구'] },
  울산광역시: { kind: 'metro', districts: ['중구', '남구', '동구', '북구', '울주군'] },
  세종특별자치시: { kind: 'metro', districts: [] },
  경기도: {
    kind: 'province',
    cities: [
      '수원시', '성남시', '의정부시', '안양시', '부천시', '광명시', '평택시', '동두천시', '안산시',
      '고양시', '과천시', '구리시', '남양주시', '오산시', '시흥시', '군포시', '의왕시', '하남시',
      '용인시', '파주시', '이천시', '안성시', '김포시', '화성시', '광주시', '양주시', '포천시',
      '여주시', '연천군', '가평군', '양평군',
    ],
  },
  강원특별자치도: {
    kind: 'province',
    cities: [
      '춘천시', '원주시', '강릉시', '동해시', '태백시', '속초시', '삼척시', '홍천군', '횡성군',
      '영월군', '평창군', '정선군', '철원군', '화천군', '양구군', '인제군', '고성군', '양양군',
    ],
  },
  충청북도: {
    kind: 'province',
    cities: [
      '청주시', '충주시', '제천시', '보은군', '옥천군', '영동군', '증평군', '진천군', '괴산군',
      '음성군', '단양군',
    ],
  },
  충청남도: {
    kind: 'province',
    cities: [
      '천안시', '공주시', '보령시', '아산시', '서산시', '논산시', '계룡시', '당진시', '금산군',
      '부여군', '서천군', '청양군', '홍성군', '예산군', '태안군',
    ],
  },
  전북특별자치도: {
    kind: 'province',
    cities: [
      '전주시', '군산시', '익산시', '정읍시', '남원시', '김제시', '완주군', '진안군', '무주군',
      '장수군', '임실군', '순창군', '고창군', '부안군',
    ],
  },
  경상북도: {
    kind: 'province',
    cities: [
      '포항시', '경주시', '김천시', '안동시', '구미시', '영주시', '영천시', '상주시', '문경시',
      '경산시', '의성군', '청송군', '영양군', '영덕군', '청도군', '고령군', '성주군', '칠곡군',
      '예천군', '봉화군', '울진군', '울릉군',
    ],
  },
  경상남도: {
    kind: 'province',
    cities: [
      '창원시', '진주시', '통영시', '사천시', '김해시', '밀양시', '거제시', '양산시', '의령군',
      '함안군', '창녕군', '고성군', '남해군', '하동군', '산청군', '함양군', '거창군', '합천군',
    ],
  },
  제주특별자치도: { kind: 'province', cities: ['제주시', '서귀포시'] },
};

export function getRegionInfo(province: string | null | undefined): ProvinceRegionInfo | null {
  if (!province) return null;
  return REGION_DATA[province] ?? null;
}

// 도(kind: 'province') 안에서도 인구가 많은 일부 시는 그 아래에 "일반구"가 더 있음
// (예: 수원시 → 장안구/권선구/팔달구/영통구). 목록에 없는 시/군은 그 아래 구 자체가 없는 곳.
export const CITY_DISTRICTS: Record<string, string[]> = {
  수원시: ['장안구', '권선구', '팔달구', '영통구'],
  성남시: ['수정구', '중원구', '분당구'],
  안양시: ['만안구', '동안구'],
  안산시: ['상록구', '단원구'],
  고양시: ['덕양구', '일산동구', '일산서구'],
  용인시: ['처인구', '기흥구', '수지구'],
  청주시: ['상당구', '서원구', '흥덕구', '청원구'],
  천안시: ['동남구', '서북구'],
  전주시: ['완산구', '덕진구'],
  포항시: ['남구', '북구'],
  창원시: ['의창구', '성산구', '마산합포구', '마산회원구', '진해구'],
};

// "거주지 (구)" 필드가 지금 상황에서 실제로 의미가 있는지 — metro는 districts가 있어야(세종 제외),
// province는 시/군을 고른 다음 그 시가 CITY_DISTRICTS에 있어야(수원시 등) 의미가 있음
export function isRegionDistrictApplicable(
  province: string | null | undefined,
  city: string | null | undefined
): boolean {
  const info = getRegionInfo(province);
  if (!info) return false;
  if (info.kind === 'metro') return info.districts.length > 0;
  return !!city && !!CITY_DISTRICTS[city];
}

// fieldKey에 맞는 "구/군" 옵션 목록을 돌려줌 (metro면 그 시/도의 구/군, province+시면 그 시의 구)
export function getDistrictOptions(
  province: string | null | undefined,
  city: string | null | undefined
): string[] {
  const info = getRegionInfo(province);
  if (!info) return [];
  if (info.kind === 'metro') return info.districts;
  return (city && CITY_DISTRICTS[city]) || [];
}

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

// countFilledFields와 짝을 이루는 분모 — metro(특별시/광역시)면 "거주지 (시/군)" 필드가, 구가 없는
// 시/군이면 "거주지 (구)" 필드가 화면에서 아예 숨겨지니 그만큼 분모도 줄여야 완성도가 100%에 닿을 수 있음
export function effectiveTotalFieldCount(
  province: string | null | undefined,
  city?: string | null
): number {
  let total = TOTAL_FIELD_COUNT;
  if (getRegionInfo(province)?.kind === 'metro') total -= 1; // region_city 안 씀
  if (!isRegionDistrictApplicable(province, city)) total -= 1; // region_district 안 씀
  return total;
}

// 프로필에서 실제로 값이 채워진 필드 개수를 셈 (boolean은 true/false 둘 다 "입력됨"으로 침, null만 미입력).
// 특별시/광역시(서울 등)는 "거주지 (시/군)" 단계 자체가 없고, "구"도 상황에 따라 없을 수 있어서
// 화면에서 필드를 숨기는데, 그 상태로 두면 이 필드를 절대 못 채우니 완성도가 100%에 못 닿게 됨 —
// 그래서 해당 안 되는 필드는 계산에서 뺌.
export function countFilledFields(profile: Profile | null): number {
  if (!profile) return 0;
  return ALL_FIELDS.filter((f) => {
    if (f.key === 'region_city' && getRegionInfo(profile.region_province)?.kind === 'metro') return false;
    if (f.key === 'region_district' && !isRegionDistrictApplicable(profile.region_province, profile.region_city))
      return false;
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
