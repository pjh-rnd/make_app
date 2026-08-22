export type Urgency = 'urgent' | 'soon' | 'later' | 'closed';

// 실제 마감 날짜에서 "D-3" 같은 표시 문구와 긴급도를 계산함.
// 예전엔 dday/urgency를 mock 데이터에 직접 박아뒀는데, 그러면 오늘 날짜가 지나도 안 바뀌고 그대로
// 남아있어서(예: 어제도 D-1, 오늘도 D-1) 늘 최신 상태를 유지하려면 실제 날짜에서 매번 계산해야 함.
export function computeDday(deadlineDate: string): { label: string; urgency: Urgency } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(deadlineDate);
  deadline.setHours(0, 0, 0, 0);

  const diffDays = Math.round((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: '마감', urgency: 'closed' };
  if (diffDays === 0) return { label: 'D-DAY', urgency: 'urgent' };
  const label = `D-${diffDays}`;
  if (diffDays <= 2) return { label, urgency: 'urgent' };
  if (diffDays <= 7) return { label, urgency: 'soon' };
  return { label, urgency: 'later' };
}
