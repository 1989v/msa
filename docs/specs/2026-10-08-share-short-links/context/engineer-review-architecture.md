# Engineer Review — Architecture

- 대상: `docs/specs/2026-10-08-share-short-links/spec.md` (+ `planning/requirements.md`, `context/open-questions.yml`, `docs/adr/ADR-0103-share-short-links.md`)
- 차원: architecture (`hns/0.16.1/skills/spec-review/reviewers/architecture/checklist.md`)
- 일자: 2026-10-08

## Seed Discovery

1. 스펙·요구·열린 질문·ADR-0103 을 읽었다. `planning/shaping-state.yml:5` 의 토폴로지는 codec(common) · resume-resolver(atlas) · content-resolvers(place/game/blog) · gateway+ingress · fe-share · click-ledger+retention 이다.
2. 표준: `CLAUDE.md`(레이어 표준 ADR-0083, 폴드 ADR-0093), `docs/conventions/package-structure.md`, 서비스별 `CLAUDE.md`(game·blog·place·deal·common·gateway·k8s).
3. 지식베이스(`HNS_KB_PATH`, 읽기 전용): [[modular-monolith-fold]](2026-09-11 갱신) — 폴드 호스트의 TM 한정자 함정, 원장·배치를 도메인 모듈에 두는 규칙.
4. 코드 근거: 아래 각 항목에 `{file}:{line}` 로 인용했다.

## 통과한 항목

| 체크 | 판정 | 근거 |
|---|---|---|
| 의존 방향 · 순환 없음 | 통과 | 코덱은 `common`(순수 Kotlin, SR-2)이고 세 도메인이 읽기만 한다. 도메인 사이 호출이 없다(SR-4 "다른 도메인을 호출하지 않는다", ADR-0103 §4) |
| 모듈 경계 변경에 근거 | 통과 | 전용 단축 서비스를 만들지 않는 이유가 ADR-0103 §4 에 있다. 만들면 네 도메인의 공개 규칙·슬러그를 알아야 해서 cross-reference 금지(`package-structure.md:53`)에 걸린다 |
| 저장소 소유 | 통과 | 원장을 도메인 DB 마다 둔다(Q3 해결). content 호스트는 이미 place_db·game_db·blog_db 를 나눠 갖고 있다(`content/app/src/main/resources/application.yml:15-61`) |
| 패턴 일관성 | 통과 | deal `/go` 리다이렉터와 같은 모양이다(`DealRedirectController.kt:24-68`, 게이트웨이 `GatewayRouteConfig.kt:465-469`). `/p/**` 는 PathPattern 세그먼트 매칭이라 기존 `/posts/**`(`GatewayRouteConfig.kt:531-535`)와 겹치지 않는다. 운영 인그레스는 Prefix 이고 `use-regex` 가 없어서(`commerce-platform.yaml:69-86`) `/p` 가 `/portfolio`·`/privacy` 를 잡지 않는다 |
| Deletion Test — 코덱 | 통과(earning its keep) | 지우면 순열·base62·범위 검사가 세 도메인과 상세 응답 세 곳에 흩어진다. 순열 상수가 여러 벌이 되면 "순열 상수는 바꾸지 않는다"(ADR-0103 결과)를 지킬 수 없다 |
| Seam realism | 통과 | 새 인터페이스는 ADR-0083 이 강제하는 UseCase 인터페이스뿐이다. 스펙이 가상의 어댑터 seam 을 만들지 않는다 |
| 모듈 이름 | 해당 없음 | 이 스펙 폴더에 `glossary.md` 가 없다. 새 모듈 이름도 만들지 않는다 |

## 이슈 (REVISE — 비차단)

### A1. 트랜잭션 경계 — content 호스트에서 game·blog 클릭 기록의 TM 한정자가 명시돼 있지 않다 [체크: Transaction boundary ownership]

- 근거: content 호스트의 primary datasource 는 place 다(`content/app/src/main/resources/application.yml:16` "place 전용 — 이 호스트에서 primary 다"). game 은 `@Transactional(transactionManager = "gameTransactionManager")` 를 반드시 써야 한다(`game/CLAUDE.md` Architecture 절 "트랜잭션"). [[modular-monolith-fold]] §4 에 따르면 한정자 없는 `@Transactional` 은 호스트 primary TM 에 붙는다. 그러면 `@Modifying` 쓰기가 **예외 없이 사라지고**, deal 클릭 수가 며칠 동안 0 이었던 실제 사고가 이것이었다.
- SR-6 은 "기록이 실패해도 302 는 나간다"만 정하고, 쓰기가 **조용히 무효**가 되는 경우는 다루지 않는다. 그리고 이 경우는 실패가 아니라서 302 는 정상으로 나간다.
- 수정안: SR-6 에 한 줄을 더한다. "클릭 원장 INSERT 와 누적 수 UPDATE 는 도메인 TM 한정자(`gameTransactionManager`·`blogTransactionManager`)를 명시하고, deal 처럼 `REQUIRES_NEW` 로 분리한다(`DealRedirectService.kt:60`)." 검증에는 **값으로 판정하는 쓰기 테스트**(누적 수가 `was + 1` 인지)를 도메인마다 하나씩 넣는다. 조회 테스트만으로는 이 결함이 잡히지 않는다.

### A2. 누적 클릭 수를 어디에 둘지 미정 — 대상 행에 두면 game 규칙 위반, place 는 전체 동기화가 덮어쓴다 [체크: Layer responsibility / Architecture pattern consistency]

- 스펙 결정: SR-6 은 "대상별 누적 클릭 수를 원장과 별도로 유지한다"고만 쓴다. 그런데 결정 근거인 `open-questions.yml:22` 의 권고안은 **"대상 행의 누적 카운트 컬럼"** 이다. 구현자가 그 문장을 따르면 아래 둘에 걸린다.
- game: "실시간 카운터를 Game row 에 두지 않는다"(`game/CLAUDE.md:293`). `GameRepositoryAdapter.save` 는 `existing.update(game)` 으로 행 전체를 동기화한다(`GameCatalogAdapters.kt:49-59`, `GameJpaEntity.kt:138`).
- place: 관광지 upsert 는 기존 행을 읽어 `syncFrom` 으로 합친 뒤 `fromDomain(merged)` 로 **행 전체를 다시 쓴다**(`AttractionRepositoryAdapter.kt:24-44`). 보내지 않은 필드는 null 로 덮인다(`place/CLAUDE.md` "★ TourAPI" 2항). 카운터를 `attractions` 행에 두면 둘 중 하나가 난다. 도메인 모델에 없으면 수집이 돌 때마다 0/null 이 되고, 있으면 읽은 시점과 저장 시점 사이에 올라간 클릭을 잃는다(lost update). 게다가 수집은 매일 돈다.
- 수정안: SR-6 을 "누적 수는 도메인마다 별도 집계 테이블(`{domain}_short_link_stat(target_id PK, click_count)`)에 두고 원자적 `UPDATE … SET click_count = click_count + 1` 로 올린다"로 바꾼다. blog 는 `blog_post` 행 카운터 선례가 있지만(`blog/CLAUDE.md` 조회수 절, 관측값 필드는 저장 시 무시) 네 도메인을 같은 모양으로 맞추는 편이 단순하다. 둘 중 하나를 고르고 `open-questions.yml:22` 의 문구와 맞춘다.

### A3. 게임 공개 판정의 재사용 지점이 infrastructure 의 private 상수를 가리킨다 [체크: No upward dependency violations]

- 스펙 결정: Existing Code 표의 "게임 공개 상태 집합 | `GameCatalogAdapters.kt:46`"(spec.md:88).
- 위반: 그 상수는 infrastructure 어댑터의 `private val PUBLIC_STATUSES`(`GameCatalogAdapters.kt:46`)다. 해석 UseCase(application)는 그것을 import 할 수 없다. application → infrastructure import 금지이고 `verifyLayerDependencies` 가 잡는다(`package-structure.md:84-88`). 구현자가 상수를 application 에 복사하면 공개 규칙이 두 벌이 된다. 그러면 R4 의 "상세 API 의 노출 규칙과 같은 함수를 쓴다"(`requirements.md:48-49`)가 깨진다.
- 수정안: 표의 경로를 도메인 함수 `Game.isPlayable()`(`game/domain/.../Game.kt:153`)로 바꾼다. 공개 상세가 실제로 쓰는 판정이 이것이다(`GameQueryService.kt:170` `if (!game.isPlayable()) throw GameNotFoundException`). 블로그도 같은 방식으로 상세의 판정 지점(`BlogQueryService.kt:118`)을 함께 적어 두면 "기존 규칙을 그대로 쓴다"(SR-4)를 확인할 수 있다.

### A4. 원장 정리 배치의 소유자가 정해져 있지 않다 — place 에는 러너가 없다 [체크: Cross-module boundary changes with explicit rationale]

- 스펙 결정: "보존기간 CronJob(`k8s/base/retention/`)이 네 원장을 90일 기준으로 정리한다"(SR-6, spec.md:70).
- 현재 구조: 정리 코드는 CronJob 이 아니라 **원장을 아는 도메인 모듈의 러너**에 있다. `BlogRetentionRunner.kt:13-21` 의 주석은 "호스트가 아니라 도메인 모듈 안에 둔다 … 재분리할 때 러너만 뒤에 남는다"이고, `GameRetentionRunner` 와 code-dictionary `RetentionRunner` 도 같은 방식이다. [[modular-monolith-fold]] "따라오지 않는 것" 표에도 "원장·배치는 그것을 아는 도메인 모듈에 둔다"가 있다. place 에는 retention 러너가 없다(`class \w*RetentionRunner` 검색 결과는 game·blog·code-dictionary 셋뿐).
- 수정안: SR-6 에 소유를 적는다. "각 도메인이 `Purge{X}ShortLinkClicksUseCase` + `@Profile("retention")` 러너를 자기 feature 에 둔다. resume 은 code-dictionary `RetentionRunner` 에 한 항목을 더하고, place 는 러너를 새로 만든다." CronJob 매니페스트는 바꿀 것이 없다. content 이미지는 이미 kubernetes 프로파일로 place·blog DB 를 받기 때문이다(`content/app/src/main/resources/application-kubernetes.yml:6-16`, `cronjob-content.yaml:47`). 이 점도 스펙에 밝혀 두면 구현자가 매니페스트를 건드리지 않는다.

### A5. `/p` 목적지 계약에 언어가 빠져 있다 — 관광지 id 는 언어별로 다르다 [체크: Information hiding depth]

- 스펙 결정: `/p` 목적지는 `place.1989v.com/attractions/{id}` 하나다(SR-1 spec.md:22-23, `requirements.md:15`).
- 근거: 관광지는 `(contentId, lang)` 이 자연키이고 언어마다 행과 id 가 따로 있다(`AttractionRepositoryAdapter.kt:20-33`). FE 에는 `/attractions/:id` 와 `/en/attractions/:id` 가 따로 있고(`portal-fe/src/App.tsx:239-240`), "id 는 언어별로 다르므로 /en/attractions/{ko-id} 같은 어긋난 주소가 들어올 수 있다"는 보정 코드가 있다(`AttractionPage.tsx:132-134`). 영문 상세에서 받은 단축 주소는 지금 계약대로면 국문 경로로 간다.
- 수정안: SR-1/SR-4 에 이렇게 적는다. "place 해석기는 대상 행의 `lang` 으로 경로를 고른다(`en` → `/en/attractions/{id}`)." 언어 판단은 해석기 안에 숨기고 코드와 FE 는 언어를 모르게 둔다.

### A6. (경미) 절대 주소와 302 헤더를 조립하는 곳이 스펙에 없다 [체크: Interface surface minimal]

- SR-5 는 세 상세 응답에 `shortUrl`(절대 주소)을 넣으라고 하지만, `https://1989v.com` 과 접두사 글자를 어디서 받는지는 정하지 않았다. 지금 선례는 도메인마다 `@Value("\${blog.origin:…}")` 를 따로 두는 방식이다(`BlogMetaRenderer.kt:28`). 이대로 가면 apex origin 이 세 곳에 복사된다.
- ADR-0103 결과 절은 "응답 헤더 조립은 공통 헬퍼로 묶는다"고 하지만 SR 에는 이 내용이 없다.
- 수정안: SR-2 에 "코덱 모듈이 `shortUrl(prefix, id)` 도 함께 제공한다. apex origin 은 그 안의 상수 하나다"를 더한다. SR-4 에는 "302 응답(`no-store`·`noindex`) 조립은 `common` 의 헬퍼 하나를 쓴다. deal `/go` 는 이번에 바꾸지 않는다(최소 수정)"를 더한다. 헬퍼를 부르는 곳은 r·p·g·b 넷이라 Rule of Three 를 넘는다.

## 요약

방향은 맞다. 도메인이 자기 대상을 해석하고, 매핑 테이블이 없고, 코덱은 한 벌이고, 원장은 도메인 DB 에 둔다. 차단 사유는 없다. 다만 폴드 호스트(content)에서 조용히 무효가 되는 두 경로가 있다. TM 한정자(A1)와 전체 동기화 행에 둔 카운터(A2)다. 그리고 재사용 지점 하나가 레이어 경계를 넘는다(A3). 이 셋은 구현 전에 스펙에서 닫아야 한다.

VERDICT: REVISE

## Round 2

- 대상: 개정된 `spec.md`, `planning/test-quality.md`, `context/review-verdict.md`(C1–C26 매핑), `docs/adr/ADR-0103-share-short-links.md`
- 일자: 2026-10-08

### 1차 이슈 해소 확인

| 1차 | 판정표 | 해소 | 근거 |
|---|---|---|---|
| A1 TM 한정자 | C8 | 닫힘 | `spec.md:86` "도메인 트랜잭션 관리자 한정자와 `REQUIRES_NEW` … 한정자가 없으면 game·blog 쓰기가 조용히 사라진다". 값 판정 테스트는 `test-quality.md:24` "누적 수가 `was + 1` — game·blog·place·resume 각각, 도메인 TM 으로 실제 저장되는지 값으로 판정" |
| A2 누적 수 위치 | C2 | 닫힘 | `spec.md:84-85` 별도 집계 테이블 + `INSERT … ON DUPLICATE KEY UPDATE`, 대상 행 컬럼 금지. `open-questions.yml:22` 문구도 같은 결정으로 바뀌었다. ADR-0103 §5(`ADR-0103:43`)도 같다 |
| A3 게임 공개 판정 | C3 | 닫힘 | `spec.md:54-56` 이 `Game.isPlayable()`·`PostStatus.publiclyVisible`·`ResumeShareLink.isUsable()` 을 부르고, 표(`spec.md:115`)도 도메인 경로로 바뀌었다. 실재 확인: `Game.kt:153`, `BlogEnums.kt:47`. infrastructure 의 private 상수 참조는 사라졌다 |
| A4 정리 러너 소유 | C9 | 닫힘 | `spec.md:88` "각 도메인 모듈의 보존 러너 … place 는 러너를 새로 만들고 … CronJob 매니페스트는 바꾸지 않는다". 러너 등록 게이트는 `spec.md:101`. resume 이 붙을 기존 러너는 `code-dictionary/.../RetentionRunner.kt:42`(`resume_access_log`)에 있다 |
| A5 `/p` 언어 | C4 | 닫힘 | `spec.md:22` "(영문 행은 `/en/attractions/{id}`)", 테스트 `test-quality.md:18` |
| A6 origin·302 헬퍼 | C11 | 닫힘 | `spec.md:24-25` origin 은 설정값에서만, 302·주소 조립은 `common` 헬퍼 한 곳. `common` 은 이미 spring-web 을 갖고 있어(`common/build.gradle.kts:14`) 헬퍼를 둘 수 있다 |

추가 확인: SR-5 의 search 측 `shortUrl` 계산(`spec.md:69-70`)은 "search 문서 id == place 관광지 id" 를 전제한다. 이 전제는 색인 경로가 지킨다(`search/batch/.../AttractionApiReindexTasklet.kt:103` `id = attraction.id.toString()`). search:app 은 `:common` 에 이미 의존한다(`search/app/build.gradle.kts:9`). 따라서 레이어 위반이나 새 서비스 간 참조는 생기지 않는다.

### 새 이슈 (REVISE — 비차단, 경미)

#### A7. 크롤러 분류기를 `common` 에 새로 만들면 같은 규칙이 세 벌이 된다 [체크: Architecture pattern consistency / DRY(지식)]

- 스펙 결정: `spec.md:80` "크롤러 판정은 `common` 의 분류기 하나로 한다."
- 현재 코드: 같은 판정이 이미 두 곳에 있다. `analytics/app/.../presentation/event/CrawlerUserAgents.kt:41` `isCrawler`(facebookexternalhit·HeadlessChrome 포함, 테스트 `CrawlerUserAgentsTest.kt`)와 `blog/feature/.../BlogViewService.kt:56` `private fun isBot`이다. 스펙은 "하나로 한다"고 쓰지만, 기존 둘과의 관계를 정하지 않았다. 그래서 결과는 세 번째 사본이 된다. UA 목록은 업무 규칙(누가 사람인가)이라서 사본마다 따로 갱신되면 원장끼리 숫자가 어긋난다.
- 수정안: SR-6 에 한 줄을 더한다. "기준 목록은 analytics `CrawlerUserAgents` 의 것을 `common` 으로 옮겨 시작한다. 기존 analytics·blog 사본은 이번에 바꾸지 않고(최소 수정) 수렴 대상으로 별도 보고한다." 이번에 수렴까지 하려면 그 범위를 명시해야 한다.

#### A8. `common` 새 컴포넌트의 설정 키와 문서 갱신이 빠져 있다 [체크: Interface surface minimal]

- 스펙 결정: `spec.md:24` origin 을 "설정값에서만" 얻고, `spec.md:25` 헬퍼는 `common` 에 둔다.
- 근거: `common/CLAUDE.md` Key Rules 는 활성화와 설정을 `kgd.common.*` 프로퍼티로 하고 "새 컴포넌트 추가 시 `docs/service.md` Provided Components 테이블 업데이트 필수"라고 정한다. 스펙에는 설정 키 이름(apex origin, 서비스 origin 4종)도 문서 갱신도 없다. 키 이름이 정해지지 않으면 호스트(atlas·content·search) 셋이 각자 키를 지어 origin 이 다시 여러 벌이 된다. A6 이 막으려던 상황이다.
- 수정안: SR-1 에 키 하나를 정해 적는다(예: `kgd.common.short-link.origin`, 서비스 origin 은 `kgd.common.short-link.targets.{r|p|g|b}`). 같은 줄에 `common/docs/service.md` 표 갱신을 더한다.

### Round 2 요약

1차 A1–A6 은 모두 개정 스펙에서 닫혔다. 새로 생긴 레이어 위반이나 서비스 간 참조는 없다. 남은 것은 경미 2건이다. 크롤러 분류기가 기존 두 사본과 관계없이 세 번째 사본이 되는 문제(A7)와 `common` 설정 키·문서가 빠진 문제(A8)다. 둘 다 스펙 문장 한 줄로 닫힌다.

VERDICT: REVISE

## Round 3

- 대상: 최종 개정 `spec.md`, `planning/test-quality.md`, `docs/adr/ADR-0103-share-short-links.md`
- 일자: 2026-10-08
- 범위: A7·A8 해소 확인과 이번 개정에서 새로 생긴 문장만 본다.

### 2차 이슈 해소 확인

| 2차 | 해소 | 근거 |
|---|---|---|
| A7 크롤러 분류기 사본 | 닫힘 | `spec.md:82` "목록은 analytics `CrawlerUserAgents.kt` 를 출발점으로 하고 … 더한다"로 기준 목록의 출처를 정했다. `spec.md:83` "기존 두 판정(analytics `CrawlerUserAgents`, blog `BlogViewService`)은 이번에 바꾸지 않고, 통합 후보로 별도 보고한다"로 기존 사본과의 관계와 범위(최소 수정)를 밝혔다. 테스트는 `test-quality.md:26`(실제 UA 문자열 표, unit (common))이다 |
| A8 `common` 설정 키·문서 | 닫힘 | `spec.md:26` "설정 키는 `kgd.common.short-link.*` 하나의 묶음이다 … atlas·content·search 가 같은 키를 읽는다". 이 이름은 `common/CLAUDE.md:35` 의 `kgd.common.*` 규칙과 맞는다. `spec.md:27` 은 `common/docs/service.md` Provided Components 표 갱신을 적는다. 파일이 실재하고(`common/docs/service.md`) 규칙의 출처는 `common/CLAUDE.md:36` 이다 |

### 새 문장 점검

- `spec.md:26-27`: 설정 묶음이 하나라서 A6 이 막으려던 origin 여러 벌이 다시 생기지 않는다. 읽는 쪽 셋(atlas·content·search)은 모두 `:common` 에 이미 의존한다(Round 2 확인: `search/app/build.gradle.kts:9`). 새 모듈 의존은 생기지 않는다.
- `spec.md:82-83`: 분류기는 `common` 의 순수 판정이고, 도메인은 읽기만 한다. 의존 방향과 레이어 경계는 그대로다. 기존 두 사본이 남아 일시적으로 세 벌이 되지만, 스펙이 그 사실과 후속 처리(별도 보고)를 밝혔으므로 숨은 중복이 아니다.
- `test-quality.md:21`: `shortUrl` 이 리터럴 `https://1989v.com/` 로 시작하는지를 대상의 출력으로 판정한다. 설정값 주입 구조(`spec.md:24`)와 충돌하지 않는다.

새 아키텍처 이슈는 없다.

### Round 3 요약

A7·A8 은 스펙 문장으로 닫혔다(`spec.md:26-27`, `spec.md:82-83`). 이번 개정이 새 레이어 위반, 서비스 간 참조, 모듈 의존을 만들지 않았다. 1차 A1–A6 의 해소 상태도 유지된다.

VERDICT: SHIP
