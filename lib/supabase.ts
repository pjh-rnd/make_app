import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

// .env 파일에서 값을 읽어옴 (EXPO_PUBLIC_ 접두사가 붙어야 앱 코드에서 접근 가능)
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[supabase] .env에 EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY가 비어있어요.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // 로그인 세션을 폰에 저장해서, 앱을 껐다 켜도 로그인이 유지되게 함
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
