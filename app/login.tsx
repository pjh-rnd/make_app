import { Redirect } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { COLORS } from '@/constants/moa-colors';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';

export default function LoginScreen() {
  const { session, loading: sessionLoading } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

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

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.brand}>Fit Me</Text>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.paper,
    padding: 24,
    justifyContent: 'center',
  },
  brand: { fontSize: 28, fontWeight: '700', color: COLORS.ink, textAlign: 'center' },
  brandSub: {
    fontSize: 12,
    color: COLORS.inkSoft,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 32,
  },
  form: {
    backgroundColor: COLORS.paperRaise,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 20,
  },
  label: { fontSize: 12, color: COLORS.inkSoft, marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.ink,
    backgroundColor: COLORS.paper,
  },
  error: { color: COLORS.coral, fontSize: 12.5, marginTop: 14 },
  info: { color: COLORS.mint, fontSize: 12.5, marginTop: 14 },
  submitButton: {
    backgroundColor: COLORS.ink,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  switchModeText: {
    color: COLORS.inkSoft,
    fontSize: 12.5,
    textAlign: 'center',
    marginTop: 16,
  },
});
