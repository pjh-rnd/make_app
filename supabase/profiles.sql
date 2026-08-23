-- 사용자별 프로필 테이블. 이 앱에서 제일 처음(회원가입/로그인 기능 만들 때) 실행했던 SQL이라
-- 원래는 파일로 안 남겨뒀었는데, 나중에 기록 확인하다가 헷갈릴 수 있어서 지금 파일로 남겨둠.
--
-- ⚠️ 이미 아주 예전에 실행돼서 profiles 테이블이 이미 존재함 — 다시 실행하면
-- "relation profiles already exists" 에러가 남. 참고용으로만 남겨둔 파일이고, 실제로
-- Supabase SQL Editor에서 다시 실행할 필요는 없음.
--
-- 이후 profile_fields.sql이 여기에 birth_date/region_province 등 훨씬 자세한 필드들을
-- 추가로 얹었음(age/region/income_level/housing_status라는 초기 필드는 그대로 보존됨).
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  age int,
  region text,
  income_level text,
  housing_status text,
  updated_at timestamptz default now()
);

-- 이 테이블에 자물쇠(RLS) 걸기
alter table public.profiles enable row level security;

-- "내 데이터만 내가 볼 수 있음" 정책
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);
