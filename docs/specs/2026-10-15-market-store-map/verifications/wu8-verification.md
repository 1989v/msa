# WU-8 — 상인회 화면 검증

Scope: `prd.md` FR-8~11 / `tasks.md` WU-8. WU-7 API 계약을 그대로 사용했고 백엔드는 변경하지 않았다. 사용자가 확인한 범위에 따라 신규 수동 가게는 **참고 위치만** 등록한다. 브라우저·CDP·computer use, git add/commit/push, 전체 suite/build는 실행하지 않았다.

## 화면과 경로

- 시장 상세 `AttractionMarket` 하단: 비로그인에는 apex 로그인 링크(`buildLoginHref`, 현재 절대 URL로 복귀). 로그인 회원은 DB market ID로 자기 신청 조회. 없음/REJECTED는 단체명·연락처 폼, PENDING은 `승인 대기`, SUSPENDED는 `정지됨 — 운영자 문의`, ACTIVE는 `가게 정보 관리` 링크. 조회 중·실패·검증·저장 중·신청 실패를 구분하며 조회 실패를 미신청으로 취급하지 않는다.
- place `/markets/:marketId/manage`, `/en/markets/:marketId/manage`: 기존 `placeRoute` 리다이렉트 규칙 사용. 직접 GET manage가 ACTIVE를 확인해야만 편집기를 표시한다. `useSeo({ noindex: true, canonical: null })`; prerender/sitemap 등록 없음.
- 관리 화면: 가게 목록 → 표시값 수정/수동 가게 수정, 수동 가게 추가 폼, 구역별 이름 변경 폼. 모바일에서 세로 배치하며 기존 k-heritage `--ko-*`/`--kh-*` 토큰, 44px 이상 조작영역, 명시적 label/focus 사용. 새 색상 hex 없음.
- 표시값은 이름·품목·소속·구역만 전송하며 수정 이유 필수. 수동 가게는 기준 가게 + 상대 위치 + 메모 필수인 REFERENCE 입력, 기존 EXACT 수동 가게 수정은 좌표를 보존한다. MANUAL만 삭제 버튼과 인라인 확인 제공. 폴리곤·좌표 이동·되돌리기·구역 삭제 UI/호출 없음. 구역은 기존 필드를 유지하여 이름만 변경한다.
- GET/쓰기 403은 `이 시장 관리 권한이 없습니다.` 전용 화면으로 대체한다. 만료된 로그인은 apex 로그인 링크로 재진입 가능. 저장 후 재조회 실패를 저장 성공으로 보고하지 않는다.
- 어드민 `/admin/place/stewards`: 시장 관리와 같은 메뉴 그룹의 `상인회 신청`. 기본 PENDING 필터, 전체/상태 선택, 20개 페이지, 단체·연락처·시장 ID·회원 ID·신청일(KST)을 표시한다. API가 시장 이름을 제공하지 않으므로 `시장 #ID`로 식별한다. PENDING 승인/반려, ACTIVE 정지, SUSPENDED 복구만 제공하며 첫 클릭은 인라인 확인이다. `confirm()` 사용 없음.
- 공개 가게 배지: MANUAL과 기존 공공 원천의 보정 모두 `actorKind=STEWARD`이면 `상인회 제공`을 표시한다(영문 `Merchant association`). 원천 배지를 유지한다.

## 인증과 API

HttpOnly 토큰은 읽거나 헤더로 보내지 않는다. 기존 `attachRefreshRetry`를 사용하는 cookie API 패턴을 적용했고 로그인 표시/캐시 키는 기존 `isLoggedIn/getUserId`만 사용한다. 개인 신청·관리 query key에 회원 ID를 포함한다. 관리 query는 `staleTime:0`, `gcTime:0`; 매 요청 DB ACTIVE 검사와 403의 최종 권한 판단은 WU-7 서비스가 담당한다.

공개 응답 DTO `MarketResponse.Info.id`가 이미 DB ID를 제공한다. FE 타입만 추가하여 contentId를 관리 API ID로 오인하지 않는다. DTO fallback 시장의 null ID에는 신청 섹션을 표시하지 않는다. 신규 수동 가게의 좌표 없는 독립 입력은 WU-7 검증 계약에 없으므로 추가하지 않았으며 사용자가 참고 위치만 허용하는 범위를 확인했다.

## 실행 증거

2026-10-15, 현재 worktree에서 수행했다. 최초 두 FE `npx tsc -b`는 TS 소스 진단 없이 링크된 `node_modules/.tmp/*.tsbuildinfo` 쓰기에 `TS5033 / EPERM`으로 실패했다. 최초 Vitest도 테스트 자체는 portal11/admin3 통과했으나 같은 링크의 `.vite/vitest/results.json` 캐시 쓰기 EPERM으로 exit1이었다. 권한 변경이나 레포 밖 쓰기를 하지 않고 아래 방식으로 재검증했다.

임시 `.wu8-tsconfig.{app,node}.json`은 각각 기존 `tsconfig.{app,node}.json`을 extends하고 `tsBuildInfoFile`만 FE 작업 디렉터리로 변경했다. `.wu8-tsconfig.json`은 원본과 동일한 빈 files 및 app/node references를 사용했다. 기존 `include:["src"]`, strict/alias/compiler 설정을 모두 상속하므로 실제 소스 전체를 검사한다. 확인 후 이 임시 config/buildinfo는 제거했다.

| 위치/명령 | 출력/결과 |
|---|---|
| portal `node scripts/render-content.mjs` | search520/recommendation123/order179/ads219/catalog132개 개념 및 guides3장 생성, exit0 |
| portal `npx tsc -b .wu8-tsconfig.json` | 출력 없음, exit0 |
| admin `npx tsc -b .wu8-tsconfig.json` | 출력 없음, exit0 |
| portal `npx vitest run --no-cache src/pages/place/__tests__/stewardState.test.ts src/pages/place/__tests__/MarketStewardApplication.test.tsx src/pages/place/__tests__/MarketManagePage.test.tsx src/pages/place/__tests__/marketView.test.ts` | `Test Files 4 passed (4)` / `Tests 33 passed (33)`, exit0 |
| admin `npx vitest run --no-cache src/pages/markets/__tests__/stewardState.test.ts src/pages/markets/__tests__/MarketStewardsPage.test.tsx` | `Test Files 2 passed (2)` / `Tests 3 passed (3)`, exit0 |
| portal/admin changed TS/TSX files `npx eslint <changed-files>` | 출력 없음, exit0 |

최종 badge 정리 후 portal `npx tsc -b .wu8-tsconfig.json` 및 `npx vitest run --no-cache src/pages/place/__tests__/marketView.test.ts src/pages/place/__tests__/MarketManagePage.test.tsx`도 exit0: `Test Files 2 passed (2)` / `Tests 22 passed (22)`. 마지막 구역명 빈 입력 submit 방어 수정 후 manage 파일만 tsc/해당 테스트/해당 eslint를 재검증했다(exit0, `Test Files 1 passed (1)` / `Tests 3 passed (3)`, tsc/eslint 출력 없음).

Changed-file eslint 명령(각 FE 디렉터리에서 실행):

```sh
# portal-fe
npx eslint src/api/marketApi.ts src/api/marketStewardApi.ts src/pages/place/AttractionMarket.tsx src/pages/place/marketView.ts src/pages/place/stewardState.ts src/pages/place/MarketStewardApplication.tsx src/pages/place/MarketManagePage.tsx src/pages/place/__tests__/stewardState.test.ts src/pages/place/__tests__/MarketStewardApplication.test.tsx src/pages/place/__tests__/MarketManagePage.test.tsx src/pages/place/__tests__/marketView.test.ts src/App.tsx
# admin/frontend
npx eslint src/api/stewards.ts src/pages/markets/stewardState.ts src/pages/MarketStewardsPage.tsx src/pages/markets/__tests__/stewardState.test.ts src/pages/markets/__tests__/MarketStewardsPage.test.tsx src/App.tsx src/components/layout/Sidebar.tsx
```

테스트 범위: 신청 상태 매핑·단체/연락처 검증·게스트 로그인·신청 제출·로딩/조회 오류·ACTIVE/PENDING/SUSPENDED 표시, reference 입력 검증, 기존 marketView STEWARD 배지, noindex, 직접403, 정지 후 쓰기403 전용 화면·이유 필수·허용 필드 payload, reference-only 수동 생성 payload, 어드민 상태별 버튼·인라인 취소/확정·기본 필터·재조회.

## 변경 파일

Portal:
- `portal-fe/src/App.tsx`
- `portal-fe/src/api/marketApi.ts`
- `portal-fe/src/api/marketStewardApi.ts`
- `portal-fe/src/pages/place/AttractionMarket.tsx`
- `portal-fe/src/pages/place/AttractionMarket.css`
- `portal-fe/src/pages/place/MarketStewardApplication.tsx`
- `portal-fe/src/pages/place/MarketManagePage.tsx`
- `portal-fe/src/pages/place/stewardState.ts`
- `portal-fe/src/pages/place/marketView.ts`
- `portal-fe/src/pages/place/__tests__/marketView.test.ts`
- `portal-fe/src/pages/place/__tests__/stewardState.test.ts`
- `portal-fe/src/pages/place/__tests__/MarketStewardApplication.test.tsx`
- `portal-fe/src/pages/place/__tests__/MarketManagePage.test.tsx`

Admin:
- `admin/frontend/src/App.tsx`
- `admin/frontend/src/components/layout/Sidebar.tsx`
- `admin/frontend/src/api/stewards.ts`
- `admin/frontend/src/pages/MarketStewardsPage.tsx`
- `admin/frontend/src/pages/markets/stewardState.ts`
- `admin/frontend/src/pages/markets/__tests__/stewardState.test.ts`
- `admin/frontend/src/pages/markets/__tests__/MarketStewardsPage.test.tsx`

Evidence: this file only. Generated content files remain ignored. No other docs changed.

## 검증 한계 / 남은 판단

실제 브라우저의 테마·대비·모바일 화면, 로그인 세션·gateway·서버 DB와의 E2E는 확인하지 않았다. 사용자의 computer-use 금지 및 scoped 검증 지시를 지켰다. 화면 구조/토큰/label/focus는 소스로 검토했고 API 호출은 모킹한 컴포넌트 테스트로 확인했다. 이 한계를 제외한 추가 범위 결정은 남아 있지 않다. 가격·구역 생성/순서 변경·원천 필드 수정은 요청된 WU-8 UI에 추가하지 않았다.
