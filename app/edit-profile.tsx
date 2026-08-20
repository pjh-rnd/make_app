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
import { HOUSEHOLD_COPY_MAP, SECTIONS } from '@/lib/profileFields';
import type { Profile } from '@/lib/useProfile';
import { useProfile } from '@/lib/useProfile';
import { useSession } from '@/lib/useSession';

// 편집 중엔 숫자/날짜/텍스트 다 문자열로 들고 있다가, 저장할 때 각 필드 타입에 맞게 변환함.
// money 타입은 화면엔 "2,900" 처럼 콤마 붙여서 보여주고, 저장 직전에만 콤마를 떼어냄.
type FormValue = string | boolean | null;
type FormState = Record<string, FormValue>;

function stripCommas(text: string): string {
  return text.replace(/,/g, '');
}

// 입력 중인 숫자 문자열에 천단위 콤마를 붙여줌 (숫자 아닌 문자는 제거)
function formatMoneyInput(text: string): string {
  const digitsOnly = stripCommas(text).replace(/[^0-9]/g, '');
  if (!digitsOnly) return '';
  return Number(digitsOnly).toLocaleString('ko-KR');
}

// 'YYYY-MM-DD' 형식이면서 실제로 존재하는 날짜인지 확인 (예: 2000-13-45 같은 값 거르기)
function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export default function EditProfileScreen() {
  const { session } = useSession();
  const { profile, loading } = useProfile(session?.user.id);

  const [form, setForm] = useState<FormState>({});
  const [expandedTitles, setExpandedTitles] = useState<Set<string>>(new Set([SECTIONS[0].title]));
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // DB에서 불러온 기존 값이 있으면 입력창에 채워 넣음 (숫자/불리언도 편집용 문자열/불리언으로 변환)
  useEffect(() => {
    if (!profile) return;
    const next: FormState = {};
    for (const section of SECTIONS) {
      for (const f of section.fields) {
        const raw = profile[f.key];
        if (f.type === 'boolean') {
          next[f.key] = (raw as boolean | null) ?? null;
        } else if (f.type === 'money') {
          next[f.key] = raw != null ? Number(raw).toLocaleString('ko-KR') : '';
        } else if (f.type === 'number') {
          next[f.key] = raw != null ? String(raw) : '';
        } else {
          next[f.key] = (raw as string | null) ?? '';
        }
      }
    }
    setForm(next);
  }, [profile]);

  function toggleSection(title: string) {
    setExpandedTitles((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }

  function setField(key: keyof Profile, value: FormValue) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // "가구 소득/자산" 섹션에서 "개인 정보와 동일하게 채우기" 눌렀을 때 — 1인가구면 대부분 값이 같아서 입력 수고를 줄여줌
  function copyPersonalToHousehold() {
    setForm((prev) => {
      const next = { ...prev };
      for (const [from, to] of HOUSEHOLD_COPY_MAP) next[to] = prev[from];
      return next;
    });
  }

  async function handleSave() {
    if (!session) return;
    setErrorMsg('');

    const birthDateRaw = (form.birth_date as string) ?? '';
    if (birthDateRaw && !isValidDateString(birthDateRaw)) {
      setErrorMsg('생년월일 형식이 올바르지 않아요 (예: 2000-01-15)');
      return;
    }

    setSaving(true);

    // 폼에 든 문자열/불리언을 실제 DB 타입(숫자/불리언/텍스트)으로 변환
    const payload: Record<string, unknown> = {
      id: session.user.id,
      updated_at: new Date().toISOString(),
    };
    for (const section of SECTIONS) {
      for (const f of section.fields) {
        const raw = form[f.key];
        if (f.type === 'boolean') {
          payload[f.key] = raw === true || raw === false ? raw : null;
        } else if (f.type === 'money') {
          const digits = stripCommas((raw as string) ?? '');
          payload[f.key] = digits !== '' ? Number(digits) : null;
        } else if (f.type === 'number') {
          payload[f.key] = raw !== '' && raw != null ? Number(raw) : null;
        } else {
          payload[f.key] = raw !== '' && raw != null ? raw : null;
        }
      }
    }

    // upsert: 이미 내 row가 있으면 수정(update), 없으면 새로 만듦(insert) — 둘 다 처리해주는 함수
    const { error } = await supabase.from('profiles').upsert(payload);

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
        {SECTIONS.map((section) => {
          const expanded = expandedTitles.has(section.title);
          return (
            <View key={section.title} style={styles.section}>
              <Pressable onPress={() => toggleSection(section.title)} style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionChevron}>{expanded ? '▾' : '▸'}</Text>
              </Pressable>
              {expanded && (
                <View style={styles.sectionBody}>
                  {section.title === '가구 소득 / 자산' && (
                    <Pressable onPress={copyPersonalToHousehold} style={styles.copyButton}>
                      <Text style={styles.copyButtonText}>개인 정보와 동일하게 채우기</Text>
                    </Pressable>
                  )}
                  {section.fields.map((f) => (
                    <View key={f.key} style={styles.fieldGroup}>
                      <Text style={styles.label}>{f.label}</Text>
                      {f.type === 'boolean' ? (
                        <View style={styles.boolRow}>
                          <Pressable
                            onPress={() => setField(f.key, true)}
                            style={[styles.boolChip, form[f.key] === true && styles.boolChipActive]}>
                            <Text
                              style={[
                                styles.boolChipText,
                                form[f.key] === true && styles.boolChipTextActive,
                              ]}>
                              예
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => setField(f.key, false)}
                            style={[styles.boolChip, form[f.key] === false && styles.boolChipActive]}>
                            <Text
                              style={[
                                styles.boolChipText,
                                form[f.key] === false && styles.boolChipTextActive,
                              ]}>
                              아니오
                            </Text>
                          </Pressable>
                        </View>
                      ) : f.type === 'money' ? (
                        <View style={styles.moneyRow}>
                          <TextInput
                            style={[styles.input, styles.moneyInput]}
                            value={(form[f.key] as string) ?? ''}
                            onChangeText={(t) => setField(f.key, formatMoneyInput(t))}
                            placeholder="0"
                            placeholderTextColor="#B6B0A0"
                            keyboardType="numeric"
                          />
                          <Text style={styles.moneyUnit}>만원</Text>
                        </View>
                      ) : (
                        <TextInput
                          style={styles.input}
                          value={(form[f.key] as string) ?? ''}
                          onChangeText={(t) => setField(f.key, t)}
                          placeholder={f.placeholder}
                          placeholderTextColor="#B6B0A0"
                          keyboardType={f.type === 'number' ? 'numeric' : 'default'}
                        />
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

        <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>저장</Text>
          )}
        </Pressable>

        <Pressable style={styles.logoutButton} onPress={() => supabase.auth.signOut()}>
          <Text style={styles.logoutButtonText}>로그아웃</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.paper },
  center: { flex: 1, backgroundColor: COLORS.paper, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20 },

  section: {
    backgroundColor: COLORS.paperRaise,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  sectionTitle: { fontSize: 14.5, fontWeight: '700', color: COLORS.ink },
  sectionChevron: { fontSize: 14, color: COLORS.inkSoft },
  sectionBody: { paddingHorizontal: 16, paddingBottom: 16 },

  copyButton: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.mintSoft,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  copyButtonText: { fontSize: 12, color: COLORS.mint, fontWeight: '600' },

  fieldGroup: { marginTop: 12 },
  label: { fontSize: 12, color: COLORS.inkSoft, marginBottom: 6 },
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

  moneyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  moneyInput: { flex: 1 },
  moneyUnit: { fontSize: 13, color: COLORS.inkSoft },

  boolRow: { flexDirection: 'row', gap: 8 },
  boolChip: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 100,
    backgroundColor: COLORS.paper,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  boolChipActive: { backgroundColor: COLORS.mint, borderColor: COLORS.mint },
  boolChipText: { fontSize: 13, color: COLORS.inkSoft },
  boolChipTextActive: { color: '#FFFFFF', fontWeight: '600' },

  error: { color: COLORS.coral, fontSize: 12.5, marginTop: 4, marginBottom: 12 },
  saveButton: {
    backgroundColor: COLORS.ink,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  logoutButton: { alignSelf: 'center', marginTop: 20, marginBottom: 24 },
  logoutButtonText: { fontSize: 12.5, color: COLORS.inkSoft, textDecorationLine: 'underline' },
});
