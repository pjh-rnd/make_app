// 배지 색을 정할 때 쓰는 상태 — "시작 전 / 진행 중 / 마감 후 / 상시모집". 예전엔 마감까지 남은
// 날짜로만 긴급도(urgent/soon/later)를 나눴는데, 시작일이 생기면서 "아직 시작도 안 했는데
// 급하다고 빨갛게 보이는" 게 이상해서, 지금은 이 단계로만 색을 나눔.
// 'rolling'(상시모집)은 2026-08-23 실제 온통청년 데이터 연동하면서 추가됨 — 신청 기간이
// 정해져 있지 않은 정책(청년주택드림청약통장처럼 항상 가입 가능한 상품 등)이 실제로 있어서.
export type Phase = 'before' | 'active' | 'closed' | 'rolling';

// 온통청년 원본 데이터가 "신청기간"란에 사업 전체 운영 기간(길게는 수년)을 그대로 넣어두는
// 경우가 실제로 많이 발견됨(2026-08-23, "평택 청년-기업 이어드림 사업"이 실제로는 8/19~8/27인데
// 앱엔 3/2~10/31로 뜬다고 제보해서 조사하다 발견 — 연중 여러 차례 개별 모집 회차가 도는
// 프로그램인데, aplyYmd엔 회차별 접수 기간이 아니라 "사업 전체 기간"이 들어있었음). 저장된
// 509건 중 467건(92%)이 이 기준을 넘음 — 처음엔 카드의 D-day 자체를 이걸로 갈아치웠는데,
// 사용자 피드백으로 **카드/D-day는 원래대로 두고**, 이 여부는 상세 화면에서 "정확한 회차는
// 공식 링크에서 확인하라"는 안내에만 씀(app/deadline/[id].tsx의 longTermNotice 참고).
const LONG_TERM_SPAN_DAYS = 90;

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
// - 상시모집(startDate/deadlineDate 둘 다 null, 또는 마감일이 올해를 넘어감): "상시모집" —
//   신청 기간이 정해져 있지 않음
// - 시작 전(today < startDate): "시작 D-n" — 신청이 아직 안 열렸다는 뜻
// - 진행 중(startDate <= today <= deadlineDate): "마감 D-n" — 지금 신청 가능, 마감까지 며칠
// - 마감 후(today > deadlineDate): "마감"
export function computeDday(
  startDate: string | null,
  deadlineDate: string | null
): { label: string; phase: Phase } {
  if (!startDate || !deadlineDate) {
    return { label: '상시모집', phase: 'rolling' };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = toMidnight(startDate);
  const deadline = toMidnight(deadlineDate);

  // 마감일이 올해 12/31을 넘어가면(내년 이후까지 길게 잡혀있으면) 그냥 상시모집으로 취급함
  // (2026-08-23, 사용자 요청) — 이런 정책은 아래 isLongPeriodPolicy 기준(90일 초과)에도 대부분
  // 걸리는 것들인데, 그중에서도 "올해 안엔 마감이 아예 없다"고 확정적으로 말할 수 있는 경우라
  // 어설픈 D-day 대신 상시모집으로 더 확실하게 표시함. 매년 자동으로 갱신되게 "올해"는
  // 하드코딩 없이 오늘 날짜에서 계산함.
  const thisYearEnd = new Date(today.getFullYear(), 11, 31);
  if (deadline > thisYearEnd) {
    return { label: '상시모집', phase: 'rolling' };
  }

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

// 신청기간이 비정상적으로 길어서(90일 초과) 표시된 날짜를 "이번 회차 마감"으로 믿기 어려운
// 정책인지 여부. 카드의 D-day 표시엔 안 쓰고(사용자 요청으로 되돌림), 상세 화면에서만
// "정확한 일정은 공식 링크에서 확인하세요" 안내를 보여줄지 판단하는 데 씀.
export function isLongPeriodPolicy(startDate: string | null, deadlineDate: string | null): boolean {
  if (!startDate || !deadlineDate) return false;
  return daysBetween(toMidnight(deadlineDate), toMidnight(startDate)) > LONG_TERM_SPAN_DAYS;
}

// 'YYYY-MM-DD' → 'M/D'. 카드에서 신청 시작일·마감일을 짧게 나란히 보여줄 때 씀.
export function formatMonthDay(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${Number(m)}/${Number(d)}`;
}
