import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

// .env 파일에서 값을 읽어옴 (EXPO_PUBLIC_ 접두사가 붙어야 앱 코드에서 접근 가능)
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[supabase] .env에 EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY가 비어있어요.');
}

// 아무것도 저장하지 않는 더미 스토리지 — 웹의 서버사이드 렌더링(Node 환경, window 없음) 중에만 씀
const noopStorage = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};

// AsyncStorage(내부적으로 웹에서는 window.localStorage를 씀)를 그냥 바로 쓰면, `expo start --web`
// 실행 시 Expo Router가 화면을 한 번 서버(Node)에서도 렌더링하는데(app.json의 web.output:"static"),
// 그 순간엔 window 자체가 없어서 "ReferenceError: window is not defined"로 개발 서버가 통째로
// 죽는 문제가 있었음(2026-08-24, 소셜 로그인을 웹으로 테스트해보다가 발견). 네이티브(iOS/안드로이드)는
// 이 문제와 무관하니 항상 AsyncStorage를 쓰고, 웹일 때만 window 존재 여부로 갈라서 서버 렌더링
// 중엔 noopStorage(그냥 세션 없음 취급)를, 실제 브라우저에서 뜬 뒤엔 AsyncStorage를 씀.
const authStorage =
  Platform.OS === 'web' ? (typeof window === 'undefined' ? noopStorage : AsyncStorage) : AsyncStorage;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // 로그인 세션을 폰에 저장해서, 앱을 껐다 켜도 로그인이 유지되게 함
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
