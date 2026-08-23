-- 정책 상세 화면 댓글 기능용 테이블(2026-08-23 추가). Supabase 대시보드 > SQL Editor 에서
-- 이 내용을 실행해주세요. (이 저장소엔 Supabase CLI/마이그레이션이 없어서, 다른 테이블들처럼
-- 수동으로 SQL Editor에서 실행하는 방식입니다.)

create table if not exists public.policy_comments (
  id uuid primary key default gen_random_uuid(),
  policy_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

-- 정책 하나 상세 화면 들어갈 때마다 그 정책 댓글만 최신순/등록순으로 조회하니 policy_id 기준
-- 인덱스가 필요함
create index if not exists policy_comments_policy_id_idx
  on public.policy_comments (policy_id, created_at);

alter table public.policy_comments enable row level security;

-- 이 앱은 로그인해야만 들어올 수 있는 구조라(app/(tabs)/_layout.tsx가 세션 없으면 /login으로
-- 보냄) 비로그인 열람을 따로 고려할 필요가 없음 — 로그인한 사용자면 전체 댓글을 다 볼 수 있음
create policy "Authenticated users can view comments"
  on public.policy_comments for select
  to authenticated
  using (true);

create policy "Users can insert own comments"
  on public.policy_comments for insert
  with check (auth.uid() = user_id);

-- 수정 기능은 없음(지우고 다시 쓰는 편이 더 단순함) — 본인 댓글만 삭제 가능
create policy "Users can delete own comments"
  on public.policy_comments for delete
  using (auth.uid() = user_id);
