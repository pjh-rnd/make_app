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

import { HeaderBackButton } from '@/components/header-back-button';
import { COLORS } from '@/constants/moa-colors';
import { supabase } from '@/lib/supabase';
import {
  countFilledFields,
  effectiveTotalFieldCount,
  getDistrictOptions,
  getRegionInfo,
  HOUSEHOLD_COPY_MAP,
  isRegionDistrictApplicable,
  PROVINCE_OPTIONS,
  SECTIONS,
} from '@/lib/profileFields';
import type { Profile } from '@/lib/useProfile';
import { calculateAge, useProfile } from '@/lib/useProfile';
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

  const hasProfile =
    !!profile &&
    (profile.birth_date ||
      profile.region_province ||
      profile.personal_monthly_income != null ||
      profile.owns_house != null);

  // "내 조건" 카드에 보여줄 요약 텍스트 — 홈 화면 상단에 있던 걸 여기로 옮겨옴 (개인정보라 마이페이지에서만 보여줘야 해서)
  const profileAge = calculateAge(profile?.birth_date);
  const profileRegionText = [profile?.region_province, profile?.region_city, profile?.region_district]
    .filter(Boolean)
    .join(' ');
  const profileIncomeText =
    profile?.personal_monthly_income != null
      ? `월 ${profile.personal_monthly_income.toLocaleString()}만원`
      : '미입력';
  const profileHousingText =
    profile?.owns_house == null ? '미입력' : profile.owns_house ? '주택 보유' : '무주택';
  const filledFieldCount = countFilledFields(profile);
  const totalFieldCount = effectiveTotalFieldCount(profile?.region_province, profile?.region_city);
  const completionPercent = Math.round((filledFieldCount / totalFieldCount) * 100);

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

  // 시/도를 바꾸면 그 아래 시/군·구 목록 자체가 달라지므로(서울 25개 구 ↔ 경기도 31개 시/군),
  // 이전에 골라둔 시/군·구 값이 새 시/도에서는 말이 안 될 수 있어서 같이 초기화함
  function handleProvinceChange(province: string) {
    setForm((prev) => ({ ...prev, region_province: province, region_city: '', region_district: '' }));
  }

  // 시/군을 바꾸면 그 아래 "구" 목록도 달라지므로(수원시 4개 구 ↔ 성남시 3개 구), 구 값도 같이 초기화함
  function handleCityChange(city: string) {
    setForm((prev) => ({ ...prev, region_city: city, region_district: '' }));
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
      <View style={styles.screen}>
        <ScreenHeader />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.ink} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader />
      <ScrollView contentContainerStyle={styles.content}>
        {/* 내 조건 카드 — 전엔 홈 화면 맨 위에 있었는데, 로그인하자마자 개인정보가 바로 보이는 게
            프라이버시상 별로라 마이페이지(여기)에 들어왔을 때만 보이도록 옮김 */}
        <View style={styles.profileCard}>
          <Text style={styles.cardLabel}>내 조건</Text>
          {hasProfile ? (
            <>
              <ProfileRow label="나이" value={profileAge != null ? `${profileAge}세` : '미입력'} />
              <ProfileRow label="지역" value={profileRegionText || '미입력'} />
              <ProfileRow label="소득" value={profileIncomeText} />
              <ProfileRow label="주거" value={profileHousingText} last />
            </>
          ) : (
            <Text style={styles.profileEmptyText}>
              아직 프로필이 없어요. 아래 항목을 입력해주세요.
            </Text>
          )}
        </View>

        {/* 프로필 완성도 — 총 항목 중 몇 개 채웠는지. 다 채울수록 매칭이 정확해진다는 걸 알려줌 */}
        <View style={styles.completionCard}>
          <View style={styles.completionTopRow}>
            <Text style={styles.completionLabel}>프로필 완성도</Text>
            <Text style={styles.completionCount}>
              {filledFieldCount}/{totalFieldCount}
            </Text>
          </View>
          <View style={styles.completionBarTrack}>
            <View style={[styles.completionBarFill, { width: `${completionPercent}%` }]} />
          </View>
        </View>

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
                  {section.fields.map((f) => {
                    // 시/도·시/군·구 세 필드는 서로 연결돼 있어서(시/도 바뀌면 시/군·구 목록도 바뀜)
                    // region_province를 만났을 때 한 번에 같이 그리고, 나머지 둘은 건너뜀
                    if (f.key === 'region_city' || f.key === 'region_district') return null;
                    if (f.key === 'region_province') {
                      return (
                        <RegionFields
                          key="region-fields"
                          province={(form.region_province as string) ?? ''}
                          city={(form.region_city as string) ?? ''}
                          district={(form.region_district as string) ?? ''}
                          onProvinceChange={handleProvinceChange}
                          onCityChange={handleCityChange}
                          onDistrictChange={(v) => setField('region_district', v)}
                        />
                      );
                    }
                    return (
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
                      ) : f.type === 'picker' ? (
                        <View style={styles.pickerRow}>
                          {(f.options ?? []).map((option) => (
                            <Pressable
                              key={option}
                              onPress={() => setField(f.key, option)}
                              style={[styles.pickerChip, form[f.key] === option && styles.boolChipActive]}>
                              <Text
                                style={[
                                  styles.boolChipText,
                                  form[f.key] === option && styles.boolChipTextActive,
                                ]}>
                                {option}
                              </Text>
                            </Pressable>
                          ))}
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
                    );
                  })}
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

// 홈 화면의 "다가오는 마감" 같은 접이식 섹션과 같은 방식(▾/▸ 화살표로 열고 닫기) — 시/도·시/군·구
// 옵션이 최대 31개까지 있어서 항상 펼쳐두면 화면을 너무 많이 차지해서, 평소엔 지금 고른 값만
// 한 줄로 보여주고 눌러야 목록이 펼쳐지게 함. 옵션을 고르면 자동으로 다시 접힘.
function CollapsiblePicker({
  label,
  options,
  value,
  onChange,
  placeholder = '선택해주세요',
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.collapsibleHeader}>
        <Text style={[styles.collapsibleValue, !value && styles.collapsiblePlaceholder]}>
          {value || placeholder}
        </Text>
        <Text style={styles.collapsibleChevron}>{open ? '▾' : '▸'}</Text>
      </Pressable>
      {open && (
        <View style={[styles.pickerRow, styles.collapsibleOptions]}>
          {options.map((option) => (
            <Pressable
              key={option}
              onPress={() => {
                onChange(option);
                setOpen(false);
              }}
              style={[styles.pickerChip, value === option && styles.boolChipActive]}>
              <Text style={[styles.boolChipText, value === option && styles.boolChipTextActive]}>
                {option}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// "거주지 (시/도)"→"거주지 (시/군)"→"거주지 (구)" 세 단계를 한 번에 그림 — 위 단계가 바뀌면 아래
// 단계 옵션 자체가 달라져서(서울엔 시/군이 없고, 수원시에만 구가 있는 식) 셋을 따로 못 떼어놓음.
function RegionFields({
  province,
  city,
  district,
  onProvinceChange,
  onCityChange,
  onDistrictChange,
}: {
  province: string;
  city: string;
  district: string;
  onProvinceChange: (v: string) => void;
  onCityChange: (v: string) => void;
  onDistrictChange: (v: string) => void;
}) {
  const info = getRegionInfo(province);
  const districtOptions = getDistrictOptions(province, city);
  const districtApplicable = isRegionDistrictApplicable(province, city);

  return (
    <>
      <CollapsiblePicker
        label="거주지 (시/도)"
        options={PROVINCE_OPTIONS}
        value={province}
        onChange={onProvinceChange}
      />

      {/* 특별시/광역시는 시/군 단계 자체가 없어서 이 필드는 통째로 숨김 */}
      {info?.kind === 'province' && (
        <CollapsiblePicker
          label="거주지 (시/군)"
          options={info.cities}
          value={city}
          onChange={onCityChange}
        />
      )}

      {info?.kind === 'metro' && info.districts.length === 0 && (
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>거주지 (구/군)</Text>
          <Text style={styles.regionHint}>{province}는 별도 구/군 구분이 없어요</Text>
        </View>
      )}

      {districtApplicable && (
        <CollapsiblePicker
          label={info?.kind === 'metro' ? '거주지 (구/군)' : '거주지 (구)'}
          options={districtOptions}
          value={district}
          onChange={onDistrictChange}
        />
      )}

      {/* province인데 아직 시/군을 안 골랐거나, 고른 시가 구가 없는 곳이면 안내만 보여줌 */}
      {info?.kind === 'province' && city && !districtApplicable && (
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>거주지 (구)</Text>
          <Text style={styles.regionHint}>{city}는 별도 구 구분이 없어요</Text>
        </View>
      )}
    </>
  );
}

// 반복되는 "라벨: 값" 줄을 위한 작은 컴포넌트 (Props로 label/value/last를 받음)
function ProfileRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.profileRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.profileRowLabel}>{label}</Text>
      <Text style={styles.profileRowValue}>{value}</Text>
    </View>
  );
}

// 네이티브 헤더 대신 화면 안에서 직접 그리는 헤더 (뒤로가기 + 제목)
function ScreenHeader() {
  return (
    <View style={styles.header}>
      <HeaderBackButton />
      <Text style={styles.headerTitle}>마이페이지</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: COLORS.ink },
  headerSpacer: { width: 40 },
  center: { flex: 1, backgroundColor: COLORS.paper, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20 },

  profileCard: {
    backgroundColor: COLORS.ink,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 11,
    color: '#8FA3C8',
    textTransform: 'uppercase',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  profileEmptyText: { fontSize: 12.5, color: '#A9B4CB', lineHeight: 18 },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  profileRowLabel: { fontSize: 13, color: '#A9B4CB' },
  profileRowValue: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },

  completionCard: {
    backgroundColor: COLORS.paperRaise,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  completionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  completionLabel: { fontSize: 12, color: COLORS.inkSoft, fontWeight: '600' },
  completionCount: { fontSize: 12, color: COLORS.mint, fontWeight: '700' },
  completionBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.paper,
    overflow: 'hidden',
  },
  completionBarFill: { height: '100%', backgroundColor: COLORS.mint, borderRadius: 3 },

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

  regionHint: { fontSize: 12.5, color: COLORS.inkSoft, fontStyle: 'italic' },
  // 홈 화면 "다가오는 마감" 접이식 섹션 헤더와 같은 느낌 — 지금 값 + 화살표(▾/▸)
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: COLORS.paper,
  },
  collapsibleValue: { fontSize: 14, color: COLORS.ink, fontWeight: '600' },
  collapsiblePlaceholder: { color: '#B6B0A0', fontWeight: '400' },
  collapsibleChevron: { fontSize: 16, color: COLORS.inkSoft, fontWeight: '700' },
  collapsibleOptions: { marginTop: 10 },

  moneyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  moneyInput: { flex: 1 },
  moneyUnit: { fontSize: 13, color: COLORS.inkSoft },

  boolRow: { flexDirection: 'row', gap: 8 },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickerChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 100,
    backgroundColor: COLORS.paper,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
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
