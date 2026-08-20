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
import type { Profile } from '@/lib/useProfile';
import { useProfile } from '@/lib/useProfile';
import { useSession } from '@/lib/useSession';

type FieldType = 'text' | 'number' | 'date' | 'boolean';
type FieldConfig = { key: keyof Profile; label: string; type: FieldType; placeholder?: string };
type SectionConfig = { title: string; fields: FieldConfig[] };

// 큰 틀(SectionConfig) 5개 × 작은 틀(FieldConfig) — 이 배열 하나로 폼 전체(입력창 렌더링 + 저장 시 변환)를 다 처리함
const SECTIONS: SectionConfig[] = [
  {
    title: '개인정보',
    fields: [
      { key: 'birth_date', label: '생년월일', type: 'date', placeholder: 'YYYY-MM-DD' },
      { key: 'is_university_student', label: '대학생 여부', type: 'boolean' },
      { key: 'is_job_seeker', label: '취업준비생 여부', type: 'boolean' },
      { key: 'region_province', label: '거주지 (시/도)', type: 'text', placeholder: '예: 서울특별시' },
      { key: 'region_city', label: '거주지 (시/군)', type: 'text', placeholder: '해당 없으면 비워두기' },
      { key: 'region_district', label: '거주지 (구)', type: 'text', placeholder: '예: 관악구' },
    ],
  },
  {
    title: '개인 소득 / 자산',
    fields: [
      { key: 'personal_monthly_income', label: '월 평균 소득', type: 'number', placeholder: '단위: 원' },
      { key: 'personal_assets', label: '자산', type: 'number', placeholder: '단위: 원' },
      { key: 'owns_house', label: '주택 소유 여부', type: 'boolean' },
      { key: 'owns_car', label: '자동차 소유 여부', type: 'boolean' },
    ],
  },
  {
    title: '가족 정보',
    fields: [
      { key: 'family_member_count', label: '가족 구성원 수', type: 'number' },
      { key: 'family_type', label: '가족 형태', type: 'text', placeholder: '예: 1인가구, 부모동거 등' },
    ],
  },
  {
    title: '가구 소득 / 자산',
    fields: [
      { key: 'household_monthly_income', label: '월 평균 소득', type: 'number', placeholder: '단위: 원' },
      { key: 'household_assets', label: '자산', type: 'number', placeholder: '단위: 원' },
      { key: 'household_owns_house', label: '주택 소유 여부', type: 'boolean' },
      { key: 'household_owns_car', label: '자동차 소유 여부', type: 'boolean' },
    ],
  },
  {
    title: '추가정보',
    fields: [
      { key: 'university_location', label: '대학 소재지', type: 'text' },
      { key: 'income_base_location', label: '소득 근거지', type: 'text' },
      { key: 'subscription_account_payment_count', label: '청약통장 납입 횟수', type: 'number' },
      {
        key: 'subscription_account_payment_amount',
        label: '청약통장 납입 금액',
        type: 'number',
        placeholder: '단위: 원',
      },
      {
        key: 'subscription_account_payment_period',
        label: '청약통장 납입 기간',
        type: 'number',
        placeholder: '단위: 개월',
      },
      { key: 'parents_income', label: '부모님 소득', type: 'number', placeholder: '단위: 원' },
      { key: 'parents_assets', label: '부모님 자산', type: 'number', placeholder: '단위: 원' },
      { key: 'parents_car_value', label: '부모님 차량가액', type: 'number', placeholder: '단위: 원' },
      { key: 'parents_count', label: '부모님 수', type: 'number' },
      { key: 'is_basic_livelihood_recipient', label: '기초생활 수급자 여부', type: 'boolean' },
      { key: 'is_near_poverty', label: '차상위계층 여부', type: 'boolean' },
      { key: 'is_supported_single_parent_family', label: '지원대상 한부모가족 여부', type: 'boolean' },
    ],
  },
];

// 편집 중엔 숫자/날짜/텍스트 다 문자열로 들고 있다가, 저장할 때 각 필드 타입에 맞게 변환함
type FormValue = string | boolean | null;
type FormState = Record<string, FormValue>;

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

  async function handleSave() {
    if (!session) return;
    setSaving(true);
    setErrorMsg('');

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
    marginBottom: 24,
  },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
