-- 찜한 정책에 예약해둔 알림의 id를 저장해두는 컬럼 추가 (취소할 때 필요).
-- saved_policies.sql을 이미 실행하셨다면, 이것만 추가로 Supabase SQL Editor에서 실행해주세요.

alter table public.saved_policies
  add column if not exists notification_id text;
