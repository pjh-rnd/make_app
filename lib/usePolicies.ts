import { useCallback, useEffect, useState } from 'react';

import type { Deadline } from '@/data/deadlines';
import { supabase } from '@/lib/supabase';

// 실제 청년정책 데이터 — Supabase public.policies 테이블(scripts/syncYouthPolicies.js가 온통청년
// API에서 주기적으로 채워넣음, supabase/policies.sql 참고)에서 읽어옴. 2026-08-23부터 앱 화면들이
// data/deadlines.ts의 mock 대신 이 훅을 씀. DB 컬럼은 snake_case인데 앱은 전부 camelCase(Deadline
// 타입, data/deadlines.ts)를 쓰니까 여기서 한 번에 변환함.
type PolicyRow = {
  id: string;
  category_id: string;
  category: string;
  title: string;
  meta: string;
  detail: string;
  start_date: string | null;
  deadline_date: string | null;
  requirements: Deadline['requirements'];
  perks: string[];
  links: Deadline['links'];
};

function mapRow(row: PolicyRow): Deadline {
  return {
    id: row.id,
    categoryId: row.category_id,
    category: row.category,
    title: row.title,
    meta: row.meta,
    detail: row.detail,
    startDate: row.start_date,
    deadlineDate: row.deadline_date,
    // DB 컬럼들이 not null default('{}'/'[]')라 보통 항상 값이 있지만, 방어적으로 폴백 처리
    requirements: row.requirements ?? {},
    perks: row.perks ?? [],
    links: row.links ?? [],
  };
}

// 홈 화면, 검색 화면, 알림 화면, 상세 화면이 usePolicies()를 각자 따로 부르는데(기존 useProfile/
// useSavedPolicies 훅들과 같은 패턴), 화면 이동할 때마다(useFocusEffect로 매번 refresh 호출) 매번
// Supabase를 새로 왕복하면 그때마다 ~1초 정도 로딩 지연이 눈에 보임 — 특히 홈 화면에서 이미
// 받아온 데이터를 검색 화면 들어갈 때 또 처음부터 기다리는 게 어색했음(2026-08-23 사용자 피드백).
// 그래서 모듈 스코프(컴포넌트 밖, 앱 전체에서 공유됨)에 마지막으로 받아온 데이터를 캐시해두고,
// 캐시가 있으면 그걸 먼저 즉시 보여준 다음(로딩 화면 없이) 최신 데이터를 조용히 백그라운드에서
// 다시 받아와서 갱신함 — 첫 진입(앱을 막 켰을 때)만 실제로 기다리고, 그 뒤로는 화면을 옮겨다녀도
// 바로바로 보임.
let cachedPolicies: Deadline[] | null = null;

export function usePolicies() {
  const [policies, setPolicies] = useState<Deadline[]>(cachedPolicies ?? []);
  const [loading, setLoading] = useState(cachedPolicies === null);

  const refresh = useCallback(async () => {
    // 캐시가 있으면 로딩 상태 없이 기존 데이터를 그대로 유지한 채 백그라운드에서만 갱신함
    if (cachedPolicies === null) {
      setLoading(true);
    }
    // PostgREST 기본 응답 상한이 1000행이라, 지금(500여 건)보다 데이터가 꽤 늘어나도 한 번에
    // 다 받아오게 넉넉히 range를 지정해둠(2000행까지)
    const { data, error } = await supabase
      .from('policies')
      .select('id, category_id, category, title, meta, detail, start_date, deadline_date, requirements, perks, links')
      .range(0, 1999);

    if (error) {
      // 테이블을 아직 안 만들었거나 동기화를 안 돌렸을 때도 앱이 죽지 않게(빈 목록으로 보임) 경고만 남기고 넘어감
      console.warn('[usePolicies] 조회 실패(supabase/policies.sql 실행 및 npm run sync-policies 여부 확인):', error.message);
      setLoading(false);
      return;
    }

    const mapped = (data ?? []).map(mapRow);
    cachedPolicies = mapped;
    setPolicies(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { policies, loading, refresh };
}
