-- 온통청년 API에서 긁어온 실제 청년정책 데이터를 담는 테이블. data/deadlines.ts의 하드코딩 mock을
-- 대체하는 게 목표(Phase 3). scripts/syncYouthPolicies.js가 service_role 키로 주기적으로
-- upsert함 — 일반 사용자는 절대 쓰지 못하고(RLS로 막음) 오직 그 스크립트만 씀.
--
-- saved_policies/profiles와 다르게 "누구 것"이 아니라 그냥 공개된 정책 목록이라, RLS는
-- "로그인한 사용자면 전부 읽기 가능" 하나만 있으면 됨(쓰기는 service_role만, RLS를 아예
-- 우회하므로 별도 insert/update 정책 자체가 필요 없음).
create table if not exists public.policies (
  id text primary key, -- 온통청년 plcyNo 그대로 씀 (안정적인 고유 id)
  category_id text not null, -- 우리 앱 카테고리(housing/money/job/edu/welfare)로 매핑한 값
  category text not null, -- 카테고리 한글 라벨(주거/자산/취업/교육/복지) — category_id와 항상 짝
  title text not null,
  meta text not null default '', -- 카드에 짧게 보여줄 한 줄 요약(주관기관 · 중분류 등으로 조합)
  detail text not null default '',
  org_name text, -- 주관기관명(sprvsnInstCdNm)

  -- 마감일 캘린더가 이 앱의 핵심이라 있으면 제일 좋지만, 온통청년 정책 중 상당수가 "연중/상시모집"
  -- 이라 명확한 기간이 없음 — 그런 건 start_date/deadline_date를 NULL로 두고 is_rolling=true로
  -- 표시함(캘린더엔 안 찍히지만 "상시모집" 배지로 목록엔 계속 보이게 함, 사용자 요청사항)
  start_date date,
  deadline_date date,
  is_rolling boolean not null default false,

  -- lib/matching.ts의 Requirements 타입과 같은 모양(maxAge/maxPersonalMonthlyIncome/
  -- maxHouseholdMonthlyIncome/requiresNoHouse/regionKeyword)의 jsonb. 온통청년 원본 필드 중
  -- 소득 조건(earnCndSeCd 등)은 공통코드 조회 없이는 정확히 해석 불가라 지금은 대부분 비워둠
  -- (연령 조건만 비교적 신뢰도 높게 채움) — 정확도보다 "아예 틀린 조건으로 거르지 않는 것"을 우선함
  requirements jsonb not null default '{}'::jsonb,

  perks text[] not null default '{}', -- 온통청년엔 없는 필드라 항상 빈 배열(수동 큐레이션 전까지)
  links jsonb not null default '[]'::jsonb, -- [{label, url}, ...] — 신청 URL 등

  raw jsonb, -- 원본 API 응답 그대로 보관(나중에 매핑 로직 고칠 때 다시 API 안 불러도 되게)
  synced_at timestamptz not null default now()
);

alter table public.policies enable row level security;

drop policy if exists "authenticated can read policies" on public.policies;
create policy "authenticated can read policies"
  on public.policies for select
  to authenticated
  using (true);

-- 목록/캘린더에서 자주 쓰는 정렬·필터 기준에 인덱스
create index if not exists policies_deadline_date_idx on public.policies (deadline_date);
create index if not exists policies_category_id_idx on public.policies (category_id);
