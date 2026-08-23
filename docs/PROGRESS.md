# Fit Me — 진행 상황 정리 (~2026-08-23 기준, 온통청년 연동 파이프라인 포함)

> 이 문서는 컴퓨터가 갑자기 꺼지거나(자동 업데이트 등) 세션/대화 맥락이 날아가도, 지금까지
> 무엇을 왜 이렇게 만들었는지 다시 파악할 수 있게 남겨두는 기록임. Claude(나)가 나중에 다시
> 이 프로젝트를 열었을 때 제일 먼저 읽어야 할 문서. 코드가 실제 진실이고 이 문서는 "왜 이렇게
> 됐는지"에 대한 스냅샷이니, 코드와 다르면 코드를 믿을 것.

## 한 줄 요약

**"Fit Me"** — 청년정책(주거/자산/취업/교육/복지) 마감일을 캘린더로 보여주고, 내 프로필과
비교해서 지금 지원 가능한 게 뭔지 알려주는 Expo(React Native) 앱. Supabase로 인증/데이터 관리.

## 스택 & 항상 지켜야 하는 규칙

- Expo Router 54 (file-based routing) + React Native + TypeScript + Supabase (Auth + Postgres, RLS 사용)
- **AGENTS.md 필수 규칙**: Expo가 최근 크게 바뀌었으니, 코드 작성 전에 반드시
  https://docs.expo.dev/versions/v54.0.0/ 의 버전별 문서를 확인할 것.
- **검증 워크플로우**: 뭘 고치든 항상 `npx tsc --noEmit -p .` → `npx eslint . --ext .ts,.tsx` 순서로
  돌려서 확인함 (저장소 루트 `d:\cowork\moa-app`에서 실행). 항상 클린해야 정상이고, 유일하게
  예외인 건 `.expo/types/router.d.ts`의 "Unused eslint-disable directive" 경고 하나뿐(무해한
  기존 경고, 무시해도 됨).
- Supabase는 CLI/마이그레이션 툴 없이 `supabase/*.sql` 파일을 직접 관리하는 방식. 새 SQL 파일을
  만들면 **사용자가 Supabase SQL Editor에 직접 들어가서 수동으로 실행**해야 반영됨 — 이 저장소엔
  자동 마이그레이션 러너가 없음.

## 지금 git 상태

- **2탭(홈+전체) 구조로 최종 확정됨 (2026-08-23)** — 그동안 별도 브랜치에서 보류하던 구조 변경을
  전부 `main`에 머지 완료. 지금은 `main` 브랜치 하나만 남아있음(작업하던 feature 브랜치들은 머지
  후 로컬/원격 모두 정리해서 삭제함).
  - `feature/reminders-explore-region-onboarding` → `main` 머지 (알림 예약, 찜 탭 신설, 지역
    드롭다운, 로그인 소개문구)
  - `feature/more-tab-notifications-social` → `main` 머지 (홈=찜 캘린더 구조 개편, 전체 탭,
    알림 화면 리디자인, 소셜로그인 스캐폴딩, 검색 정렬 개편)
  - 예전에 있었던 `feature/saved-search-nearmiss`, `fix/profile-loading-flicker`도 이미
    머지됐던 걸 확인하고 정리 삭제함.
- 앞으로는 새 작업 시작할 때 `main`에서 새 브랜치를 따는 흐름으로 이어가면 됨.

## 화면 구조 (현재)

- `app/login.tsx` — 이메일/비번 로그인+회원가입 + 카카오/네이버 "간편로그인" 버튼(스캐폴딩만,
  아래 참고)
- `app/(tabs)/_layout.tsx` — 탭 2개: **홈**(`index`) / **전체**(`more`). `explore` 탭은 삭제됨
  (예전엔 "찜한 정책" 탭이었는데 홈 화면에 기능이 흡수됨).
- `app/(tabs)/index.tsx` — **홈 화면**. 이제 "내가 찜한 것만" 보여주는 캘린더+목록 화면.
- `app/search.tsx` — 검색 화면(찜 여부와 무관하게 전체 공고에서 검색). 홈 화면 검색창을 누르면
  진입.
- `app/(tabs)/more.tsx` — **전체 탭**. MY(내 정보/내가 지원한 공고) / 커뮤니티(내가 쓴 글/댓글,
  둘 다 "준비 중") / 회원(로그아웃, 회원탈퇴) / 서비스(개인정보 처리방침) 메뉴 허브.
- `app/notifications.tsx` — 🔔 알림 화면. 진짜 알림 카드처럼 보이게 디자인.
- `app/edit-profile.tsx` — 프로필 수정(생년월일/지역/소득/주택 소유 여부 등, 지역은 시/도→시/군→구
  캐스케이딩 드롭다운).
- `app/deadline/[id].tsx` — 정책 상세 화면(자격요건 체크리스트, "이런 점이 좋아요!", 관련 링크).
- `app/privacy-policy.tsx` — 개인정보 처리방침 초안(법적 검토 안 된 draft라고 명시돼있음).

## 기능별 현재 상태 & 이유

### 1. 홈 화면 = "내가 찜한 것만" 캘린더 (가장 큰 구조 변경)

전에는 "찜한 정책" 전용 탭이 따로 있었는데, 사용자가 명시적으로 확인(AskUserQuestion) 후 **그
탭을 없애고** 홈 화면 자체를 "찜한 것만" 보여주는 캘린더/목록으로 바꿈. 관심분야 칩(전체+5개
카테고리)은 그대로 유지, 거기에 `savedIds.has(d.id)` 필터가 추가로 걸림. 탭바는 **홈 + 전체
2개**로 줄어듦.

- 캘린더 점(dot)은 항상 "신청 시작일" 기준(마감일 기준으로 찍으면 마감일까지 매일 뭔가 있는 것처럼
  보여서 헷갈림). 우측 하단에 안내문구: "캘린더는 '찜'한 공고 신청 시작일을 표시합니다".
- 목록은 진행 중 / 예정 / 마감 3개 섹션으로 분리 (`lib/deadlineUtils.ts`의 `computeDday` phase 기준).
  전엔 마감 섹션이 0건이면 안 보였는데, 찜 기반으로 바뀌면서 그게 이상해 보여서 **항상 렌더링**하고
  0건이면 빈 문구만 보여주는 걸로 수정함.
- 정렬 토글(`renderSortToggle()`) — **오늘(08-22~23) 검색 화면과 통일함**: 인기순/지원 가능순이
  서로 독립적인 체크박스(둘 다 켤 수 있음, 배타적 아님). 둘 다 꺼지면 기본값(마감순) — 진행중/예정은
  마감일 빠른 순 오름차순, 마감 섹션은 최근에 마감된 것부터(내림차순). 이 토글은 진행중/예정/마감
  섹션 + 날짜 선택했을 때의 목록까지 전부 동일 로직 공유 (`sortHomeList()` 헬퍼).
  - **주의**: 예전엔 "인기순 vs 지원가능순"이 서로 배타적(하나 누르면 다른 게 꺼짐)이었는데
    2026-08-23에 검색 화면과 똑같이 "동시에 켤 수 있게" 바꿔달라는 요청으로 변경됨. `HomeSortMode`
    타입(`'none'|'popular'|'eligible'`)을 없애고 `homeSortPopular`/`homeSortEligible` 두 개의
    독립 boolean으로 교체함.
- 검색창(진짜 검색 아님, `/search`로 이동하는 트리거): 문구는 여러 번 다듬어져서 최종
  "나와 'Fit'한 공고 '찜'하기!" (위에 힌트 줄 "모든 공고가 보고싶다면?").
- 상단 바: 🔔(알림, `/notifications`)와 👤(프로필, `/edit-profile`) 아이콘. 색은 연한 초록
  `#9FDAC0`, 원형 배경 없음(아이콘만).

### 2. 검색 화면 (`app/search.tsx`)

- 카테고리 줄: 전체(하늘색 `#4FC3EE`) + 5개 카테고리. 마지막 카테고리 하나까지 끄면 자동으로
  "전체"로 되돌아감(0개 선택 상태 자체를 없앰 — 예전에 그 상태에서 검색결과 0건 + 레이아웃 버그가
  있었음).
- 정렬/필터 토글 — **2026-08-23 기준 순서와 의미가 바뀜**:
  **인기순 → 지원 가능순 → 찜만 보기 → 마감된 공고 제외**
  - "찜 우선"(정렬 가중치)이었던 걸 **"찜만 보기"(순수 필터)**로 바꿈. `savedOnly`가 켜지면
    `excludeClosed`처럼 그냥 목록에서 안 찜한 건 다 빠짐 — 정렬엔 관여 안 함.
  - 인기순/지원가능순은 여전히 서로 독립(체크박스), 둘 다 켜면 인기순이 먼저 적용되고 동점일 때만
    지원가능순으로 다시 나뉨.
  - 아무 정렬 토글도 안 켜져 있을 때 기본 정렬: 마감 안 된 건 위, 마감된 건 아래로 가라앉고,
    그 안에서 마감 안 된 건 마감일 빠른 순, 마감된 건 최근 마감 순.
  - **정렬 우선순위 관련 중요 규칙**(사용자가 명시적으로 두 번 정정함): 인기순/지원가능순 같은
    "사용자가 직접 켠 정렬"은 마감 여부보다 우선함 — 즉 마감된 공고라도 인기가 많으면 그 기준으로
    위로 올라올 수 있음. 마감된 걸 아예 안 보고 싶으면 "마감된 공고 제외"를 따로 켜야 함.
- 각 토글 줄(카테고리 줄, 정렬 줄)은 가로 스크롤인데, 예전에 "검색어를 입력해서 결과가 0건이 되면
  줄 높이가 갑자기 커졌다가 지우면 원래대로 돌아오는" 버그가 있었음. 여러 번 시도 끝에(아래
  "해결한 버그" 참고) **ScrollView를 높이 고정+overflow:hidden인 일반 View로 감싸는** 패턴으로
  확정.

### 3. 알림 화면 (`app/notifications.tsx`)

- 실제 푸시 알림(`lib/notifications.ts`가 마감 5일/3일/1일 전 오전 9시에 예약)을 놓쳤거나 모아서
  보고 싶을 때를 위한 화면. 오늘 기준 정확히 D-5/D-3/D-1인 찜한 공고만 알림 카드처럼 보여줌
  (2일/4일 전처럼 애매한 날은 실제 알림도 안 가므로 여기서도 표시 안 함).
- 카드 디자인: 좌상단에 작은 날짜, 헤드라인 "⏰ Fit한 공고 마감 N일 전" + 급할수록 느낌표 더 많이
  (`URGENCY_MARK`: 1일전=!!!, 3일전=!!, 5일전=!). 정책 제목은 2번째 줄로 작게. **찜 버튼 없음**
  (진짜 "알림"처럼 보이게 하려고 일부러 `DeadlineCard` 안 쓰고 이 화면 전용으로 따로 그림).
- 탭하면 카드가 아니라 **바로 그 정책 상세 화면**(`/deadline/[id]`)으로 이동.

### 4. 찜 개수(인기도) 기능

- `saved_policies` 테이블은 RLS로 자기 행만 조회 가능해서, 전체 찜 개수 집계를 위해 별도
  Supabase **VIEW**를 만듦: `supabase/policy_save_counts.sql` (policy_id, count만 노출, user_id
  없음, `authenticated`에 GRANT SELECT). **이 SQL, 아직 Supabase SQL Editor에서 수동 실행
  안 했으면 인기순 관련 기능이 전부 0으로 보임 — 외부 작업 필요, 잊지 말 것.**
  - `lib/usePolicySaveCounts.ts`가 이 뷰를 읽어서 `Map<policyId, count>` 제공.
  - `components/deadline-card.tsx`가 하트 버튼 아래 작은 숫자로 찜 개수 표시(0이면 숨김).
  - 찜 버튼 누른 직후 카운트가 바로 안 늘어나 보이는 버그가 있었음 → `onToggleSave`에서
    `await toggleSaved(...)` 직후 `refreshSaveCounts()` 즉시 호출해서 해결.

### 5. 알림 예약 시스템 확장 (D-5/D-3/D-1)

- 예전엔 D-1 하루 전만 예약했는데 D-5/D-3/D-1 세 시점으로 확장.
- `saved_policies.notification_id` 컬럼이 원래 알림 id 하나만 저장하는 `text` 컬럼이었는데,
  스키마 변경 없이 콤마로 join한 여러 id를 저장하는 방식(`packIds`/`unpackIds` 헬퍼,
  `lib/useSavedPolicies.ts`)으로 확장함.

### 6. 소셜 로그인 (카카오/네이버) — **스캐폴딩만, 아직 실제로 안 됨**

- `app/login.tsx` 하단에 "간편로그인" 섹션 추가: 원형 카카오/네이버 아이콘
  (`components/social-icon.tsx`, 이미지 없이 View로 그림), "최근 로그인" 말풍선 배지가
  AsyncStorage(`fitme.recentSocialLogin`)로 마지막 사용한 걸 기억해서 그 위에 표시됨.
- `lib/socialAuth.ts` — Supabase `signInWithOAuth` + `expo-web-browser`/`expo-linking`으로 코드
  교환하는 로직은 다 짜여 있지만, **카카오/네이버 개발자 콘솔에 앱 등록 + Supabase 대시보드에서
  provider 설정**을 해야 실제로 로그인이 됨. 이건 외부 작업이라 내가 코드로 대신 할 수 없음.

### 7. 프로필/지역 UX 개편

- 자유 텍스트였던 시/군, 구 입력을 없애고 `lib/profileFields.ts`의 `REGION_DATA`(17개 시/도)와
  `CITY_DISTRICTS`(구 있는 11개 시: 수원/성남/안양/안산/고양/용인/청주/천안/전주/포항/창원)
  기반 캐스케이딩 드롭다운으로 교체.
- `app/edit-profile.tsx`의 `CollapsiblePicker` + `RegionFields` — 홈 화면 아코디언(▾/▸) 스타일과
  통일. 상위 선택 바뀌면 하위 선택 자동 초기화.
- 프로필 완성도(%) 계산도 `effectiveTotalFieldCount(province, city)`로 구 있는 지역이냐 아니냐에
  따라 분모가 달라지게 정확히 맞춤.

### 8. "전체" 탭 (`app/(tabs)/more.tsx`)

사용자가 준 스펙 그대로: MY(내 정보→실제 연결, 내가 지원한 공고→준비 중) / 커뮤니티(내가 쓴
글·댓글→둘 다 준비 중) / 회원(로그아웃→실제 동작, 회원탈퇴→**부분 구현**: `saved_policies`+
`profiles` 행은 지움+로그아웃까지 하지만 **실제 Supabase Auth 계정 자체는 안 지워짐** — 그건
서버 사이드 Edge Function(admin API)이 있어야 가능해서 클라이언트 코드로는 못 함, 명시적으로
코드 주석에 남겨둠) / 서비스(개인정보 처리방침 → `/privacy-policy` 연결).

### 9. Fit Me 로고 (`components/fit-me-logo.tsx`)

여러 번 완전히 갈아엎음: 카메라 뷰파인더 프레임(민트 코너 브래킷) → 손 모양 SVG(반려, 참고 이미지랑
너무 달라짐) → 다시 추상적인 민트 프레임 + 기울어진 "F" → "Fit Me 기울지말아줘" 요청으로 기울기
제거 → 좌상단/우하단 코너에만 브래킷(긴 팔+짧은 팔 비대칭), 우상단/좌하단은 없앰. 두께/길이/글자와의
간격 여러 번 미세 조정 완료.

### 10. 데이터 관련

- `data/deadlines.ts`: `RAW_DEADLINES`(하드코딩 mock, 다수 항목) →
  `DEADLINES = RAW_DEADLINES.filter(isWithinExpiryWindow)`, `EXPIRY_WINDOW_DAYS = 14`로 마감
  14일 지난 건 자동으로 화면에서 숨김(로드할 때마다 오늘 날짜 기준 재계산).
- 일부 대표 항목(카테고리별 5개 정도)에 `perks`(이런 점이 좋아요!)/`links`(관련 링크) 필드 채움,
  나머진 비어있음.
- **앱은 아직 이 mock을 그대로 씀 — 아래 11번 항목이 "진짜 데이터는 준비됐지만 앱이 아직 안 갈아탄"
  상태를 설명함.**

### 11. 실제 온통청년 데이터 파이프라인 (Phase 3, 2026-08-23 — 절반 완료)

**끝난 것: 실제 데이터를 Supabase에 채워넣는 파이프라인.**
- [supabase/policies.sql](../supabase/policies.sql) — 새 `public.policies` 테이블. `saved_policies`/
  `profiles`와 달리 "공개 정책 목록"이라 RLS는 "로그인하면 누구나 읽기"만 있고, 쓰기는
  `service_role`(RLS 우회)로만 함.
- [scripts/syncYouthPolicies.js](../scripts/syncYouthPolicies.js) — `npm run sync-policies`로 실행하는
  서버 전용 동기화 스크립트(Node `--env-file=.env`로 실행, dotenv 패키지 불필요). 온통청년
  `/go/ythip/getPlcy` 엔드포인트(문서에 있던 옛날 `/opi/youthPlcyList.do`가 아님, [[youthcenter-api-key-renewal]]
  참고)를 페이지네이션 돌면서 전체를 가져오고(재시도/백오프 포함 — 서버가 가끔 HTML 에러페이지나
  totCount 0을 잠깐 주는 걸 실측함), 우리 스키마로 매핑, 저장 대상만 걸러서 upsert함.
  - **카테고리 매핑**: 온통청년 대분류(lclsfNm)로 1차 매핑(일자리→job/교육→edu/주거→housing/나머지
    전부→welfare catch-all). 자산(money)만 예외 — 온통청년엔 "자산형성" 중분류가 아예 없고 제일
    가까운 "취약계층 및 금융지원"도 실측해보니 85%가 복지성(학자금대출이자, 상담, 보험)이라, 그건
    기본 welfare로 보내고 제목/설명에 저축·적금·자산형성·도약계좌 등 진짜 키워드가 있는 것만
    공식분류 무시하고 money로 강제 지정함.
  - **날짜 파싱**: `aplyYmd`("YYYYMMDD ~ YYYYMMDD") 우선, 없으면 `bizPrdBgngYmd/EndYmd`. 원본에
    `00010101`/`29991231` 같은 더미값이 실제로 섞여있는 걸 발견해서 연도 2015~2035 범위 검증 추가.
    둘 다 없거나(연중/상시모집) 검증 실패하면 `is_rolling=true`로 표시(날짜는 null).
  - **동기화 기간 필터(사용자 요청, "너무 많아서")**: 전체를 다 저장하지 않고, **시작일이 오늘+2달
    이내 이거나(이미 시작한 것 포함) / 마감일이 오늘-1달 이내인 것만** 저장. 상시모집은 무조건 포함.
    재동기화할 때마다 이 기준으로 다시 걸러지고, 기간 밖으로 벗어난 기존 row는 delete로 정리됨(4단계).
    **아직 자동/주기 실행(cron) 없음 — 수동으로 `npm run sync-policies` 재실행해야 최신 상태 유지됨.**
  - **소득 조건은 스킵**: `earnCndSeCd`류가 코드값이라 공통코드 조회 없인 "제한없음"인지 실제
    금액조건인지 구분 불가 — 잘못된 조건으로 거르느니 아예 안 넣음(연령 조건만 채움).
  - **카테고리 6개로 확장(2026-08-23)**: "참여" 신설. 온통청년 "참여･기반"(청년참여활동/
    정책인프라구축/국제교류/권익보호)이 원래 5개 카테고리 어디에도 안 맞아서 welfare로 몰아넣었더니
    복지 칩이 지나치게 커지고 분류도 부정확해서(참여 모집 공고를 "복지"라 부르는 셈) 분리함.
    `constants/moa-colors.ts`에 `participation`(로즈색, 🙋) 추가 — CATEGORY_ORDER를 순회하는
    기존 칩 UI 패턴 덕분에 홈/검색 화면은 파일 하나만 고쳐도 자동으로 6번째 칩이 나타남.
  - **동기화 기간 필터 좁힘 + 상시모집 제외(2026-08-23)**: 처음엔 시작일 2달/마감일 1달 + 상시모집
    무조건 포함이었는데, 상시모집이 전체의 59%(740/1,268)를 차지해서 날짜 필터를 좁혀도 "너무
    많다"는 문제가 거의 안 줄어드는 게 확인됨 → 시작일 1달/마감일 2주로 좁히고, **상시모집은
    동기화 대상에서 제외**함(`is_rolling` 스키마/로직 자체는 남겨둠 — 나중에 다시 켜고 싶으면
    `isWithinSyncWindow` 한 줄만 되돌리면 됨).
  - **최종 실행 결과(2026-08-23)**: 2,728건 수신 → 필터 후 **508건 저장** (상시모집 0건).
    카테고리 분포: job 169 / welfare 131 / edu 82 / participation 62 / housing 60 / money 4.

**아직 안 끝난 것: 앱 화면을 이 `policies` 테이블에 연결하는 것.** 지금 앱은 여전히
`data/deadlines.ts`의 하드코딩 mock을 그대로 읽음. 연결하려면 최소 이런 변경이 필요함:
- `startDate`/`deadlineDate`를 다루는 ~10개 파일(`app/(tabs)/index.tsx`, `app/search.tsx`,
  `app/deadline/[id].tsx`, `app/notifications.tsx`, `lib/calendarUtils.ts`, `lib/deadlineUtils.ts`,
  `components/deadline-card.tsx` 등)이 전부 "두 날짜가 항상 존재한다"고 가정하고 있어서, 상시모집
  (`is_rolling`, 날짜 null)을 위한 새 phase/배지("상시모집")를 추가하고 nullable 날짜를 다뤄야 함.
  캘린더 점 찍기·정렬(`sortHomeList` 등)도 null 날짜 케이스를 처리해야 함.
- 하드코딩 배열 대신 Supabase `policies`를 읽는 새 훅(예: `lib/usePolicies.ts`)이 필요함.
- 이건 이번 세션에서 손 안 댐 — 다음에 이어서 할 큰 작업으로 남겨둠.

## 지금까지 근본 원인까지 찾아서 고친 버그들

1. **다크모드에서 탭 아이콘이 안 보임** — `constants/theme.ts`의 `Colors[colorScheme].tint`가
   시스템 다크모드일 때 흰색(`#fff`)을 반환하는데, 이 앱 화면은 라이트 팔레트로 고정돼있어서
   (`app/_layout.tsx` 참고) 밝은 탭바 위에 흰 아이콘이 사라져 보였음. → `app/(tabs)/_layout.tsx`에서
   시스템 설정과 무관하게 `COLORS.mint`/`COLORS.inkSoft`로 하드코딩해서 해결.
2. **검색 화면 토글 줄 높이가 검색 중에 갑자기 커짐** — 4번의 시도 끝에 해결. ScrollView 자체의
   `style={{height}}`만으로는 내부 콘텐츠 크기에 따라 프레임이 재측정되면서 부풀어 오르는 경우가
   있었음. 최종 해결책: ScrollView를 감싸는 바깥 `<View style={{height:N, overflow:'hidden'}}>`을
   추가 — ScrollView 자체 height 스타일에 의존하지 않고 바깥 View가 확실히 못 벗어나게 막음.
3. **홈 화면 "마감" 섹션이 사라져 보임** — `{closedDeadlines.length > 0 && (...)}` 조건부 렌더링이
   원인. 찜 기반으로 바뀌면서 마감 0건인 경우가 흔해져서 다른 두 섹션(진행중/예정)과 다르게
   갑자기 사라진 것처럼 보였음 → 항상 렌더링하고 0건이면 빈 문구로 대체.
4. **검색 카테고리 0개 선택 상태의 데드엔드+레이아웃 버그** — 마지막 카테고리를 꺼서 0개가 되면
   자동으로 "전체"로 되돌리게 수정.
5. **찜 개수가 바로 안 갱신됨** — 찜 토글 직후 `refreshSaveCounts()` 즉시 호출로 해결.

## 아직 안 끝난 것 / 외부 작업 필요 (내가 코드로 못 하는 것들)

- [x] ~~`supabase/policy_save_counts.sql`을 Supabase SQL Editor에서 수동 실행~~ — 2026-08-23,
  사용자가 직접 SQL Editor에서 실행 완료. 인기순 정렬/찜 개수 표시 실제로 동작함.
- [ ] 카카오/네이버 개발자 콘솔에 앱 등록 + Supabase 대시보드 OAuth provider 설정 — 안 하면
  소셜 로그인 버튼 눌러도 실제 로그인 안 됨.
- [ ] 회원탈퇴 시 실제 Supabase Auth 계정 삭제 — Edge Function(admin API) 필요, 지금은 프로필/찜
  데이터만 지우고 로그아웃함.
- [ ] "내가 지원한 공고"/커뮤니티(내가 쓴 글/댓글) — 전부 UI만 있고 "준비 중" placeholder.
- [x] ~~2탭 vs 3탭 구조 최종 결정~~ — 2026-08-23, **2탭(홈+전체)으로 확정**하고 `main`에 전부 머지 완료.
- [~] 실제 공공 API(온통청년 등) 연동해서 mock 데이터 교체 — **절반 완료(2026-08-23)**. 실제 데이터를
  Supabase `policies` 테이블에 넣는 파이프라인(`supabase/policies.sql` + `npm run sync-policies`)은
  끝났고 1,268건 실제로 들어가있음. **남은 절반: 앱 화면이 아직 이걸 안 읽고 여전히
  `data/deadlines.ts` mock을 씀** — 상세는 위 10번 항목과 [[youthcenter-api-key-renewal]] 참고.

## 관련 메모리 파일

- [[fit-me-project-overview]] — 코드 아키텍처 요약(이 문서보다 짧고 구조 중심)
- [[youth-policy-api-sources]] — 실제 정책 데이터 API 연동 리서치
- [[youthcenter-api-key-renewal]] — 온통청년 API 키 만료일(2027-08-21) 등
