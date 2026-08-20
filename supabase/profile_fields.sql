-- 프로필 상세 입력 필드 추가. Supabase 대시보드 > SQL Editor 에서 실행해주세요.
-- 기존 age/region/income_level/housing_status 컬럼은 그대로 두되(데이터 보존), 앱은 이제 아래 새 필드들을 씁니다.

alter table public.profiles
  -- 개인정보
  add column if not exists birth_date date,
  add column if not exists is_university_student boolean,
  add column if not exists is_job_seeker boolean,
  add column if not exists region_province text,   -- 예: 서울특별시
  add column if not exists region_city text,        -- 예: (광역시/도 산하 시·군, 특별시는 비워둘 수 있음)
  add column if not exists region_district text,    -- 예: 관악구

  -- 개인 소득/자산 (금액은 전부 만원 단위)
  add column if not exists personal_monthly_income bigint,
  add column if not exists personal_assets bigint,
  add column if not exists owns_house boolean,
  add column if not exists owns_car boolean,

  -- 가족정보
  add column if not exists family_member_count integer,
  add column if not exists family_type text,  -- 예: 1인가구 / 부모동거 / 한부모가족 등 자유 입력

  -- 가구 소득/자산 (금액은 전부 만원 단위)
  add column if not exists household_monthly_income bigint,
  add column if not exists household_assets bigint,
  add column if not exists household_owns_house boolean,
  add column if not exists household_owns_car boolean,

  -- 추가정보
  add column if not exists university_location text,
  add column if not exists income_base_location text,
  add column if not exists subscription_account_payment_count integer,
  add column if not exists subscription_account_payment_amount bigint, -- 만원 단위
  add column if not exists subscription_account_payment_period integer, -- 개월 수
  add column if not exists parents_income bigint, -- 만원 단위
  add column if not exists parents_assets bigint, -- 만원 단위
  add column if not exists parents_car_value bigint, -- 만원 단위
  add column if not exists parents_count integer,
  add column if not exists is_basic_livelihood_recipient boolean,
  add column if not exists is_near_poverty boolean,
  add column if not exists is_supported_single_parent_family boolean;
