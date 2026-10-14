# WU-6 — 운영자 시장 편집 화면 검증

Canonical requirements: `../prd.md` FR-5/6, `../tasks.md` WU-6. 범위: admin/frontend와 이 검증 기록. WU-5 HEAD의 실제 `EditMarketUseCase.Detail` 계약을 사용한다 (공개 `MarketResponse`와 다름).

## 구현

- `/place/markets` 라우트·시장 가게 메뉴: 이름 검색·20건 페이지 목록 → 시장 상세. 가게 표는 합성 이름·품목·구역·IN/OUT/UNKNOWN, 원천 출처·작업자·핀 종류, override 값·이유를 표시한다.
- 일반 표시값 수정은 MANUAL을 포함하여 override API만 사용한다. 변경된 필드만 보낸다. 수정·보정 해제 모두 trim된 이유를 요구하며 공백 이유는 저장할 수 없다. 좌표는 쌍으로 설정·해제한다.
- MANUAL 생성·전체 수정·삭제는 별도 폼. EXACT 지도 클릭 좌표 또는 같은 시장의 다른 EXACT·IN·좌표 보유 가게를 선택한 REFERENCE(옆/맞은편/앞/뒤 + 필수 메모). 기존 원본 폼 필드를 유지한다.
- 외부 지도 라이브러리·키 없는 SVG. portal의 equirectangular metres/isotropic fit과 같은 상수·범위, inverse 변환. 빈 지도는 시장 중심 (없으면 서울 기본 중심). 클릭 꼭짓점·3점 이상 닫기·취소, 폴리곤 WKT 저장. 정확 핀 드래그는 위치 변경 초안과 이유 입력으로 이어지고 이동 중 projection은 고정된다. REFERENCE는 이웃 위치에서 점선 링으로 표시하며 UNKNOWN은 핀을 표시하지 않는다. 저장/조회 중 SVG 상호작용도 비활성화한다.
- STREET/MIXED 폴리곤 편집, BUILDING은 폴리곤 도구 없이 건물/동/층·parent 계층 편집. 구역 이름·전체 필드 편집, 참조 없는 구역 삭제 확인, 위/아래 순서는 전체 구역 ID 배열로 요청한다.
- 이력 20건 페이지: KST·작업자·대상·동작·전후 값 요약 및 전체 값 펼치기. 첫 되돌리기 클릭은 인라인 확인만 열고 API를 호출하지 않는다. 확인 후 POST, mutation 후 목록·상세·이력 재조회. stale revert 409는 친절한 충돌 문구를 표시한다. `confirm()` 미사용.
- 조회 중·저장 중·실패·재시도·빈 목록/가게/구역/이력 상태. 상세 조회 실패 시 이전 상세를 제거한다. 목록과 상세 loading은 따로 추적한다.

## 최종 검증 증거 (2026-10-15)

실행 위치: `admin/frontend`, 설치된 로컬 `node_modules/.bin` 사용. 전체 suite·Vite build·설치·Gradle·브라우저/컴퓨터 사용·배포·스테이징·커밋은 실행하지 않았다.

| 명령 | 결과 |
|---|---|
| `./node_modules/.bin/tsc -b tsconfig.wu6.app.json tsconfig.wu6.node.json --force` | exit 0, 출력 없음 |
| `./node_modules/.bin/vitest run --no-cache src/pages/markets/__tests__/editorState.test.ts src/pages/markets/__tests__/MarketsPage.test.tsx src/api/__tests__/markets.test.ts` | `Test Files 3 passed (3)` · `Tests 12 passed (12)` |
| `./node_modules/.bin/eslint src/api/markets.ts src/api/__tests__/markets.test.ts src/pages/MarketsPage.tsx src/pages/markets/StoreEditor.tsx src/pages/markets/ZoneEditor.tsx src/pages/markets/EditorMap.tsx src/pages/markets/editorState.ts src/pages/markets/__tests__/editorState.test.ts src/pages/markets/__tests__/MarketsPage.test.tsx src/App.tsx src/components/layout/Sidebar.tsx` | exit 0, 출력 없음 |
| `git diff --check` | exit 0, 출력 없음 |

`node_modules`는 worktree 밖 원본 설치를 가리킨다. 최초 직접 `tsc -b`는 기본 buildinfo 쓰기에서 EPERM, 최초 Vitest는 results cache 쓰기에서 EPERM이었다. 추적되는 tsconfig를 변경하지 않고, 작업 디렉터리에 임시 `tsconfig.wu6.app.json`/`tsconfig.wu6.node.json`을 만들어 원래 각각의 config를 extends하고 `tsBuildInfoFile`만 작업 디렉터리 파일로 지정했다. 타입 검사는 원래 include/옵션으로 전체 app/node 프로젝트를 확인한다. 검사 후 임시 config/buildinfo는 삭제했다. Vitest는 `--no-cache`로 최종 성공했다.

초기 타입 union narrowing과 Vitest `it.each` 배열 fixture를 수정한 후 위 최종 결과를 얻었다.

## 테스트 범위와 한계

- 순수 상태: set/clear 이유 필수·trim, polygon add/close/cancel·폐합 WKT, empty/single/multiple 좌표 inverse, 인라인 되돌리기 상태, KST 변환.
- 실제 컴포넌트: 이유 없는 저장·해제 disabled, 공백 이유 disabled, changed-fields-only payload, 첫 되돌리기 클릭 무요청 → 인라인 확인 → POST 및 재조회, 409 문구.
- API 계약: admin prefix·name/page/size, override 바디, 전체 구역 배열, revert POST.
- jsdom 기반 검증으로 실제 SVG pointer capture/드래그·화면 대비·반응형·실서버 role enforcement·통합 CRUD 실행은 검증하지 않았다. 컴퓨터 사용은 승인 범위 밖이라 실행하지 않았다. backend validation(폴리곤 자기교차, 계층 cycle, 참조가 남은 삭제)은 WU-5 API 오류를 표시하는 방식으로 연결했다.

## 사용자 CDP 검증 후 지정한 두 개선 (2026-10-15)

- 가게/이력 표만 `min-w-0 max-w-full overflow-x-auto` 래퍼에 넣고 최소 폭 1000/1100px·nowrap을 적용했다. 제목·추가 버튼·빈 상태·페이지 이동은 스크롤 밖에 둔다. 긴 이름·품목·구역·보정·전후 요약은 폭 제한 + ellipsis + title, 전체 원문 펼치기만 제한된 폭에서 줄바꿈한다. 페이지와 검색 flex 입력에 `min-w-0`을 적용했다.
- 지도 라벨은 기본 숨김, 선택/hover/focus/드래그 가게만 표시하고 폴리곤 작성 중은 모두 숨긴다. 표에서 연 가게와 핀 선택을 연결했다. 핀 title, 시각 반경 10, 투명 클릭 반경 22, keyboard Enter/Space와 disabled 처리를 추가했다. 핀 클릭은 편집 선택만 하고 4 client-pixel 이상 움직인 drag에서만 좌표 이동을 요청한다. 기존 projection·inverse·폴리곤 흐름을 유지했다.
- 변경 파일: `MarketsPage.tsx`, `markets/EditorMap.tsx`, `markets/editorState.ts`, `markets/__tests__/editorState.test.ts`, 신규 `markets/__tests__/EditorMap.test.tsx`. caller의 `market-harness.html`/`src/__marketHarness.tsx`는 변경하지 않았다.

추가 최종 실행 (`admin/frontend`):

| 명령 | 결과 |
|---|---|
| `./node_modules/.bin/tsc -b tsconfig.wu6.app.json tsconfig.wu6.node.json --force` | exit 0, 출력 없음 (동일 extends/buildinfo 임시 config 방식, 실행 후 생성물 삭제) |
| `./node_modules/.bin/vitest run --no-cache src/pages/markets/__tests__/editorState.test.ts src/pages/markets/__tests__/EditorMap.test.tsx src/pages/markets/__tests__/MarketsPage.test.tsx` | `Test Files 3 passed (3)` · `Tests 18 passed (18)` |
| `./node_modules/.bin/eslint src/pages/MarketsPage.tsx src/pages/markets/EditorMap.tsx src/pages/markets/editorState.ts src/pages/markets/__tests__/editorState.test.ts src/pages/markets/__tests__/EditorMap.test.tsx` | exit 0, 출력 없음 |

라벨 순수 상태 테스트: 기본/선택/hover/drag/작성 중. 실제 map 컴포넌트 테스트: 기본 숨김→hover→선택→작성 중 숨김, title 대상 핀 hit 반경, 키보드 선택 무이동, disabled 선택 차단. 기존 시장 컴포넌트의 수정 이유/인라인 되돌리기 3건도 함께 회귀 확인했다. 이 추가 작업은 브라우저/CDP를 실행하지 않아 390px 실제 레이아웃과 pointer capture는 부모 세션의 후속 UI 확인 범위다. 설치·전체 build/suite·스테이징·커밋은 실행하지 않았다.
