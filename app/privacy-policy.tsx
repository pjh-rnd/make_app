import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { HeaderBackButton } from '@/components/header-back-button';
import { COLORS } from '@/constants/moa-colors';

// ⚠️ 초안이에요 — 실제 앱스토어 심사·법적 요건을 통과하려면 변호사/개인정보보호 담당자 검토가
// 필요해요. 지금 앱이 실제로 수집하는 항목(profiles 테이블 필드, Supabase Auth 이메일 등)에
// 맞춰서 초안만 작성해둔 상태고, 회사명·연락처 등은 실제 정보로 바꿔야 해요.
const SECTIONS = [
  {
    title: '1. 수집하는 개인정보 항목',
    body:
      '회원가입 시: 이메일 주소, 비밀번호(암호화 저장)\n' +
      '프로필 입력 시(선택): 생년월일, 거주지역, 소득·자산 정보, 주택·자동차 소유 여부, 가족 정보 등 ' +
      '정책 매칭에 필요한 정보\n' +
      '간편로그인 이용 시: 카카오·네이버로부터 제공받는 식별 정보',
  },
  {
    title: '2. 개인정보의 수집 및 이용 목적',
    body:
      '회원 식별 및 로그인 유지, 사용자 조건에 맞는 청년정책 매칭·추천, 마감 알림 발송을 위해 ' +
      '수집한 정보를 이용해요. 광고나 마케팅 목적으로는 이용하지 않아요.',
  },
  {
    title: '3. 보유 및 이용 기간',
    body:
      '회원 탈퇴 시 즉시 파기해요(단, 관계 법령에 따라 보관이 필요한 정보는 예외). ' +
      '마이페이지 > 전체 > 회원탈퇴에서 직접 삭제를 요청할 수 있어요.',
  },
  {
    title: '4. 제3자 제공',
    body: '이용자의 동의 없이 개인정보를 외부에 제공하지 않아요.',
  },
  {
    title: '5. 이용자의 권리',
    body: '언제든지 마이페이지에서 본인 정보를 열람·수정할 수 있고, 회원탈퇴를 통해 삭제를 요청할 수 있어요.',
  },
  {
    title: '6. 문의처',
    body: '개인정보 관련 문의: (연락처를 입력해주세요)',
  },
];

export default function PrivacyPolicyScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <HeaderBackButton />
        <Text style={styles.headerTitle}>개인정보 처리방침</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Fit Me(이하 &ldquo;회사&rdquo;)는 이용자의 개인정보를 소중히 여기며, 관련 법령을 준수해요.
          이 초안은 아직 검토 전 버전이에요.
        </Text>
        {SECTIONS.map((s) => (
          <View key={s.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>
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
  content: { padding: 20, paddingBottom: 40 },
  intro: { fontSize: 13.5, color: COLORS.inkSoft, lineHeight: 20, marginBottom: 24 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14.5, fontWeight: '700', color: COLORS.ink, marginBottom: 8 },
  sectionBody: { fontSize: 13.5, color: COLORS.inkSoft, lineHeight: 21 },
});
