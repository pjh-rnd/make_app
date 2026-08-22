import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/moa-colors';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';

// "전체" 탭 — MY/커뮤니티/회원/서비스를 한데 모아두는 허브 화면. 홈 화면 우측 상단 👤 아이콘으로만
// 들어가던 마이페이지(edit-profile) 말고도, 나중에 생길 기능들(커뮤니티, 지원 이력 등)을 미리
// 자리 잡아두는 용도. 커뮤니티·지원한 공고는 그 기능 자체(글쓰기, 지원 상태 추적)가 아직 앱에
// 없어서 항목만 만들어두고 "준비 중" 배지로 표시함 — 실제 기능은 따로 만들어야 함.
const MENU_SECTIONS = [
  {
    title: 'MY',
    items: [
      { label: '내 정보', kind: 'link', href: '/edit-profile' } as const,
      { label: '내가 지원한 공고', kind: 'soon' } as const,
    ],
  },
  {
    title: '커뮤니티',
    items: [
      { label: '내가 쓴 글', kind: 'soon' } as const,
      { label: '내가 남긴 댓글', kind: 'soon' } as const,
    ],
  },
] as const;

export default function MoreScreen() {
  const { session } = useSession();

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  // 회원탈퇴 — 클라이언트에서 안전하게 지울 수 있는 내 데이터(프로필, 찜한 정책)까지만 지우고
  // 로그아웃시킴. 실제 로그인 계정 자체(Supabase auth.users)를 완전히 삭제하려면 서비스 롤 키가
  // 필요한 관리자 API(admin.deleteUser)를 써야 하는데, 그건 클라이언트 코드에 절대 넣으면 안 되는
  // 키라서 여기선 못 함 — 나중에 Supabase Edge Function을 따로 만들어서 처리해야 함.
  function handleWithdraw() {
    Alert.alert('정말 탈퇴하시겠어요?', '찜한 정책과 프로필 정보가 모두 삭제되고 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '탈퇴하기',
        style: 'destructive',
        onPress: async () => {
          if (!session) return;
          await supabase.from('saved_policies').delete().eq('user_id', session.user.id);
          await supabase.from('profiles').delete().eq('id', session.user.id);
          await supabase.auth.signOut();
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>전체</Text>

      {MENU_SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.card}>
            {section.items.map((item, i) => (
              <MenuRow
                key={item.label}
                label={item.label}
                last={i === section.items.length - 1}
                soon={item.kind === 'soon'}
                onPress={
                  item.kind === 'link'
                    ? () => router.push(item.href)
                    : () => Alert.alert('준비 중이에요', '곧 만나보실 수 있어요!')
                }
              />
            ))}
          </View>
        </View>
      ))}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>회원</Text>
        <View style={styles.card}>
          <MenuRow label="로그아웃" onPress={handleLogout} />
          <MenuRow label="회원탈퇴" onPress={handleWithdraw} last danger />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>서비스</Text>
        <View style={styles.card}>
          <MenuRow label="개인정보 처리방침" onPress={() => router.push('/privacy-policy')} last />
        </View>
      </View>
    </ScrollView>
  );
}

function MenuRow({
  label,
  onPress,
  last,
  soon,
  danger,
}: {
  label: string;
  onPress: () => void;
  last?: boolean;
  soon?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.row, !last && styles.rowBorder]}>
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
      {soon ? <Text style={styles.soonBadge}>준비 중</Text> : <Text style={styles.rowChevron}>›</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.paper },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '700', color: COLORS.ink, marginBottom: 20 },

  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.inkSoft,
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: COLORS.paperRaise,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.line },
  rowLabel: { fontSize: 17, color: COLORS.ink },
  rowLabelDanger: { color: COLORS.coral },
  rowChevron: { fontSize: 20, color: '#C7C2B4' },
  soonBadge: {
    fontSize: 12.5,
    color: COLORS.inkSoft,
    backgroundColor: COLORS.paper,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
});
