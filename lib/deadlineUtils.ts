// 배지 색을 정할 때 쓰는 3단계 상태 — "시작 전 / 진행 중 / 마감 후". 예전엔 마감까지 남은
// 날짜로만 긴급도(urgent/soon/later)를 나눴는데, 시작일이 생기면서 "아직 시작도 안 했는데
// 급하다고 빨갛게 보이는" 게 이상해서, 지금은 이 세 단계로만 색을 나눔.
export type Phase = 'before' | 'active' | 'closed';

function toMidnight(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

// 시작일·마감일에서 "시작 D-9" / "마감 D-9" 같은 표시 문구와 상태(phase)를 계산함.
// 예전엔 dday를 mock 데이터에 직접 박아뒀는데, 그러면 오늘 날짜가 지나도 안 바뀌고 그대로
// 남아있어서 늘 최신 상태를 유지하려면 실제 날짜에서 매번 계산해야 함.
// - 시작 전(today < startDate): "시작 D-n" — 신청이 아직 안 열렸다는 뜻
// - 진행 중(startDate <= today <= deadlineDate): "마감 D-n" — 지금 신청 가능, 마감까지 며칠
// - 마감 후(today > deadlineDate): "마감"
export function computeDday(startDate: string, deadlineDate: string): { label: string; phase: Phase } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = toMidnight(startDate);
  const deadline = toMidnight(deadlineDate);

  if (today < start) {
    const diffDays = daysBetween(start, today);
    return { label: diffDays === 0 ? '오늘 시작' : `시작 D-${diffDays}`, phase: 'before' };
  }

  if (today <= deadline) {
    const diffDays = daysBetween(deadline, today);
    return { label: diffDays === 0 ? '오늘 마감' : `마감 D-${diffDays}`, phase: 'active' };
  }

  return { label: '마감', phase: 'closed' };
}

// 'YYYY-MM-DD' → 'M/D'. 카드에서 신청 시작일·마감일을 짧게 나란히 보여줄 때 씀.
export function formatMonthDay(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${Number(m)}/${Number(d)}`;
}
