import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase';

// 카카오/네이버 로그인은 이메일 로그인과 달리, 그 자리에서 폼을 채우는 게 아니라 브라우저 창이
// 하나 열렸다가 로그인에 성공하면 우리 앱으로 다시 돌아오는 방식(OAuth 리다이렉트)임. 순서:
// 1) Supabase한테 "이 provider로 로그인할 수 있는 URL 좀 만들어줘"라고 요청
//    (skipBrowserRedirect: 웹처럼 자동으로 브라우저를 띄우지 말고, 그 URL만 돌려달라는 뜻 — 앱
//    안에서는 우리가 직접 WebBrowser로 열어야 함)
// 2) expo-web-browser로 그 URL을 열고, 우리 앱 스킴(moaapp://)으로 다시 돌아오길 기다림
// 3) 돌아온 주소에 담긴 code를 실제 로그인 세션으로 교환
//
// ⚠️ 이 함수가 실제로 동작하려면 코드 바깥에서 해줘야 하는 설정이 있음(전부 각 서비스 콘솔 +
// Supabase 대시보드 로그인이 필요해서 내가 코드로 대신 끝낼 수 없음 — docs/PROGRESS.md 참고):
// - 카카오: Kakao Developers에서 앱 생성 → REST API 키 발급 → Supabase 대시보드
//   (Authentication → Providers → Kakao)에 그 키를 등록해야 "kakao" provider가 활성화됨.
//   (Supabase가 카카오를 기본 지원해서 이 경로면 됨)
// - 네이버: Supabase는 네이버를 기본 제공 provider 목록에 안 넣어놔서, "Custom OIDC provider"로
//   등록해야 함(Supabase 대시보드 → Authentication → Providers → Custom OIDC, 이름을 "naver"로).
//   네이버 개발자센터에서 발급한 Client ID/Secret과 OIDC 관련 값을 거기에 넣어야 함.
// - 구글: Google Cloud Console에서 OAuth 클라이언트 ID 발급(웹 애플리케이션 유형, 카카오처럼
//   Supabase가 기본 지원하는 provider라 별도 Custom OIDC 설정은 필요 없음) → Supabase 대시보드
//   (Authentication → Providers → Google)에 Client ID/Secret 등록.
// 셋 다 이 저장소 코드만으로는 끝낼 수 없는, 각 서비스 콘솔 + Supabase 대시보드 설정이 필요함.
export type SocialProvider = 'kakao' | 'custom:naver' | 'google';

export async function signInWithProvider(
  provider: SocialProvider
): Promise<{ error: Error | null; cancelled?: boolean }> {
  const redirectTo = Linking.createURL('login-callback');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data?.url) {
    return { error: error ?? new Error('로그인 주소를 만들지 못했어요.') };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !result.url) {
    // 사용자가 브라우저 창을 그냥 닫은 경우 — 에러가 아니라 "취소"로 처리
    return { error: null, cancelled: true };
  }

  const { queryParams } = Linking.parse(result.url);
  const code = queryParams?.code;
  if (typeof code !== 'string') {
    return { error: new Error('로그인 코드가 전달되지 않았어요.') };
  }

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  return { error: exchangeError ?? null };
}
