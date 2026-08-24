import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { FitMeLogo } from '@/components/fit-me-logo';
import { GoogleIcon, KakaoIcon, NaverIcon } from '@/components/social-icon';
import { COLORS } from '@/constants/moa-colors';
import { signInWithProvider } from '@/lib/socialAuth';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';

// 마지막으로 성공한 간편로그인 수단을 기기에 저장해뒀다가, 다음에 로그인 화면에 들어오면
// 그 아이콘 위에 "최근 로그인" 말풍선을 띄워줌 (카카오/네이버 로그인 앱들이 흔히 쓰는 패턴)
const RECENT_LOGIN_KEY = 'fitme.recentSocialLogin';
type SocialMethod = 'kakao' | 'naver' | 'google';

export default function LoginScreen() {
  const { session, loading: sessionLoading } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [socialLoading, setSocialLoading] = useState<SocialMethod | null>(null);
  const [recentMethod, setRecentMethod] = useState<SocialMethod | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(RECENT_LOGIN_KEY).then((v) => {
      if (v === 'kakao' || v === 'naver' || v === 'google') setRecentMethod(v);
    });
  }, []);

  // 이미 로그인되어 있으면 로그인 화면에 머물 이유가 없으니 메인으로 보냄
  if (!sessionLoading && session) {
    return <Redirect href="/(tabs)" />;
  }

  async function handleSubmit() {
    setErrorMsg('');
    setInfoMsg('');

    if (!email || !password) {
      setErrorMsg('이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }

    setSubmitting(true);
    if (mode === 'signIn') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setErrorMsg(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setErrorMsg(error.message);
      } else {
        setInfoMsg('가입 확인 이메일을 보냈어요. 메일함을 확인해주세요.');
      }
    }
    setSubmitting(false);
  }

  async function handleSocialLogin(method: SocialMethod) {
    setErrorMsg('');
    setInfoMsg('');
    setSocialLoading(method);
    const provider =
      method === 'kakao' ? 'kakao' : method === 'google' ? 'google' : 'custom:naver';
    const { error, cancelled } = await signInWithProvider(provider);
    setSocialLoading(null);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    if (cancelled) return;
    await AsyncStorage.setItem(RECENT_LOGIN_KEY, method);
    setRecentMethod(method);
    // 로그인 성공하면 useSession이 세션 변화를 감지해서 위쪽 리다이렉트가 알아서 처리함
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <View style={styles.logoWrap}>
        <FitMeLogo />
      </View>
      <Text style={styles.brandSub}>나에게 맞는 청년정책 캘린더</Text>

      <View style={styles.form}>
        <Text style={styles.label}>이메일</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor="#B6B0A0"
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>비밀번호</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="6자 이상"
          placeholderTextColor="#B6B0A0"
          secureTextEntry
        />

        {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
        {infoMsg ? <Text style={styles.info}>{infoMsg}</Text> : null}

        <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>
              {mode === 'signIn' ? '로그인' : '회원가입'}
            </Text>
          )}
        </Pressable>

        <Pressable onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}>
          <Text style={styles.switchModeText}>
            {mode === 'signIn' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
          </Text>
        </Pressable>
      </View>

      {/* 간편로그인 — 화면 맨 아래쪽에 둠. 최근에 성공했던 수단 위에는 말풍선으로 "최근 로그인" 표시 */}
      <View style={styles.socialSection}>
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>간편로그인</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.socialRow}>
          <View style={styles.socialItem}>
            {recentMethod === 'kakao' && (
              <View style={styles.recentBadge}>
                <Text style={styles.recentBadgeText}>최근 로그인</Text>
                <View style={styles.recentBadgeArrow} />
              </View>
            )}
            <Pressable onPress={() => handleSocialLogin('kakao')} disabled={socialLoading !== null}>
              {socialLoading === 'kakao' ? (
                <View style={styles.socialLoadingCircle}>
                  <ActivityIndicator color={COLORS.inkSoft} />
                </View>
              ) : (
                <KakaoIcon />
              )}
            </Pressable>
            <Text style={styles.socialLabel}>카카오톡</Text>
          </View>

          <View style={styles.socialItem}>
            {recentMethod === 'naver' && (
              <View style={styles.recentBadge}>
                <Text style={styles.recentBadgeText}>최근 로그인</Text>
                <View style={styles.recentBadgeArrow} />
              </View>
            )}
            <Pressable onPress={() => handleSocialLogin('naver')} disabled={socialLoading !== null}>
              {socialLoading === 'naver' ? (
                <View style={styles.socialLoadingCircle}>
                  <ActivityIndicator color={COLORS.inkSoft} />
                </View>
              ) : (
                <NaverIcon />
              )}
            </Pressable>
            <Text style={styles.socialLabel}>네이버</Text>
          </View>

          <View style={styles.socialItem}>
            {recentMethod === 'google' && (
              <View style={styles.recentBadge}>
                <Text style={styles.recentBadgeText}>최근 로그인</Text>
                <View style={styles.recentBadgeArrow} />
              </View>
            )}
            <Pressable onPress={() => handleSocialLogin('google')} disabled={socialLoading !== null}>
              {socialLoading === 'google' ? (
                <View style={styles.socialLoadingCircle}>
                  <ActivityIndicator color={COLORS.inkSoft} />
                </View>
              ) : (
                <GoogleIcon />
              )}
            </Pressable>
            <Text style={styles.socialLabel}>구글</Text>
          </View>
        </View>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.paper },
  // 예전엔 padding 24에 요소 사이 여백도 다 좁아서 화면이 빽빽해 보였음 — 전체적으로 숨쉴 틈을 늘림
  scrollContent: { flexGrow: 1, padding: 28, paddingVertical: 40, justifyContent: 'center' },
  logoWrap: { alignItems: 'center' },
  brandSub: {
    fontSize: 13,
    color: COLORS.inkSoft,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 40,
  },
  form: {
    backgroundColor: COLORS.paperRaise,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 24,
  },
  label: { fontSize: 12.5, color: COLORS.inkSoft, marginBottom: 8, marginTop: 18 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: COLORS.ink,
    backgroundColor: COLORS.paper,
  },
  error: { color: COLORS.coral, fontSize: 13, marginTop: 16, lineHeight: 18 },
  info: { color: COLORS.mint, fontSize: 13, marginTop: 16, lineHeight: 18 },
  submitButton: {
    backgroundColor: COLORS.ink,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 26,
  },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  switchModeText: {
    color: COLORS.inkSoft,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 20,
  },

  // 간편로그인(카카오/네이버) — 화면 맨 아래쪽
  socialSection: { marginTop: 36 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.line },
  dividerLabel: { fontSize: 12.5, color: COLORS.inkSoft },
  // 구글 추가(2026-08-24)로 3개가 됐는데, 원래 gap(36)을 그대로 두면 화면 좁은 기기에서
  // 살짝 빠듯해서 26으로 줄임
  socialRow: { flexDirection: 'row', justifyContent: 'center', gap: 26, marginTop: 22 },
  socialItem: { alignItems: 'center', position: 'relative' },
  socialLabel: { fontSize: 12, color: COLORS.inkSoft, marginTop: 8 },
  socialLoadingCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.paperRaise,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  // "최근 로그인" 말풍선 — 아이콘 바로 위에 뜨고, 아래로 작은 화살표(꼬리)가 아이콘을 가리킴
  recentBadge: {
    position: 'absolute',
    bottom: '100%',
    marginBottom: 8,
    alignItems: 'center',
    alignSelf: 'center',
  },
  recentBadgeText: {
    backgroundColor: COLORS.coral,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    overflow: 'hidden',
  },
  recentBadgeArrow: {
    width: 8,
    height: 8,
    backgroundColor: COLORS.coral,
    marginTop: -4,
    transform: [{ rotate: '45deg' }],
  },
});
