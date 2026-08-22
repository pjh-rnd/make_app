// 아직 Supabase 연동 전이라, 화면 모양만 먼저 보려고 가짜 데이터를 그대로 씀 (Phase 3 목표)
// id는 상세 화면(app/deadline/[id].tsx)으로 이동할 때 URL 파라미터로 씀
// requirements는 매칭률 계산(lib/matching.ts)에 쓰는 자격 조건
// (금액은 만원 단위. maxPersonalMonthlyIncome 값은 실제 기준중위소득표를 반영한 게 아니라 예시로 대략 잡은 금액입니다)
// deadlineDate: 실제 마감 날짜('YYYY-MM-DD'). D-day 표시/알림 예약은 전부 이 날짜에서 계산함 (lib/deadlineUtils.ts)
export const DEADLINES = [
  {
    id: 'happy-housing',
    deadlineDate: '2026-08-23',
    categoryId: 'housing',
    category: '주거',
    title: '관악구 행복주택 청년 특별공급 접수',
    meta: '보증금 4,500만원 · 임대료 월 18만원대',
    detail:
      '무주택 청년을 위한 공공임대주택으로, 소득·자산 기준을 충족하면 시세보다 저렴하게 거주할 수 있어요. 서류 심사 후 계약금 납부까지 약 2주가 소요돼요.',
    requirements: {
      maxAge: 39,
      maxPersonalMonthlyIncome: 290,
      requiresNoHouse: true,
      regionKeyword: '관악',
    },
  },
  {
    id: 'youth-rent-support',
    deadlineDate: '2026-08-25',
    categoryId: 'housing',
    category: '주거',
    title: '청년월세 특별지원 증빙서류 제출',
    meta: '월 최대 20만원 · 12개월 지원',
    detail:
      '무주택 청년 1인가구를 대상으로 월세를 최대 12개월간 지원해요. 임대차계약서, 통장사본 등 증빙서류를 기한 내 제출하지 않으면 신청이 취소될 수 있어요.',
    requirements: { maxAge: 34, maxPersonalMonthlyIncome: 440, requiresNoHouse: true },
  },
  {
    id: 'hope-double-account',
    deadlineDate: '2026-09-02',
    categoryId: 'money',
    category: '자산형성',
    title: '희망두배 청년통장 신규 모집 마감',
    meta: '2년 만기 · 저축액 100% 추가 지원',
    detail:
      '매월 일정 금액을 저축하면 서울시가 동일한 금액을 추가로 적립해주는 자산형성 지원사업이에요. 2년 만기 시 저축액의 최대 2배를 받을 수 있어요.',
    requirements: { maxAge: 34, maxPersonalMonthlyIncome: 290, regionKeyword: '서울' },
  },
];

export type Deadline = (typeof DEADLINES)[number];
