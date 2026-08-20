import { useCallback, useEffect, useState } from 'react';

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

  const refresh = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
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
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { profile, loading, refresh };
}
