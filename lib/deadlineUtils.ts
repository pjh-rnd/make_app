// 배지 색을 정할 때 쓰는 상태 — "시작 전 / 진행 중 / 마감 후 / 상시모집". 예전엔 마감까지 남은
// 날짜로만 긴급도(urgent/soon/later)를 나눴는데, 시작일이 생기면서 "아직 시작도 안 했는데
// 급하다고 빨갛게 보이는" 게 이상해서, 지금은 이 단계로만 색을 나눔.
// 'rolling'(상시모집)은 2026-08-23 실제 온통청년 데이터 연동하면서 추가됨 — 신청 기간이
// 정해져 있지 않은 정책(청년주택드림청약통장처럼 항상 가입 가능한 상품 등)이 실제로 있어서.
// 'longterm'(장기/다회차)은 같은 날 나중에 추가됨 — 아래 LONG_TERM_SPAN_DAYS 주석 참고.
export type Phase = 'before' | 'active' | 'closed' | 'rolling' | 'longterm';

// 온통청년 원본 데이터가 "신청기간"란에 사업 전체 운영 기간(길게는 수년)을 그대로 넣어두는
// 경우가 실제로 많이 발견됨(2026-08-23, 사용자가 "평택 청년-기업 이어드림 사업"이 실제로는
// 8/19~8/27인데 앱엔 3/2~10/31로 뜬다고 제보해서 조사하다 발견 — 이 정책은 연중(1~12월)
// 여러 차례 개별 모집 회차가 도는 프로그램인데, 온통청년 API의 aplyYmd엔 회차별 접수 기간이
// 아니라 "사업 전체 기간"이 들어있었음). 전수 확인해보니 저장된 508건 중 470건(92%)이 60일
// 넘는 기간을 가지고 있었고, 그중 상당수는 몇 년(심하면 2020~2029처럼 10년)짜리였음 — 회차별
// 정확한 접수 기간은 각 지자체 사이트를 일일이 들어가지 않는 이상 알 방법이 없지만("기간
// 자체가 못 믿을 만큼 길다"는 것 자체는 코드로 감지 가능함. 실제 단일 공고는 대부분 길어야
// 두어 달 안에 끝나므로, 이 기준을 넘으면 D-day 카운트다운(거짓 정밀도)을 보여주는 대신
// "연중 여러 차례 접수" 안내로 바꿔서 오해를 막음.
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
// - 상시모집(startDate/deadlineDate 둘 다 null): "상시모집" — 신청 기간이 정해져 있지 않음
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

  // 마감일 자체는 지났으면(기간이 길든 짧든) 진짜로 끝났다고 보는 게 안전한 기본값이라
  // longterm 판정보다 먼저 검사함.
  if (today > deadline) {
    return { label: '마감', phase: 'closed' };
  }

  if (daysBetween(deadline, start) > LONG_TERM_SPAN_DAYS) {
    return { label: '연중 접수', phase: 'longterm' };
  }

  if (today < start) {
    const diffDays = daysBetween(start, today);
    return { label: diffDays === 0 ? '오늘 시작' : `시작 D-${diffDays}`, phase: 'before' };
  }

  const diffDays = daysBetween(deadline, today);
  return { label: diffDays === 0 ? '오늘 마감' : `마감 D-${diffDays}`, phase: 'active' };
}

// 'YYYY-MM-DD' → 'M/D'. 카드에서 신청 시작일·마감일을 짧게 나란히 보여줄 때 씀.
export function formatMonthDay(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${Number(m)}/${Number(d)}`;
}
