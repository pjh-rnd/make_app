// 원래 홈 화면과 "찜한 정책" 화면(따로 있던 탭, 지금은 홈 화면에 통합됨)이 같이 쓰던 달력 로직이라
// 공용으로 빼둔 것 — 그 화면이 없어진 지금도 홈 화면이 계속 쓰고 있어서 그대로 둠

import { CATEGORY_ORDER } from '@/constants/moa-colors';

export type DeadlineLike = { startDate: string; categoryId: string };

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// 정책들을 "신청 시작일" 기준으로 날짜(day 숫자)별로 묶어줌 — 캘린더에 점(dot) 찍는 데 씀.
// 마감일 기준으로 찍으면 마감일까지 매일 다른 정책이 걸려서 "매일 뭔가 있다"처럼 보이기 쉬워서,
// 신청이 실제로 열리는 날 하루에만(시작일) 점이 찍히게 함. 마감(D-day)은 카드 안 배지로 따로 보여줌.
// 같은 날 같은 카테고리에 정책이 여러 개 있어도 점은 카테고리당 1개만 찍음(2개면 점 2개처럼
// 보이는 게 아니라 "이 분야에 뭔가 있다"만 알려주면 되니까) — 점 순서는 항상 주거·자산·취업·교육·복지 순.
export function groupDeadlinesByDay(deadlines: DeadlineLike[], year: number, month: number) {
  const map: Record<number, Set<string>> = {};
  for (const d of deadlines) {
    const dt = new Date(d.startDate);
    if (dt.getFullYear() === year && dt.getMonth() === month) {
      const day = dt.getDate();
      (map[day] ??= new Set()).add(d.categoryId);
    }
  }
  const result: Record<number, { categoryId: string }[]> = {};
  for (const [day, categoryIds] of Object.entries(map)) {
    result[Number(day)] = CATEGORY_ORDER.filter((catId) => categoryIds.has(catId)).map((catId) => ({
      categoryId: catId,
    }));
  }
  return result;
}

// 특정 연/월(month는 0=1월)의 달력 칸을 만드는 함수.
// 이번 달 앞뒤로 빈 칸을 채워서 7의 배수(한 주 단위)로 맞춰줌.
export function buildMonthGrid(year: number, month: number) {
  const firstWeekday = new Date(year, month, 1).getDay(); // 0=일요일
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: { day: number; inMonth: boolean }[] = [];
  for (let i = firstWeekday - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, inMonth: true });
  }
  let next = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ day: next++, inMonth: false });
  }

  // 7개씩 끊어서 "주" 단위 배열로 변환
  const weeks: { day: number; inMonth: boolean }[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}
