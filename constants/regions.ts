// 검색 화면(app/search.tsx) 지역 필터 칩에 쓰는 17개 시/도 목록(2026-08-23 추가).
// id는 정책 requirements.regionProvince(lib/matching.ts)와 정확히 같은 문자열(정식 명칭)이어야
// 매칭이 됨 — scripts/syncYouthPolicies.js의 PROVINCE_ABBR_TO_FULL 값들과 반드시 철자가 같아야
// 하므로, 둘 중 하나를 고치면 반드시 같이 고칠 것.
export const PROVINCES: { id: string; label: string }[] = [
  { id: '서울특별시', label: '서울' },
  { id: '부산광역시', label: '부산' },
  { id: '대구광역시', label: '대구' },
  { id: '인천광역시', label: '인천' },
  { id: '광주광역시', label: '광주' },
  { id: '대전광역시', label: '대전' },
  { id: '울산광역시', label: '울산' },
  { id: '세종특별자치시', label: '세종' },
  { id: '경기도', label: '경기' },
  { id: '강원특별자치도', label: '강원' },
  { id: '충청북도', label: '충북' },
  { id: '충청남도', label: '충남' },
  { id: '전북특별자치도', label: '전북' },
  { id: '전라남도', label: '전남' },
  { id: '경상북도', label: '경북' },
  { id: '경상남도', label: '경남' },
  { id: '제주특별자치도', label: '제주' },
];
