-- 찜하기 기능용 테이블. Supabase 대시보드 > SQL Editor 에서 이 내용을 실행해주세요.
-- (이 저장소엔 Supabase CLI/마이그레이션이 없어서, profiles 테이블처럼 수동으로 SQL Editor에서 실행하는 방식입니다.)

create table if not exists public.saved_policies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, policy_id)
);

alter table public.saved_policies enable row level security;

-- 본인이 찜한 것만 보고/추가하고/지울 수 있게 제한
create policy "Users can view own saved policies"
  on public.saved_policies for select
  using (auth.uid() = user_id);

create policy "Users can insert own saved policies"
  on public.saved_policies for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own saved policies"
  on public.saved_policies for delete
  using (auth.uid() = user_id);
