import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { HeaderBackButton } from '@/components/header-back-button';
import { CATEGORY_COLOR, COLORS, ddayStyle } from '@/constants/moa-colors';
import { computeDday, formatMonthDay } from '@/lib/deadlineUtils';
import { calculateMatch } from '@/lib/matching';
import { extractSupportHighlight, formatPolicyGuide, formatRelativeTime } from '@/lib/policyText';
import { usePolicies } from '@/lib/usePolicies';
import { usePolicyAiSummary } from '@/lib/usePolicyAiSummary';
import { usePolicyComments } from '@/lib/usePolicyComments';
import { usePolicyDetailExtra } from '@/lib/usePolicyDetailExtra';
import { useProfile } from '@/lib/useProfile';
import { useSavedPolicies } from '@/lib/useSavedPolicies';
import { useSession } from '@/lib/useSession';

export default function DeadlineDetailScreen() {
  // URL의 [id] 부분이 여기로 들어옴 (예: /deadline/happy-housing -> id === 'happy-housing')
  const { id } = useLocalSearchParams<{ id: string }>();
  const { policies, loading: policiesLoading } = usePolicies();
  const item = policies.find((d) => d.id === id);

  const { session } = useSession();
  const { profile } = useProfile(session?.user.id);
  const { savedIds, toggle: toggleSaved } = useSavedPolicies(session?.user.id, policies);
  // 목록용 usePolicies()엔 없는(=일부러 안 담은, 아래 훅 주석 참고) 신청방법/제출서류/지원대상
  // 상세/지원내용 원문을 이 화면에서만 따로 조회함
  const { extra } = usePolicyDetailExtra(item?.id);
  // 사람(Claude)이 정책 원문을 직접 읽고 손으로 채워넣은 요약(2026-08-23 시작,
  // scripts/policyAiSummaries.js 참고) — 아직 극히 일부 정책에만 있고, 없으면 null이라 아래
  // 렌더링에서 기존 방식(원문 그대로 보여주기)으로 자연스럽게 대체됨
  const { summary: aiSummary } = usePolicyAiSummary(item?.id);
  const { comments, post, remove } = usePolicyComments(item?.id, session?.user.id);
  const [commentText, setCommentText] = useState('');

  if (!item) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="정책 상세" />
        {/* Supabase에서 policies를 아직 불러오는 중일 수 있어서(비동기), 로딩 중과 진짜
            "없는 정책"을 구분해서 보여줌 — 안 그러면 데이터 오는 짧은 순간 "못 찾음" 문구가
            잠깐 번쩍이는 것처럼 보임 */}
        <Text style={styles.notFound}>
          {policiesLoading ? '불러오는 중...' : '해당 정책을 찾을 수 없어요.'}
        </Text>
      </View>
    );
  }

  const { label: ddayLabel, phase } = computeDday(item.startDate, item.deadlineDate);
  const dstyle = ddayStyle(phase);
  const catColor = CATEGORY_COLOR[item.categoryId];
  const match = calculateMatch(profile, item.requirements);

  // "지원혜택" 헤드라인 — 지원내용 원문(extra) 먼저, 아직 안 불러왔으면 목록용 detail(요약)에서라도
  // 찾아봄. lib/policyText.ts 주석 참고: 진짜 AI 계산 요약(예: "월 30만원×8학기"→"최대 240만원")은
  // 아니고 원문에서 금액 패턴을 찾아 보여주는 수준임.
  const supportHighlight = extractSupportHighlight(extra?.supportDetailText, item.detail);
  const guide = formatPolicyGuide(item.detail, extra?.supportDetailText);

  async function handlePostComment() {
    const text = commentText;
    setCommentText('');
    await post(text);
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* 네이티브 헤더 대신 화면 안에서 직접 그림 (iOS가 헤더 버튼에 씌우는 원형 배경이 계속
          깜빡이는 문제가 있어서 — app/_layout.tsx에서 이 화면은 headerShown: false로 처리해둠) */}
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title={item.category} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <View style={[styles.ddayBadge, { backgroundColor: dstyle.bg }]}>
            <Text style={[styles.ddayText, { color: dstyle.text }]}>{ddayLabel}</Text>
          </View>
          {session && (
            <Pressable
              onPress={() =>
                toggleSaved({ id: item.id, title: item.title, deadlineDate: item.deadlineDate })
              }
              hitSlop={10}>
              <Text style={styles.heartIcon}>{savedIds.has(item.id) ? '❤️' : '🤍'}</Text>
            </Pressable>
          )}
        </View>

        <Text style={[styles.category, { color: catColor }]}>{item.category}</Text>
        <Text style={styles.title}>{item.title}</Text>

        {/* 상단 핵심 정보 블록(2026-08-23 개편) — "지원혜택"을 제일 눈에 띄게 맨 위에 두고,
            신청기간·정책기관(주관기관)·지역을 그 아래 나란히 둠. 이 화면에만 있던 item.meta
            줄("중분류 · 기관명" 텍스트 뭉치)은 여기서 빠짐 — 기관명이 정책기관 줄이랑 겹쳐서. */}
        {/* "정책 요약"(아래)이 있을 땐 지원내용까지 한 줄로 이미 알려주니, 원문에서 대충 뽑은
            이 박스는 겹쳐서 생략함 */}
        {!aiSummary && supportHighlight && (
          <View style={styles.highlightBox}>
            <Text style={styles.highlightLabel}>지원혜택</Text>
            <Text style={styles.highlightValue}>{supportHighlight}</Text>
          </View>
        )}
        <InfoRow
          label="신청기간"
          value={
            phase === 'rolling'
              ? '상시 접수 · 신청 기간이 정해져 있지 않아요'
              : `${formatMonthDay(item.startDate!)} ~ ${formatMonthDay(item.deadlineDate!)}`
          }
        />
        {extra?.orgName ? <InfoRow label="정책기관" value={extra.orgName} /> : null}
        {/* 지역 조건을 항상 명시적으로 보여줌(2026-08-23 추가) — regionKeyword가 없으면 "전국"이라고
            직접 알려줘서, 지역 정보를 아직 못 찾은 건지 진짜 전국 대상인지 헷갈리지 않게 함 */}
        <InfoRow label="지역" value={item.requirements.regionKeyword ?? '전국'} />

        <View style={styles.divider} />

        {aiSummary ? (
          <>
            {/* "정책 요약"(2026-08-23 추가) — Claude가 정책 원문을 직접 읽고 쓴 요약. 이 3줄만
                친근한 말투(~해요)고, 아래 지원대상/지원내용/신청방법/준비서류는 두괄식 개조식
                (- 로 시작하는 짧은 문장/구)으로 씀 — 사용자 요청으로 톤을 구분함 */}
            <Text style={styles.sectionLabel}>정책 요약</Text>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLine}>정책 안내: {aiSummary.summaryIntro}</Text>
              <Text style={styles.summaryLine}>지원내용: {aiSummary.summarySupport}</Text>
              <Text style={styles.summaryLine}>신청방법: {aiSummary.summaryApply}</Text>
            </View>

            <View style={styles.divider} />
            <Text style={styles.sectionLabel}>지원대상</Text>
            {aiSummary.targetDetail.map((line, i) => (
              <Text key={i} style={styles.bulletLine}>
                - {line}
              </Text>
            ))}

            <View style={styles.divider} />
            <Text style={styles.sectionLabel}>지원내용</Text>
            {aiSummary.supportDetail.map((line, i) => (
              <Text key={i} style={styles.bulletLine}>
                - {line}
              </Text>
            ))}
          </>
        ) : (
          <>
            {/* "안내" → "정책 안내"로 이름을 바꾸고, 두괄식(핵심 먼저) + "-" 불릿으로 다듬어서
                보여줌(2026-08-23 개편). lib/policyText.ts의 formatPolicyGuide 참고. */}
            <Text style={styles.sectionLabel}>정책 안내</Text>
            {guide.headline && <Text style={styles.detail}>{guide.headline}</Text>}
            {guide.bullets.map((line, i) => (
              <Text key={i} style={styles.bulletLine}>
                {line}
              </Text>
            ))}

            {/* 지원대상 상세(2026-08-23 추가) — 온통청년 원문(addAplyQlfcCndCn)을 그대로 보여줌.
                연령/지역처럼 우리가 구조화해서 판정하는 조건과 별개로, "관내 거주자만" 같은 원문
                그대로의 세부 조건을 놓치지 않게 원문도 같이 보여줌 */}
            {extra?.targetDetail && (
              <>
                <View style={styles.divider} />
                <Text style={styles.sectionLabel}>지원대상</Text>
                <Text style={styles.detail}>{extra.targetDetail}</Text>
              </>
            )}
          </>
        )}

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>
          내 조건으로 {match.eligible ? '신청 가능해요' : '신청할 수 없어요'}
        </Text>
        {match.criteria.map((c) => (
          <Text key={c.label} style={[styles.criterion, c.met ? styles.criterionMet : styles.criterionUnmet]}>
            {c.met ? '✓' : '✗'} {c.label}
          </Text>
        ))}

        {item.perks.length > 0 && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionLabel}>이런 점이 좋아요!</Text>
            {item.perks.map((perk) => (
              <Text key={perk} style={styles.perk}>
                ✨ {perk}
              </Text>
            ))}
          </>
        )}

        {aiSummary ? (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionLabel}>신청방법</Text>
            {aiSummary.applyMethodDetail.map((line, i) => (
              <Text key={i} style={styles.bulletLine}>
                - {line}
              </Text>
            ))}

            <View style={styles.divider} />
            <Text style={styles.sectionLabel}>준비서류 및 준비사항</Text>
            {aiSummary.documentsDetail.map((line, i) => (
              <Text key={i} style={styles.bulletLine}>
                - {line}
              </Text>
            ))}
          </>
        ) : (
          // 신청방법/제출서류(2026-08-23 추가) — 둘 다 없으면 섹션 자체를 숨김
          (extra?.applyMethod || extra?.requiredDocuments) && (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionLabel}>어떻게 신청하나요?</Text>
              {extra?.applyMethod && (
                <>
                  <Text style={styles.subLabel}>신청방법</Text>
                  <Text style={styles.detail}>{extra.applyMethod}</Text>
                </>
              )}
              {extra?.requiredDocuments && (
                <>
                  <Text style={[styles.subLabel, extra?.applyMethod && styles.subLabelSpaced]}>
                    준비 서류
                  </Text>
                  <Text style={styles.detail}>{extra.requiredDocuments}</Text>
                </>
              )}
            </>
          )
        )}

        {/* 관할기관 정보(2026-08-23 추가) — 기관명 + 관련 링크(신청 바로가기/홈페이지 등).
            ⚠️ 온통청년 API엔 기관 전화번호 필드가 따로 없어서(신청 URL만 제공) 전화번호는 못 넣음 */}
        {(extra?.orgName || item.links.length > 0) && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionLabel}>관할기관 정보</Text>
            {extra?.orgName && <Text style={styles.detail}>{extra.orgName}</Text>}
            {item.links.map((link) => (
              <Pressable key={link.url} onPress={() => Linking.openURL(link.url)}>
                <Text style={styles.link}>🔗 {link.label}</Text>
              </Pressable>
            ))}
          </>
        )}

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>댓글 {comments.length}</Text>
        {comments.length === 0 ? (
          <Text style={styles.emptyComment}>아직 댓글이 없어요. 첫 댓글을 남겨보세요!</Text>
        ) : (
          comments.map((c) => (
            <View key={c.id} style={styles.commentRow}>
              <View style={styles.commentHeadRow}>
                <Text style={styles.commentMeta}>
                  🙂 익명 · {formatRelativeTime(c.createdAt)}
                </Text>
                {session?.user.id === c.userId && (
                  <Pressable onPress={() => remove(c.id)} hitSlop={8}>
                    <Text style={styles.commentDelete}>삭제</Text>
                  </Pressable>
                )}
              </View>
              <Text style={styles.commentContent}>{c.content}</Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* 댓글 입력칸은 스크롤과 별개로 화면 하단에 항상 고정함(2026-08-23 요청) — ScrollView
          "밖"의 형제 View라서 본문이 스크롤돼도 이 줄만 안 움직임 */}
      {session && (
        <View style={styles.commentInputBar}>
          <TextInput
            style={styles.commentInput}
            value={commentText}
            onChangeText={setCommentText}
            placeholder="댓글을 입력해주세요"
            placeholderTextColor="#B6B0A0"
            multiline
          />
          <Pressable onPress={handlePostComment} hitSlop={10} disabled={!commentText.trim()}>
            <Text
              style={[styles.commentSendIcon, !commentText.trim() && styles.commentSendIconDisabled]}>
              ➤
            </Text>
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// "라벨: 값" 한 줄 — 상단 핵심 정보 블록(신청기간/정책기관/지역)에서 재사용
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// 네이티브 헤더 대신 화면 안에서 직접 그리는 헤더 (뒤로가기 + 카테고리명)
function ScreenHeader({ title }: { title: string }) {
  return (
    <View style={styles.header}>
      <HeaderBackButton />
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.paper },
  scroll: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: COLORS.ink },
  headerSpacer: { width: 40 },
  content: { padding: 20, paddingTop: 4, paddingBottom: 32 },
  notFound: { fontSize: 14, color: COLORS.inkSoft, padding: 20 },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  ddayBadge: {
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  ddayText: { fontWeight: '700', fontSize: 15 },
  heartIcon: { fontSize: 22 },

  category: { fontSize: 13.5, fontWeight: '700', letterSpacing: 0.3 },
  title: { fontSize: 23, fontWeight: '700', color: COLORS.ink, marginTop: 7, lineHeight: 30 },

  // "지원혜택" — 눈에 제일 먼저 띄게 색 있는 박스로 강조(2026-08-23 추가)
  highlightBox: {
    backgroundColor: COLORS.mintSoft,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  highlightLabel: { fontSize: 13, fontWeight: '700', color: COLORS.mint },
  highlightValue: { fontSize: 17, fontWeight: '700', color: COLORS.ink },

  // "정책 요약" 박스(2026-08-23 추가) — 지원혜택 박스와 톤을 맞춰 연한 배경을 쓰되, 3줄이라
  // 세로로 쌓음
  summaryBox: {
    backgroundColor: COLORS.mintSoft,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 6,
  },
  summaryLine: { fontSize: 14.5, color: COLORS.ink, lineHeight: 21 },

  infoRow: { flexDirection: 'row', marginTop: 9 },
  infoLabel: { width: 68, fontSize: 14, color: COLORS.inkSoft, opacity: 0.75 },
  infoValue: { flex: 1, fontSize: 14, color: COLORS.ink },

  divider: { height: 1, backgroundColor: COLORS.line, marginVertical: 20 },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.inkSoft,
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  subLabel: { fontSize: 13, fontWeight: '700', color: COLORS.ink, marginBottom: 4 },
  subLabelSpaced: { marginTop: 14 },
  detail: { fontSize: 16, color: COLORS.ink, lineHeight: 24 },
  bulletLine: { fontSize: 15, color: COLORS.ink, lineHeight: 22, marginTop: 4 },
  criterion: { fontSize: 15.5, marginTop: 7, lineHeight: 21 },
  criterionMet: { color: COLORS.mint },
  criterionUnmet: { color: COLORS.coral },
  perk: { fontSize: 15.5, color: COLORS.ink, marginTop: 7, lineHeight: 21 },
  link: { fontSize: 15.5, color: COLORS.mint, fontWeight: '600', marginTop: 9, lineHeight: 21 },

  emptyComment: { fontSize: 14, color: COLORS.inkSoft, opacity: 0.75 },
  commentRow: { marginTop: 14 },
  commentHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  commentMeta: { fontSize: 12, color: COLORS.inkSoft, opacity: 0.75 },
  commentDelete: { fontSize: 12, color: COLORS.coral },
  commentContent: { fontSize: 15, color: COLORS.ink, marginTop: 4, lineHeight: 21 },

  commentInputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    backgroundColor: COLORS.paperRaise,
  },
  commentInput: {
    flex: 1,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: COLORS.ink,
  },
  commentSendIcon: { fontSize: 20, color: COLORS.mint, paddingBottom: 8 },
  commentSendIconDisabled: { opacity: 0.35 },
});
