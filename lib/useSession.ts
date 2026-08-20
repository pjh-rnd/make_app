import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

// 로그인 상태(session)를 어디서든 쓸 수 있게 만든 훅(hook).
// session이 null이면 로그아웃 상태, 값이 있으면 로그인된 상태.
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 앱 켜질 때 기존 로그인 세션이 남아있는지 한 번 확인
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // 로그인/로그아웃/토큰갱신 등 인증 상태가 바뀔 때마다 자동으로 호출됨
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return { session, loading };
}
