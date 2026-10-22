# 카페 v3 구현 보고 (2026-10-22)

승인된 `v3-reference.png`와 `V3Home/Results/Compare/Filter/FilterResults/Detail.dc.html` 구조를 기준으로 구현했다.
공통 하단 내비게이션을 유지하고, 카페 콘텐츠는 480px 최대 읽기 폭으로 정렬한다.
브라우저·컴퓨터 조작, 커밋·푸시·배포는 수행하지 않았다. 픽셀 단위 브라우저 렌더 비교는 검증 범위에 포함하지 않는다.

| 화면 | 구현 |
|---|---|
| `/cafe` | 아이콘·제목·부제, 둥근 검색 진입, API 실제 그룹 칩, 영양 비교 배너, 브랜드 수 기준 인기 음료 4개, 당류 10g/카페인 50mg/칼로리 200kcal 조건 진입. 활성 capability가 있을 때만 배너 아래 주변 행. |
| `/cafe/search?q=` | 검색 제출, 실제 서버 전체/브랜드별 총계(다른 조건 유지·선택 브랜드 제외), 수평 브랜드 탭, 온도/사이즈/정렬 popover, 컵 일러스트·브랜드 이니셜·원문 메뉴·온도/사이즈/용량·3색 영양 셀. |
| `/cafe/drink/{name}` | 컵·음료명·카페별 비교, 1회/100ml 기준, 브랜드/사이즈와 세 영양 수치 표, 브랜드별 전체 변형 선택. 표시 원천 수치에 따라 공동 최저 당류 전부 배지, 각 영양소 공동 최저 전부 결정적으로 추천. Web Share 또는 clipboard. |
| `/cafe/filter` | 당류/카페인/칼로리/디카페인 섹션 이동, 접근 가능한 범위 입력과 빠른 값, 디카페인 선택, 300ms debounce 서버 개수 및 하단 고정 CTA. 유효 URL 상한이 기본 슬라이더 최대를 넘으면 범위도 확대. |
| `/cafe/results?...` | 제거 가능한 영양 상한 칩, 카페/온도/정렬 popover, 중립 셀 결과 카드, 서버 페이지 이동, 로딩/오류/빈 결과 구분. |
| `/cafe/drinks/{key}` | 브랜드·원문 메뉴·컵, 전체 같은 음료명/브랜드 변형 dropdown, 큰 영양 셀 및 명시적 기준, 키보드 상세 탭, 100ml 영양정보, 실제 notes가 있을 때만 제품 설명, 공식 URL·확인일·교정 근거. 사이즈 변경 후에도 기준·목록 복귀 상태 유지. |
| 기존 주변 기능 | 현재 위치 명시적 요청, 지역 선택, 반경, 매장/지도/길찾기, 메모리 내 위치·선택 상태를 유지. 새 칼로리/사이즈 조건도 기존 nearby 요청과 필터에 전달. |

시안의 사진·공식 로고 대신 요청대로 로컬 장식 SVG 컵과 이니셜 원을 사용한다.
실제 API 값만 보여주므로 시안 예시의 브랜드 수·개수·영양 수치를 고정하지 않는다.
디카페인과 공식 0mg는 구분하며, 미공개/수치 미확정/산출 불가를 0으로 바꾸지 않는다.

## API와 계층

기존 `drinks`, `brands`, `groups`, `drink-names`, `drink-names/compare`, `capability`, `areas`,
`nearby-search`를 재사용한다. 별도 count 엔드포인트는 만들지 않는다.
검색 총계와 filter CTA 개수는 기존 `drinks`의 `totalElements`를 `size=1&page=0`으로 받는다.

기존 GET `/api/v1/ranking/cafe/drinks`에 선택적 `maxKcal`, `sizeLabel`을 추가했다.
원문 사이즈는 DB에서 정확히 일치시킨다. 응답의 `sizeLabels`는 페이지와 선택 사이즈에 제한되지 않는
다른 현재 조건의 전체 사이즈 facet이다. Query DTO 검증 → presentation → infrastructure Querydsl
기존 방향을 지키며 domain·스키마·마이그레이션은 변경하지 않는다.
동일한 선택 필드를 기존 nearby DTO 끝에 기본값과 함께 추가하고 eligibility에 적용했다.

## 디자인과 검색 노출

`CafePage.css`의 `--cafe-*`만 추가하고 `DESIGN.md`에 light/dark 값을 기록했다.
당류 분홍·카페인 녹색·칼로리 주황은 수치에 무관하게 고정한다.
18개 본문/보조본문/CTA/활성/지표/배너/배지/이니셜 대비 쌍을 두 테마에서 계산했다.
최소 light 5.31:1, dark 7.07:1로 모두 4.5:1 이상이다.
44px 타깃, popover Escape/포커스 복원, IME 완료 전 제출·자동완성 억제,
상세 탭 방향키/Home/End, reduced-motion을 구현했다.

`/cafe` canonical·sitemap 진입을 유지한다. 새 search/filter/results는 runtime noindex와
좁은 nginx location의 첫 응답 `X-Robots-Tag`를 모두 사용한다.
초기 카페 HTML의 제목·설명·배너/탐색 문구를 갱신했고 ADR-0062에 정책을 기록했다.
기존 이름 비교·변형 상세의 색인 정책은 유지한다.

## 검증

| 명령 | 결과 | 로그 |
|---|---|---|
| `cd portal-fe && npx vitest run src/pages/rank src/seo` | `Test Files 36 passed (36)` / `Tests 365 passed (365)` | `/tmp/cafe-vitest-final.log` |
| `cd portal-fe && npx tsc -b` | exit 0, 진단 없음 | `/tmp/cafe-tsc-final.log` |
| `cd portal-fe && npm_config_cache=/tmp/cafe-npm npx -y node@24 node_modules/vitest/vitest.mjs run src/pages/rank` | `Test Files 8 passed (8)` / `Tests 62 passed (62)` | `/tmp/cafe-node24-final.log` |
| `./gradlew :ranking:feature:test --no-daemon` | `BUILD SUCCESSFUL in 38s` / XML 90 tests, 0 failures/errors | `/tmp/cafe-backend-final.log` |
| `DRILL_EXPORT=write ./gradlew :code-dictionary:feature:test --tests '*DrillExportSpec' --rerun` | `BUILD SUCCESSFUL in 1m 7s` / 2 tests, 0 failures/errors | `/tmp/cafe-drill.log` |
| `./gradlew verifyArchitecture --no-daemon` | `BUILD SUCCESSFUL in 15s` | `/tmp/cafe-architecture.log` |
| `git diff --check` | exit 0 | stdout 없음 |
| `cd portal-fe && npm run build` | exit 0 · `✓ built in 4.79s` · `[seo] 프리렌더 190개 페이지 · 게임 83종` · `[html] 주석 제거 903개 파일` | `/tmp/cafe-build.log` |

Fresh context clean-architecture-validator 리뷰는 상세 사이즈 목록 링크가 basis를 누락하고
history를 중첩하는 결함 1건을 찾았다. dropdown과 같은 replace·basis·state 유지로 수정하고
목록→상세→사이즈 목록→dropdown→한 번 뒤로 복귀를 회귀 테스트로 검증했다.
후속 nearby 선택 필드 전달/검증/필터도 재검토했고 최종 판정은 **SHIP**이다.
리뷰어는 파일을 수정하거나 중복 테스트를 실행하지 않았다.

기존 build가 render-content를 실행하므로 생성 tech JSON도 빌드에서 갱신했다.
별도 문서 스캔 도구 `ai/plugins/hns/scripts/doc_scan.py`는 이 checkout에 없어 실행하지 못했다.
관련 없는 pinball/render 검증 스냅샷, lockfile, submodule 포인터는 변경하지 않았다.


## 변경 파일 (총 30개)

기존 파일 24개 수정, 신규 파일 6개다.

- `DESIGN.md`
- `docs/adr/ADR-0062-seo-and-organic-discovery.md`
- `portal-fe/nginx.conf`
- `portal-fe/scripts/prerender-seo.mjs`
- `portal-fe/src/App.tsx`
- `portal-fe/src/api/rankingApi.ts`
- `portal-fe/src/pages/rank/CafeNearby.tsx`
- `portal-fe/src/pages/rank/CafePage.css`
- `portal-fe/src/pages/rank/CafePage.tsx`
- `portal-fe/src/pages/rank/__tests__/CafeNearby.test.tsx`
- `portal-fe/src/pages/rank/__tests__/CafePage.test.tsx`
- `portal-fe/src/pages/rank/__tests__/cafeUrl.test.ts`
- `portal-fe/src/pages/rank/__tests__/cafeView.test.ts`
- `portal-fe/src/pages/rank/cafeUrl.ts`
- `portal-fe/src/pages/rank/cafeView.ts`
- `portal-fe/src/seo/__tests__/cafeSeo.test.ts`
- `portal-fe/src/seo/copy.mjs`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/application/cafe/dto/CafeDrinkDtos.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/application/cafe/dto/CafeNearbyDtos.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/application/cafe/service/CafeNearbyService.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/infrastructure/persistence/repository/CafeDrinkQueryRepository.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/presentation/controller/CafeDrinkController.kt`
- `ranking/feature/src/test/kotlin/com/kgd/ranking/CafeDrinkQueryRepositoryTest.kt`
- `ranking/feature/src/test/kotlin/com/kgd/ranking/CafeNearbyServiceTest.kt`
- `docs/specs/2026-10-21-cafe-compare-redesign/v3-implementation-report.md`
- `portal-fe/src/pages/rank/CafeArt.tsx`
- `portal-fe/src/pages/rank/CafeFilter.tsx`
- `portal-fe/src/pages/rank/CafePopover.tsx`
- `portal-fe/src/pages/rank/__tests__/CafeArt.test.tsx`
- `portal-fe/src/pages/rank/__tests__/CafeDesign.test.ts`
