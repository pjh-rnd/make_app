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
  violet: '#8B5FBF',
  violetSoft: '#EDE4F5',
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
export const CATEGORY_COLOR: Record<string, string> = {
  housing: COLORS.mint,
  money: COLORS.amber,
  job: COLORS.coral,
  edu: COLORS.sky,
  welfare: COLORS.violet,
};

export const CATEGORY_LABEL: Record<string, string> = {
  housing: '주거',
  money: '자산',
  job: '취업',
  edu: '교육',
  welfare: '복지',
};

// 범례·그룹 목록을 항상 이 순서로 보여줌 (칩 순서와도 동일하게 맞춤)
export const CATEGORY_ORDER = ['housing', 'money', 'job', 'edu', 'welfare'];

// 관심분야 칩에 붙는 이모지 — 홈 화면 칩, 검색창 칩에서 똑같이 씀
export const CATEGORY_ICON: Record<string, string> = {
  housing: '🏠',
  money: '💰',
  job: '💼',
  edu: '📚',
  welfare: '🏥',
};

// phase(시작 전/진행 중/마감 후)에 따라 D-day 배지 배경/글자색을 다르게 주는 함수
// - before(시작 전): 파스텔 보라색 — closed(마감 후)와 똑같은 회색이라 구분이 안 됐어서,
//   "시작 D-n"은 밝은 보라 계열로 따로 구분되게 함
// - active(진행 중): 파스텔 연두색 — 지금 신청 가능하다는 걸 긍정적인 색으로
// - closed(마감 후): 그냥 회색 — 더 이상 의미 없는 상태
export function ddayStyle(phase: string) {
  if (phase === 'before') return { bg: COLORS.violetSoft, text: COLORS.violet };
  if (phase === 'active') return { bg: COLORS.limeSoft, text: COLORS.lime };
  return { bg: COLORS.closedGraySoft, text: COLORS.closedGray };
}
