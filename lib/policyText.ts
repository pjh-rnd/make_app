// 정책 상세 화면(app/deadline/[id].tsx)에서 온통청년 원문 텍스트를 다듬어 보여주기 위한 순수
// 함수 모음(2026-08-23 추가). raw jsonb 안의 자유 텍스트 필드(plcySprtCn 등)를 화면에 맞게
// 가공하는 로직만 모아둠 — 네트워크/상태 없음, 훅이 아님.

// "지원혜택" 헤드라인 — 경쟁 앱처럼 "최대 240만원"같이 계산된 총액을 보여주려면 실제 AI(LLM)
// 요약이 있어야 하는데(예: "학기별 30만원 × 최대 8학기" → "최대 240만원"은 산수를 해야 나옴),
// 이 프로젝트엔 아직 그런 연동이 없음. 대신 원문에서 "N만원"류 금액 패턴을 찾아 그대로 보여주는
// 수준으로 함 — 완벽한 요약은 아니지만 아예 안 보여주는 것보단 나음. 패턴을 못 찾으면(멘토링처럼
// 금액이 아예 없는 정책 등) null을 돌려주고, 화면에서 그 줄 자체를 숨김.
const AMOUNT_RE = /(최대|최고|월|연)?\s?[0-9][0-9,]*\s?(?:만원|천원|억원)(?:\s?(?:까지|이내))?/;

export function extractSupportHighlight(
  ...texts: (string | null | undefined)[]
): string | null {
  for (const text of texts) {
    if (!text) continue;
    const match = text.match(AMOUNT_RE);
    if (match) return match[0].replace(/\s+/g, ' ').trim();
  }
  return null;
}

export type PolicyGuide = { headline: string | null; bullets: string[] };

// "정책 안내"를 두괄식(결론/핵심 먼저) + "-" 불릿으로 다듬음. 짧은 요약(plcyExplnCn = summary)을
// 첫 줄로 먼저 보여주고, 더 긴 설명(plcySprtCn = detail)을 줄 단위로 쪼개 "-" 불릿으로 나열함.
// 온통청년 원문에 이미 "-"/"□"/"ㅇ" 같은 기호가 붙어있는 경우가 많아서, 그건 떼고 "-"로 통일함.
export function formatPolicyGuide(
  summary: string | null | undefined,
  detail: string | null | undefined
): PolicyGuide {
  const headline = (summary || '').trim() || null;
  const bodySource = (detail || '').trim();

  // 온통청년 데이터에서 요약(plcyExplnCn)과 상세(plcySprtCn)가 완전히 같은 텍스트인 경우가
  // 종종 있음 — 그럴 땐 불릿을 또 안 만들고 헤드라인 한 번만 보여줌(중복 방지)
  if (!bodySource || bodySource === headline) {
    return { headline, bullets: [] };
  }

  const bullets = bodySource
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-□○ㅇ*·]\s*/, '').trim())
    .filter(Boolean)
    .map((line) => `- ${line}`);

  return { headline, bullets };
}

// 댓글 작성 시각을 "방금 전"/"N분 전"/"N시간 전"/"N일 전"/날짜로 사람이 읽기 쉽게 바꿔줌
export function formatRelativeTime(isoString: string): string {
  const then = new Date(isoString).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}일 전`;
  const d = new Date(then);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}
