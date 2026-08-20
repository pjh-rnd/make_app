import { router } from 'expo-router';
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

import { COLORS } from '@/constants/moa-colors';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/lib/useProfile';
import { useSession } from '@/lib/useSession';

export default function EditProfileScreen() {
  const { session } = useSession();
  const { profile, loading } = useProfile(session?.user.id);

  const [age, setAge] = useState('');
  const [region, setRegion] = useState('');
  const [incomeLevel, setIncomeLevel] = useState('');
  const [housingStatus, setHousingStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // DB에서 불러온 기존 값이 있으면 입력창에 채워 넣음
  useEffect(() => {
    if (profile) {
      setAge(profile.age != null ? String(profile.age) : '');
      setRegion(profile.region ?? '');
      setIncomeLevel(profile.income_level ?? '');
      setHousingStatus(profile.housing_status ?? '');
    }
  }, [profile]);

  async function handleSave() {
    if (!session) return;
    setSaving(true);
    setErrorMsg('');

    // upsert: 이미 내 row가 있으면 수정(update), 없으면 새로 만듦(insert) — 둘 다 처리해주는 함수
    const { error } = await supabase.from('profiles').upsert({
      id: session.user.id,
      age: age ? Number(age) : null,
      region: region || null,
      income_level: incomeLevel || null,
      housing_status: housingStatus || null,
      updated_at: new Date().toISOString(),
    });

    setSaving(false);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    router.back();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.ink} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>나이</Text>
        <TextInput
          style={styles.input}
          value={age}
          onChangeText={setAge}
          placeholder="예: 27"
          placeholderTextColor="#B6B0A0"
          keyboardType="number-pad"
        />

        <Text style={styles.label}>지역</Text>
        <TextInput
          style={styles.input}
          value={region}
          onChangeText={setRegion}
          placeholder="예: 서울 관악구"
          placeholderTextColor="#B6B0A0"
        />

        <Text style={styles.label}>소득 수준</Text>
        <TextInput
          style={styles.input}
          value={incomeLevel}
          onChangeText={setIncomeLevel}
          placeholder="예: 중위소득 90%"
          placeholderTextColor="#B6B0A0"
        />

        <Text style={styles.label}>주거 상태</Text>
        <TextInput
          style={styles.input}
          value={housingStatus}
          onChangeText={setHousingStatus}
          placeholder="예: 무주택 · 1인가구"
          placeholderTextColor="#B6B0A0"
        />

        {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

        <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>저장</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.paper },
  center: { flex: 1, backgroundColor: COLORS.paper, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20 },
  label: { fontSize: 12, color: COLORS.inkSoft, marginBottom: 6, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.ink,
    backgroundColor: COLORS.paperRaise,
  },
  error: { color: COLORS.coral, fontSize: 12.5, marginTop: 16 },
  saveButton: {
    backgroundColor: COLORS.ink,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 28,
  },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
