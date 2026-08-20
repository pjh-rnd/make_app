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
};

export const CATEGORY_COLOR: Record<string, string> = {
  housing: COLORS.mint,
  money: COLORS.amber,
  job: COLORS.coral,
};

// urgency 값에 따라 D-day 배지 배경/글자색을 다르게 주는 함수
export function ddayStyle(urgency: string) {
  if (urgency === 'urgent') return { bg: COLORS.coral, text: '#FFFFFF' };
  if (urgency === 'soon') return { bg: COLORS.amberSoft, text: COLORS.amber };
  return { bg: '#EEEBE1', text: COLORS.inkSoft };
}
