-- 정책 상세 화면의 "정책 요약"/지원대상/지원내용/신청방법/준비서류 섹션용 사람이 직접 쓴(=AI가
-- 원문을 읽고 정리한) 요약 테이블(2026-08-23 추가).
-- Supabase 대시보드 > SQL Editor 에서 이 내용을 실행해주세요.
--
-- ⚠️ 이 테이블은 scripts/syncYouthPolicies.js(온통청년 API에서 정책을 자동으로 긁어오는
-- 스크립트)가 절대 안 건드림 — policies 테이블은 재동기화할 때마다 통째로 다시 채워지는데,
-- 이 요약은 그때그때 자동 생성이 안 되고(진짜 AI가 원문을 읽고 판단해서 써야 함) 사람이
-- (Claude Code 세션에서) 정책 하나하나 직접 읽고 채워넣는 데이터라서, policies 테이블과
-- 분리해뒀음 — 안 그러면 재동기화할 때마다 애써 써둔 요약이 날아감.
create table if not exists public.policy_ai_summaries (
  policy_id text primary key references public.policies(id) on delete cascade,

  -- "정책 요약" 박스 — 3줄, 친근한 말투(~해요)
  summary_intro text not null, -- 정책 안내 한 줄
  summary_support text not null, -- 지원내용 한 줄
  summary_apply text not null, -- 신청방법 한 줄

  -- 아래 4개는 전부 "-" 불릿 목록(두괄식/개조식 문체, ~해요 안 씀)
  target_detail text[] not null default '{}', -- 지원대상
  support_detail text[] not null default '{}', -- 지원내용
  apply_method_detail text[] not null default '{}', -- 신청방법
  documents_detail text[] not null default '{}', -- 준비서류 및 준비사항

  generated_at timestamptz not null default now()
);

alter table public.policy_ai_summaries enable row level security;

-- policies 테이블과 같은 패턴: 로그인 사용자면 조회만 가능, 쓰기는 service_role(스크립트)로만
create policy "Authenticated users can view policy AI summaries"
  on public.policy_ai_summaries for select
  to authenticated
  using (true);

-- ⚠️ 아래는 2026-08-24 추가 마이그레이션 — 기존에 위 create table을 이미 실행해서 테이블이 있는
-- 상태라면, Supabase SQL Editor에서 이 부분만 다시 실행해주면 됨(add column if not exists라
-- 몇 번을 실행해도 안전함, 기존 데이터는 안 건드림).
--
-- "연중접수/상시모집"으로 뜨는 정책 중 실제로는 "예산 소진 시 조기마감"이거나 "연 N회 나눠서
-- 접수" 같은 진짜 운영 방식이 있는데, 지금은 전부 뭉뚱그려서 "상시 접수 · 신청 기간이 정해져
-- 있지 않아요"라고만 보여주고 있음(사용자 피드백) — 사람이 원문/공식 링크를 직접 찾아 확인해서
-- 채워넣는 데이터(이 테이블의 다른 컬럼들과 같은 방식, scripts/policyAiSummaries.js 참고).
-- rolling_detail이 있으면 상세 화면이 그 문장을 그대로 보여주고, 없으면 기존 문구로 자연스럽게
-- 대체됨(lib/usePolicyAiSummary.ts가 이 컬럼이 아직 없는 상태 — 마이그레이션 전 — 에도 에러 없이
-- 동작하도록 짜여 있음).
alter table public.policy_ai_summaries
  add column if not exists rolling_detail text, -- 예: "이 사업은 연 2~3회 나눠서 접수하며, 예산 소진 시 조기 마감될 수 있어요."
  add column if not exists final_apply_date date; -- 올해 마지막 회차 마감일을 확인할 수 있었을 때만 채움(못 찾았으면 null)
