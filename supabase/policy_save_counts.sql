-- 정책별 "찜 개수"(인기순 정렬/표시용) 뷰. Supabase 대시보드 > SQL Editor 에서 실행해주세요.
-- saved_policies 테이블의 SELECT RLS 정책이 "본인이 찜한 것만" 보이게 되어 있어서(saved_policies.sql
-- 참고), 그냥 테이블을 읽으면 각 사용자는 자기 자신이 찜한 것만 보이고 전체 개수를 알 수 없음.
-- 그렇다고 saved_policies 테이블 자체를 전체 공개하면 "누가 무엇을 찜했는지"까지 남들이 볼 수 있게
-- 되어 개인정보 문제가 생김 — 그래서 policy_id별 "개수"만 집계해서 보여주는 뷰를 따로 둠
-- (이 뷰엔 user_id가 안 들어있어서 누가 찜했는지는 여전히 비공개).
create or replace view public.policy_save_counts as
select policy_id, count(*)::int as save_count
from public.saved_policies
group by policy_id;

-- 뷰 자체는 RLS의 적용을 안 받으니, 로그인한 사용자라면 누구나 이 집계 결과는 읽을 수 있게 권한을 줌
grant select on public.policy_save_counts to authenticated;
