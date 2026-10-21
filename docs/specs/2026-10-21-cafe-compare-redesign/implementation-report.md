# 카페 2단계 구현 보고서

작성: 2026-10-21. 현재 worktree에서 구현·범위 검증. 커밋·푸시·배포·운영 DB migration·재적재·컴퓨터 사용은 수행하지 않았다.

## 요구사항 1–6

1. **음료명 중심 비교:** 원천 menuName은 그대로 유지하고 DrinkNames 한 곳에서 경계 온도/사이즈(EX 포함) 제거 후 공백을 제거한 drinkName을 파생한다. `I-바닐라라떼`, `아이스 바닐라 라떼`, `(L) ICED 바닐라 라떼` → `바닐라라떼`. 디카페인·빅·빽사이즈·아이스크림 등 내부 상품 의미는 보존한다. V4는 Kotlin Java migration으로 도메인 규칙을 직접 호출해 기존 행을 backfill한다. bulk도 동일 규칙으로 저장한다. 인덱스는 drink_name 단일 인덱스이며 원천/자연키는 변경하지 않는다.
2. **브랜드 대표와 정렬:** 같은 정규화 이름의 모든 원천 판을 페이지 제한 없이 조회해 브랜드별로 묶는다. 대표는 R/Regular/Tall 또는 사이즈 미표시 우선의 결정적 공개 판이며 수치 최솟값을 고르지 않는다. 온도·사이즈·카페인 상태와 원천명이 화면에 표시된다. 전체 판은 상세 링크로 열린다. 100ml 정렬은 반올림된 전송 값 대신 원천 성분량/양수 컵 용량의 BigDecimal 교차곱으로 정확히 비교한다. 당류/카페인/열량 직접 버튼은 선택 지표와 오름/내림을 표시하며 서버가 표시 대표 수치로 정렬하고 null은 양방향 마지막이다. 기존 목록·상세 API도 유지한다.
3. **주변 진입:** nearbyEnabled 기본 false로 안내·버튼 전체가 숨겨진다. true이면 랜딩과 음료명 페이지의 첫 섹션에 진입 버튼을 둔다. 클릭하면 준비 상태·매장 판매 미확인 안내를 열고 제공된 onNearbyOpen 통합 콜백을 호출한다. 실제 매장/위치조회 구현이나 가짜 데이터는 없다. 활성화 자체는 향후 통합 호출부의 결정이다.
4. **검색·복원:** 로컬 입력 상태와 250ms debounce를 사용한다. IME 조합 중 자동완성 요청을 멈추고 완성 후 조회한다. 자동완성은 이름별 브랜드 수·행 수와 이름 경로 링크를 제공한다. 기존 URL 필터, 페이지, 상세 왕복 위치·키보드 포커스를 유지한다. 이름 경로에서 일반 검색 제출은 목록 검색으로 이동한다.
5. **반응형 카드·정확한 정보:** table을 제거하고 최소폭 없는 3지표 카드/목록으로 바꿨다. 지표별 공통 최댓값 척도의 중립색 막대, 선택 지표 강조, tabular 숫자, 제공량/100ml 의미를 표시한다. null/undefined/NaN은 상태 문구로 처리하며 상세 추가 성분·가격도 방어한다. 전체 nullable 응답 형태 fixture를 렌더 검증했다. 토큰만 사용하며 hex/그라디언트/그림자/이모지를 추가하지 않았다. 브라우저·360px 실제 시각 검수는 컴퓨터 사용 승인이 없어 수행하지 않았으며 CSS 구조 검증과 렌더 테스트 범위다.
6. **랭킹 푸터 재개:** Footer에는 정적 랭킹 진입이 없고 서비스 탐색에 의존했다. 서비스 상태 원본은 codedictionary V20이 rank를 PREOPEN으로 seed한 행이다. 초기 HTML siteFooter는 카탈로그 조회가 없으면 rank를 아예 제외했고, PREOPEN이면 준비 중 span으로 바꿨다. 새 V32는 rank PREOPEN만 OPEN으로 전환한다. Footer에 공개 랭킹 링크를 복원하고 초기 HTML은 카탈로그 부재에도 정적 링크를 유지한다. 명시적 PREOPEN은 V32 적용 전까지 초기 HTML·서비스 탐색에서 여전히 준비 중으로 표시될 수 있으므로 **배포와 V32 적용이 필요하다**. 다른 서비스 상태는 변경하지 않는다. footerLinksGolden 원래 10개가 복원되어 골든 파일은 HEAD와 동일하다.

## API 계약

- `GET /api/v1/ranking/cafe/drink-names?q=` → 최대 20개 `{drinkName, brandCount, rowCount}`; 브랜드 수 내림 → 행 수 내림 → 이름 오름. 검색어도 동일 도메인 규칙으로 정규화한다.
- `GET /api/v1/ranking/cafe/drink-names/compare?name=...&sort=sugar|caffeine|kcal&basis=serving|100ml&direction=asc|desc` → `{brandSlug, brandName, representative, variants}[]`. brand 반복·temperature·caffeineStatus 반복·caffeine·group·maxSugar·maxCaffeine 필터를 지원한다. 상한은 기존처럼 1회 제공량 기준이다.
- 기존 `/drinks`에 호환되는 선택 direction을 추가한다. 응답 drinkName은 추가 필드다. `/drinks/{drinkKey}`는 유지한다.
- FE `/cafe/drink/{encodedName}` 추가, 기존 `/cafe/drinks/{drinkKey}` 유지. 명명 결정과 대표 우선순위는 ADR-0112 참조.

## 실제 JSONL 집계

로컬 `/Users/gideok-kwon/IdeaProjects/msa/ranking/ingest/data/cafe/drinks.*.jsonl`의 비어 있지 않은 행을 읽었다. Python은 JSON에서 brand_slug/menu_name을 TSV로 옮기는 일만 하고 정규화는 하지 않았다. `/tmp/CafeCount.java`가 빌드된 실제 Kotlin `DrinkNames.INSTANCE.normalize`를 호출했다. 스크립트 `/tmp/cafe-count.py`, 입력 `/tmp/cafe-names.tsv`, 출력 `/tmp/cafe-count.log`. `python3 /tmp/cafe-count.py` exit 0. 운영 DB 전량 수치는 아니다.

**1,922행 · 원천 이름 1,489개 · 정규화 이름 931개.** 브랜드 수 내림 → 행 수 내림 → 이름 오름 top20:

| 음료명 | 브랜드 수 | 행 수 |
|---|---:|---:|
| 바닐라라떼 | 8 | 27 |
| 카페라떼 | 8 | 27 |
| 카페모카 | 8 | 27 |
| 아메리카노 | 6 | 17 |
| 카푸치노 | 6 | 17 |
| 콜드브루 | 5 | 13 |
| 콜드브루라떼 | 5 | 13 |
| 복숭아아이스티 | 5 | 7 |
| 에스프레소 | 5 | 7 |
| 자몽에이드 | 5 | 6 |
| 카라멜마끼아또 | 4 | 16 |
| 고구마라떼 | 4 | 10 |
| 얼그레이 | 4 | 10 |
| 디카페인바닐라라떼 | 4 | 8 |
| 디카페인아메리카노 | 4 | 8 |
| 디카페인카페라떼 | 4 | 8 |
| 딸기주스 | 4 | 5 |
| 헤이즐넛아메리카노 | 3 | 12 |
| 말차라떼 | 3 | 11 |
| 카라멜마키아또 | 3 | 9 |

보수적인 규칙이라 카라멜마끼아또/카라멜마키아또 등의 철자 동의어는 합치지 않는다. 이름에 디카페인 표기가 없는 이디야의 일반/디카페인 원천 판도 caffeineStatus 자연키와 화면 표기로 구분하여 보존한다.

## 검증

허용된 모듈 명령만 실행했다. backend의 Kotlin daemon sandbox 쓰기 실패는 Gradle 자체 fallback compiler로 회복되었고 설정/lockfile을 변경하지 않았다.

| 단계 | 명령 | 결과 |
|---|---|---|
| 기준 backend | `./gradlew :ranking:domain:test :ranking:feature:test --no-daemon --console=plain` | BUILD SUCCESSFUL in 12s, exit 0 |
| 기준 FE | `cd portal-fe && npx vitest run src/pages/rank src/seo src/components` | 2 files failed /45 passed; 3 tests failed /416 passed, exit 1 |
| 기준 타입 | `cd portal-fe && npx tsc -b` | 출력 없음, exit 0 |
| 최종 backend | 동일 backend 명령 | BUILD SUCCESSFUL in 39s; 21 tasks: 8 executed /13 up-to-date; domain 130 + feature 36 tests, 0 failures/errors/skipped, exit 0 |
| 최종 FE | 동일 vitest 명령 | 1 file failed /46 passed; 2 tests failed /424 passed, exit 1 |
| 최종 타입 | 동일 tsc 명령 | 출력 없음, exit 0 |

기준 실패: footerLinksGolden 링크 10개 예상/9개 실제 1건, gameCatalogGuides ko/en 기대 pick 3개/실제 6개 2건. 최종 실패는 기존 gameCatalogGuides ko/en 두 건만 남았다. 무관한 게임 테스트를 고치거나 기대값을 낮추지 않았다. 원래 footer 골든은 최종 HEAD와 동일하여 변경 파일에 포함하지 않는다.

추가 회귀: 단일 이름 규칙/의미 단어 보존, DTO·JPA 왕복, V4 compiled classpath 위치와 H2 backfill, 정규화 검색 집계, >20판 전체 보존·대표 수치 정렬·null 마지막, name route/card, nullable 응답 상세, IME debounce, nearby false/true·콜백·상단 배치, Footer 랭킹 링크.

원본 로그: `/tmp/cafe-baseline-{gradle,vitest,tsc}.log`, `/tmp/cafe-review-backend.log`, `/tmp/cafe-review-frontend.log`, `/tmp/cafe-review-typecheck.log`. MySQL 실제 migration·V32 실제 실행·시각적 테마/모바일 검수는 이번 검증에 포함하지 않는다. **최신 원천과 컵 용량 파생값을 위한 브랜드별 재적재가 필요하다.**

## 변경 파일

동시 작업자의 `docs/specs/2026-10-21-ranking-admin/plan.md` 변경은 이 작업에 속하지 않으며 보존했다.

- `portal-fe/scripts/prerender-seo.mjs`
- `portal-fe/src/App.tsx`
- `portal-fe/src/api/rankingApi.ts`
- `portal-fe/src/components/Footer.tsx`
- `portal-fe/src/components/__tests__/Footer.test.tsx`
- `portal-fe/src/pages/rank/CafePage.css`
- `portal-fe/src/pages/rank/CafePage.tsx`
- `portal-fe/src/pages/rank/__tests__/CafePage.test.tsx`
- `portal-fe/src/pages/rank/cafeUrl.ts`
- `portal-fe/src/pages/rank/cafeView.ts`
- `portal-fe/src/seo/copy.mjs`
- `ranking/domain/src/main/kotlin/com/kgd/ranking/domain/cafe/model/CafeDrink.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/application/cafe/dto/CafeDrinkDtos.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/application/cafe/port/CafeDrinkRepositoryPort.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/application/cafe/service/CafeDrinkService.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/application/cafe/usecase/CafeDrinkUseCases.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/infrastructure/persistence/adapter/CafeDrinkRepositoryAdapter.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/infrastructure/persistence/entity/CafeDrinkJpaEntity.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/infrastructure/persistence/repository/CafeDrinkQueryRepository.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/presentation/controller/CafeDrinkController.kt`
- `ranking/feature/src/test/kotlin/com/kgd/ranking/CafeDrinkDtoRoundTripTest.kt`
- `ranking/feature/src/test/kotlin/com/kgd/ranking/CafeDrinkQueryRepositoryTest.kt`
- `ranking/feature/src/test/kotlin/com/kgd/ranking/CafeDrinkServiceTest.kt`
- `code-dictionary/feature/src/main/resources/codedictionarydb/migration/V32__open_ranking_service.sql`
- `docs/adr/ADR-0112-cafe-drink-name-comparison.md`
- `ranking/domain/src/main/kotlin/com/kgd/ranking/domain/cafe/model/DrinkNames.kt`
- `ranking/domain/src/test/kotlin/com/kgd/ranking/domain/cafe/model/DrinkNamesTest.kt`
- `ranking/feature/src/main/kotlin/rankingdb/migration/V4__cafe_drink_name.kt`
- `ranking/feature/src/test/kotlin/com/kgd/ranking/CafeDrinkNameMigrationTest.kt`

## Fresh review 조치

최종 새 컨텍스트 재리뷰 판정: **SHIP**. 아래 지적의 수정과 회귀 사례를 재확인했으며 남은 차단 이슈는 없다. 실제 모바일·테마 렌더링 및 운영 MySQL/Flyway 실행은 미검증이다.

- EX 누락: 단일 경계 토큰 목록에 EX 추가. 접두/접미, `(EX) HOT 연유 카페 라떼`·`(EX) ICED 연유 카페 라떼` 통합을 도메인·V4 migration·실제 Querydsl 자동완성에서 회귀 검증한다.
- 반올림 농도 정렬: 이름 비교가 BigDecimal 원천 비율의 교차곱을 사용한다. 성분량 1 /333ml와 /333.01ml는 전송 농도가 모두 0.3003이어도 실제 비율로 정렬한다. 당류·카페인·열량 및 호환 sugarPer100ml, 양방향, 미산출 마지막을 검사한다.
- 미공개 카페인: 숫자가 있어도 status가 UNDISCLOSED이면 목록 SQL 정렬 지표를 null 처리한다. 제공량/100ml·오름/내림 모두 미공개 행 마지막을 실제 H2 Querydsl로 검사한다. 원천 수치는 보존한다.
- 작은 양수 막대: `<0.1` 표시문자열을 숫자로 재해석하지 않고 원천 숫자로 폭을 계산한다. 0.02g이 `<0.1`로 표시돼도 2% 막대가 남는 렌더 회귀를 추가했다.
- 전체 판은 카드 안의 작은 링크 행으로 유지하고 온도·사이즈·카페인 상태를 명시했다. 서로 다른 ICE/R/디카페인과 HOT/L/일반 판이 각 안정키 상세 경로로 연결되는지 검사한다.
