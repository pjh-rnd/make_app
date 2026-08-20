import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type Profile = {
  id: string;
  age: number | null;
  region: string | null;
  income_level: string | null;
  housing_status: string | null;
};

// userId가 있으면 profiles 테이블에서 해당 유저의 row 하나를 가져오는 훅
export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // 화면에 다시 돌아올 때(useFocusEffect)마다 refresh가 또 불리는데, 그때마다 loading을
  // true로 바꾸면 "불러오는 중..." 텍스트로 잠깐 바뀌면서 화면 높이가 출렁여 튀어 보임.
  // 그래서 "이미 한 번 불러온 적 있는지"를 기억해뒀다가, 두 번째부터는 로딩 화면 없이 조용히 갱신함.
  const hasLoadedOnce = useRef(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    if (!hasLoadedOnce.current) setLoading(true);
    // maybeSingle: row가 없으면 에러 대신 null을 줌 (아직 프로필 설정 안 한 신규 유저 대응)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[useProfile] 프로필 조회 실패:', error.message);
    } else {
      setProfile(data);
    }
    hasLoadedOnce.current = true;
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { profile, loading, refresh };
}
