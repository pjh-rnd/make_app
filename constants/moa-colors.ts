// 앱 전체에서 쓰는 색상 값 (prototype.html의 :root 변수와 동일)
export const COLORS = {
  ink: '#16233F',
  inkSoft: '#4A5875',
  paper: '#F6F4EE',
  paperRaise: '#FFFFFF',
  line: '#E1DDD1',
  mint: '#2F9E7C',
  mintSoft: '#E3F3EC',
  amber: '#E8873A',
  amberSoft: '#FCEBDA',
  coral: '#D9564A',
  coralSoft: '#FBE6E3',
  // 관심분야가 5개(주거/자산/취업/교육/복지)인데 기존엔 3개 색만 있어서
  // 교육·복지 점이 색 없이(투명하게) 찍히던 버그가 있었음 — 파랑/보라를 추가해서 5개 다 구분되게 함
  sky: '#3B7DC4',
  skySoft: '#DCE9F7',
  // skySoft보다 한 단계 더 밝은(거의 흰색에 가까운) 하늘색 — 정책 상세 화면 "정책 요약" 박스
  // 그라데이션의 밝은 쪽 끝에 씀(2026-08-23 추가)
  skyPale: '#EFF6FC',
  violet: '#8B5FBF',
  violetSoft: '#EDE4F5',
  // 6번째 카테고리 "참여" 추가하면서 새로 필요해진 색(2026-08-23). 기존 5색(초록/주황/빨강/파랑/보라)과
  // 안 겹치는 로즈(분홍) 계열로 고름
  rose: '#C2508A',
  roseSoft: '#F6E1EC',
  // D-day 배지용 — 시작 전(연회색)/진행 중(연두색)/마감 후(그냥 회색) 3단계
  paleGray: '#9C9C9C',
  paleGraySoft: '#EAEAEA',
  lime: '#5E8C34',
  limeSoft: '#E3F2CB',
  closedGray: '#8C8C8C',
  closedGraySoft: '#E2E2E2',
};

// 카테고리 id → 점/뱃지 색. 달력 점 색깔이 이 순서·색과 항상 일치해야 사람들이 외워서 구분할 수 있음
// (색이 바뀌면 CATEGORY_LABEL, CATEGORY_ORDER, 그리고 홈/찜한정책 화면의 범례도 같이 바꿔야 함)
//
// participation("참여")은 2026-08-23에 추가됨 — 온통청년 데이터를 실제로 연동해보니 대분류
// "참여･기반"(청년참여활동/정책인프라구축/국제교류/권익보호 등, 300건 이상)이 원래 5개 카테고리
// 어디에도 안 맞아서 전부 "복지"로 밀려들어가 복지 칩이 지나치게 커지는 문제가 있었음 —
// 그래서 별도 카테고리로 분리함(scripts/syncYouthPolicies.js의 매핑도 같이 고침)
export const CATEGORY_COLOR: Record<string, string> = {
  housing: COLORS.mint,
  money: COLORS.amber,
  job: COLORS.coral,
  edu: COLORS.sky,
  welfare: COLORS.violet,
  participation: COLORS.rose,
};

export const CATEGORY_LABEL: Record<string, string> = {
  housing: '주거',
  money: '자산',
  job: '취업',
  edu: '교육',
  welfare: '복지',
  participation: '참여',
};

// 범례·그룹 목록을 항상 이 순서로 보여줌 (칩 순서와도 동일하게 맞춤)
export const CATEGORY_ORDER = ['housing', 'money', 'job', 'edu', 'welfare', 'participation'];

// 관심분야 칩에 붙는 이모지 — 홈 화면 칩, 검색창 칩에서 똑같이 씀
export const CATEGORY_ICON: Record<string, string> = {
  housing: '🏠',
  money: '💰',
  job: '💼',
  edu: '📚',
  welfare: '🏥',
  participation: '🙋',
};

// phase(시작 전/진행 중/마감 후/상시모집)에 따라 D-day 배지 배경/글자색을 다르게 주는 함수
// - before(시작 전): 파스텔 보라색 — closed(마감 후)와 똑같은 회색이라 구분이 안 됐어서,
//   "시작 D-n"은 밝은 보라 계열로 따로 구분되게 함
// - active(진행 중): 파스텔 연두색 — 지금 신청 가능하다는 걸 긍정적인 색으로
// - closed(마감 후): 그냥 회색 — 더 이상 의미 없는 상태
// - rolling(상시모집, 2026-08-23 추가): 파스텔 주황색 — "지금 신청 가능"이라는 점에서 active와
//   비슷하게 긍정적이지만, 마감이 정해진 active와는 다른 상태라는 걸 색으로도 구분되게 함
export function ddayStyle(phase: string) {
  if (phase === 'before') return { bg: COLORS.violetSoft, text: COLORS.violet };
  if (phase === 'active') return { bg: COLORS.limeSoft, text: COLORS.lime };
  if (phase === 'rolling') return { bg: COLORS.amberSoft, text: COLORS.amber };
  return { bg: COLORS.closedGraySoft, text: COLORS.closedGray };
}
