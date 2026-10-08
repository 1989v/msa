# Engineer Review — test-strategy

- 대상: `docs/specs/2026-10-08-share-short-links/spec.md` (+ `planning/test-quality.md`, `planning/requirements.md`, `context/open-questions.yml`, `docs/adr/ADR-0103-share-short-links.md`)
- 체크리스트: hns `spec-review/reviewers/test-strategy/checklist.md` (skillsets: ac-to-test-case-derivation · test-layer-assignment · mock-boundary-decision)
- 기준 문서: `docs/standards/test-rules.md`, 볼트 [[gate-failure-modes]] · [[build-time-rule-enforcement]] (2026-09-29 갱신)
- 일자: 2026-10-08

## Seed Discovery

1. 스펙 SR-1~SR-7, 테스트 표 `planning/test-quality.md:5-21`, ADR-0103 §검증(`ADR-0103:53-56`).
2. 같은 폴더에 `tasks*`·`status*` 는 아직 없다 — AC→테스트 대조는 `test-quality.md` 를 테스트 계획으로 본다.
3. 표준: `docs/standards/test-rules.md:6-17` (Kotest BehaviorSpec · MockK · Domain mock 금지 · `Test` 접미사).
4. 코드 근거: 선례 `deal/feature/src/test/kotlin/com/kgd/deal/DealRedirectControllerTest.kt`, 게이트웨이 `gateway/src/test/kotlin/com/kgd/gateway/config/GatewayRoutingSpec.kt`, CI 테스트 게이트 `.github/workflows/images.yml:263-282` + `scripts/ci/topology.sh:22-34`, 방침-상수 대조 `portal-fe/src/pages/__tests__/privacyRetention.test.ts`, 폴드 스캔 검사 `content/app/src/test/kotlin/com/kgd/content/ContentContextLoadSpec.kt:89-99`, `atlas/app/src/test/kotlin/com/kgd/atlas/AtlasContextLoadSpec.kt:86-92`.

## 체크 항목 판정

| # | 항목 | 판정 |
|---|---|---|
| 1 | AC 마다 테스트가 있는가 | **부분** — SR-2 순열 고정, SR-3 백필, SR-5 FE, SR-6 보존·누적, 실패 경로 4도메인에 빈 행 (F1·F3·F5·F6·F7) |
| 2 | 계층 배정 | **부분** — `common` 코덱 테스트가 배포 게이트에서 안 돈다(F2), WebFlux 슬라이스 표기 오류·atlas 통합 하네스 부재(F4) |
| 3 | 목 경계 | **부분** — 공개 판정 테스트가 상세 API 와 다른 술어를 써도 초록(F6), 그 외 경계는 표준과 맞음 |
| 4 | 테스트 데이터 전략 | **미기재** — 상태 enum 전수·실제 미리보기 UA 표가 필요(F6·F8) |
| 5 | 음성·경계 사례 | **부분** — 범위 경계가 스펙과 어긋남, 비정규 코드·접두사 혼동 누락(F1·F9) |
| 6 | 명명 규칙 | **미기재** — 경미(F10) |

## Findings

### F1. [체크 1·5] 코덱 경계값이 스펙과 어긋나고, 순열을 고정하는 테스트가 없다 — REVISE

- `test-quality.md:7` 은 「Long 상한 근처」 왕복을 요구한다. 스펙은 지원 범위를 `0 ~ 2^40−1` 로 두고 넘으면 인코딩을 거부한다(`spec.md:34`, SR-2). 이 행대로 짜면 테스트가 실패하거나, 통과시키려고 범위 검사를 빼게 된다.
- ADR 은 「순열 상수는 바꾸지 않는다」를 결과로 적는다(`ADR-0103:50`). 하지만 테스트 표의 코덱 검사는 왕복(`test-quality.md:7`)과 충돌 없음(`:8`)뿐이다. 순열을 바꿔도 왕복·충돌 검사는 둘 다 초록이다. 그 경우 이미 퍼진 단축 주소가 전부 깨지는데, 이를 잡는 검사가 없다([[gate-failure-modes]] ③: 바꾼 것에 반응하지 않는 지표).
- 「연속 id 가 연속 코드로 보이지 않는다」(`spec.md:30`)에 대응하는 테스트가 없다.
- **수정안** — `test-quality.md` 코덱 행을 아래처럼 바꾼다.
  - 왕복: `0`, `1`, `2^40−1`. 거부: `-1`, `2^40` (인코딩 거부).
  - **고정 벡터(골든) 테스트**: id 5~10개와 기대 코드를 리터럴로 적는다. 첫 구현에서 한 번 뽑아 고정하고, 주석에 「이 값을 바꾸면 이미 공유된 주소가 깨진다」를 적는다. `test-quality.md:20-21` 의 「테스트 안에서 기대 코드를 계산하지 않는다」와 충돌하지 않는다. 리터럴은 계산이 아니라 이미 발행된 주소이기 때문이다([[gate-failure-modes]] 「판정 로직은 공유하고, 합격선은 따로 든다」).
  - 인접성: `encode(n)` 과 `encode(n+1)` 의 공통 접두 길이가 대부분 6 미만인지 표본으로 본다.
  - 회귀 주입: 순열 상수 한 자리를 바꿔 골든 테스트가 빨간불이 되는지 확인하고 나서 켰다고 기록한다.

### F2. [체크 2] `common` 의 ★ 코덱 테스트는 배포 게이트에서 한 번도 돌지 않는다 — REVISE

- 스펙은 인코더·디코더를 `common` 에 둔다(`spec.md:32`). 테스트 표는 ★ 코덱 테스트를 `unit (common)` 으로 배정한다(`test-quality.md:7-9`).
- 배포 게이트 `images.yml:263-282` 는 파드별 태스크(`scripts/ci/topology.sh:22-34`)만 부른다. 여기에 `:common:test` 는 없다. PR 게이트 `ci.yml:152-154` 도 `common/` 변경 시 「전체 JVM」으로 넘어가지만, 실제 태스크는 `:svc:app:test`/`:svc:domain:test` 로만 펼쳐진다(`ci.yml:189-200`). 결과적으로 `common/src/test/**` 는 어느 워크플로에서도 실행되지 않는다.
- 이는 [[gate-failure-modes]] ⑨ 의 「태스크 목록이 대상을 안 담는다」와 같은 모양이다. 코덱이 깨진 채 초록불이 나고 이미지가 나간다.
- **수정안**:
  - (a) 테스트 표에 「`:common:test` 가 게이트에 포함됐는지」를 검증 항목으로 넣는다. 게이트 배선(`images.yml` 의 `common/` 분기에 `:common:test` 추가)을 태스크로 만든다.
  - (b) 또는 코덱 테스트를 소비 도메인 중 하나의 feature 테스트로도 돌린다. (a) 를 권한다.
  - 어느 쪽이든 CI 로그의 `── Gradle test tasks:` 줄에 `:common:test` 가 찍히는 것으로 확인한다. 게이트가 돌았는지는 게이트가 아니라 산출물로 확인하는 규칙이다(같은 문서 「그래서 무엇을 하나」 7).

### F3. [체크 1] 이력서 코드 백필에 테스트 하네스가 없다 — REVISE

- SR-3 은 「기존 행은 마이그레이션이 채운다. 이 마이그레이션 뒤로 코드가 빈 행은 없다」고 정한다(`spec.md:39`). 테스트 표는 이를 `unit (domain) + integration` 으로 묶었다(`test-quality.md:10`).
- 그런데 resume 이 있는 code-dictionary/atlas 에는 실제 DB 통합 테스트가 하나도 없다. 같은 모양의 하네스는 다른 도메인에만 있다(`deal/.../DealSchemaIntegrationSpec.kt`, `blog/.../BlogSchemaIntegrationSpec.kt`, `place/.../PlaceSchemaIntegrationSpec.kt`, `game/.../GameSchemaIntegrationSpec.kt`). code-dictionary 쪽 테스트는 도메인 단위(`code-dictionary/domain/src/test/.../resume/*Test.kt`)와 MockMvc 하나뿐이다.
- **수정안**:
  - 「빈 행이 없다」는 테스트가 아니라 **스키마 제약**으로 보장하도록 계획에 적는다. 백필 뒤 같은 마이그레이션에서 `NOT NULL` + `UNIQUE` 를 건다. 그러면 백필이 빠진 마이그레이션은 적용 자체가 실패한다([[build-time-rule-enforcement]] 「데이터에서는 기본값이 아니라 제약이다」).
  - 통합 테스트는 `BlogSchemaIntegrationSpec` 을 본떠 atlas 쪽에 하나 만든다. 판정은 기존 행이 있는 상태에서 마이그레이션 후 코드 10자·base62·전부 유일인지다.
  - 생성 시 유일 제약 충돌 때 재시도하는 경로는 unit(MockK 로 첫 저장이 중복 예외)으로 둔다. 스펙에 충돌 처리가 없으므로 정책도 함께 정해야 한다.

### F4. [체크 2] 리다이렉터 테스트 계층 표기가 실제 구조와 다르다 — REVISE (경미)

- `test-quality.md:12` 는 「integration (WebMvc/WebFlux 슬라이스)」이다. 해석하는 쪽은 place·game·blog·resume 도메인이고 WebMVC 다. WebFlux 는 게이트웨이 전용이다(`gateway/CLAUDE.md` Key Rules).
- 폴드된 `:feature` 는 부팅 가능한 앱이 아니다. 선례도 슬라이스가 아니라 컨트롤러를 직접 생성하는 단위 테스트다(`DealRedirectControllerTest.kt:18-28`). 302·`Location`·`no-store`·`noindex` 헤더는 이 형태로 충분하다(`:37-50`).
- 대신 빠진 것은 **폴드 스캔**이다. 새 컨트롤러 4개가 호스트에 매핑되지 않으면 조용히 404 가 나고, 단위 테스트로는 이를 못 잡는다. `ContentContextLoadSpec.kt:89-99` 와 `AtlasContextLoadSpec.kt:86-92` 의 「컨트롤러가 전부 빈으로 등록된다」 목록에 새 리다이렉트 컨트롤러를 넣는 것을 테스트 항목으로 추가한다.
- **수정안**:
  - 행을 「unit (컨트롤러 직접 생성, DealRedirectControllerTest 형태)」로 고친다.
  - 「호스트 컨텍스트 로드 스펙에 리다이렉트 컨트롤러 등록」 행을 추가한다(content·atlas 각각).
  - ADR 의 공통 헤더 헬퍼(`ADR-0103:51`)는 `common` 에서 한 번 테스트한다(F2 의 게이트 조건 적용).

### F5. [체크 1] 실패 → 목록 302 를 도메인마다 검증하는 행이 없고, FE·보존·누적은 통째로 비어 있다 — REVISE

AC→테스트 매트릭스에서 빈 행:

| 스펙 | 요구 | 현재 테스트 | 제안 |
|---|---|---|---|
| `spec.md:52` | 해석 실패(형식·없음·비공개·철회) → 그 서비스 `list` 목적지 302 | `test-quality.md:15` 는 `list` 별칭만 | 4도메인 × 실패 사유별로 `Location == {서비스 홈}` (unit) |
| `spec.md:41` | 어드민 링크 목록 응답에 단축 주소, 복사 버튼이 단축 주소 복사 | 없음 | 응답 DTO 매핑 unit + admin FE 컴포넌트 테스트 |
| `spec.md:58-62` | `shortUrl` 사용, 공용 `SharePanel`, 없으면 현재 주소 대체, `copyGameLink` 가 `shortUrl` 사용 | `test-quality.md:18` CDP e2e 뿐 | vitest: 공용 패널이 `shortUrl` 로 복사·`navigator.share`·외부 링크를 만드는지, `shortUrl` 이 없을 때 대체되는지 (portal-fe 에 vitest 게이트가 이미 있다 — `ci.yml:207-208`) |
| `spec.md:68` | 원장 90일 삭제 뒤에도 누적 수 유지 | 없음 | 보존 러너 unit: 원장만 지우고 누적 컬럼은 건드리지 않는다 |
| `spec.md:70-71` | 네 원장 90일 정리 + `/privacy` §6 같은 숫자 | 없음 | `privacyRetention.test.ts:18-21` 의 `RETENTION_RUNNERS` 에 새 러너를 넣고 90일 항목을 대조한다. 이 검사는 두 파일에서 텍스트로 뽑은 값끼리 비교하므로 자기 근거를 만들지 않는다(`:5-11`). place 에는 보존 러너가 아직 없다 — 새로 생긴다 |

**사람 판단이 필요한 충돌 (다른 차원에 넘김)**:
- `spec.md:62` 는 `copyGameLink` 도 `shortUrl` 을 쓰게 한다.
- 그런데 현재 호출부는 인앱 브라우저 탈출용 「현재 링크 복사」다. 쿼리·해시를 포함한 `window.location.href` 를 그대로 넘긴다(`portal-fe/src/pages/games/GameBrowserHelp.tsx:7,12`).
- 기존 테스트도 `?room=A#join` 이 붙은 초대 주소를 **그대로** 복사하는 것을 고정한다(`portal-fe/src/pages/games/__tests__/browserHelp.test.ts:22`).
- 단축 주소로 바꾸면 방 코드가 빠져 온라인 대전 초대가 끊긴다. 테스트 계획에서는 이 기존 테스트를 어떻게 바꿀지(방 파라미터가 있으면 원래 주소 유지 등)를 정해야 한다.

### F6. [체크 3·4] 공개 판정 테스트가 「상세 API 와 같은 규칙」을 재지 못한다 — REVISE

- 요구사항은 게임 공개 판정에 「상세 API 의 노출 규칙과 같은 함수를 쓴다」를 건다(`requirements.md:48-49`). 스펙도 기존 규칙을 그대로 쓴다고 한다(`spec.md:49-51`). 그 규칙은 지금 어댑터 안의 `private` 상수다(`game/feature/.../GameCatalogAdapters.kt:46`).
- 테스트 표는 이를 `unit (application)` 으로 둔다(`test-quality.md:11`). 리다이렉터가 자기 사본 집합(`setOf(PUBLISHED, BETA)`)을 새로 만들어도 이 테스트는 초록이다([[gate-failure-modes]] 「검사가 사본을 갖지 않게 한다」).
- 같은 행의 대상 표기 「비공개·비공개 상태 게임」(`test-quality.md:11`)도 중복된 오기라 무엇을 넣을지 정해지지 않았다.
- **수정안 (테스트 데이터 전략 포함)**:
  - **데이터 전략**: `GameStatus.entries`·블로그 글 상태 전수를 표 기반으로 돌린다. 판정은 「리다이렉터가 연다 ⇔ 상세 API 가 200」이다. 상태 enum 이 늘면 자동으로 포함된다.
  - 구현 쪽에는 공개 판정을 리다이렉터와 상세 조회가 같이 부르는 하나의 함수(또는 포트 메서드)로 둘 것을 권한다. 그러면 테스트 없이도 갈라질 수 없다.
  - 실패 사유 테스트는 **유효한 코드**(같은 인코더로 만든 DRAFT 글의 id)를 입력으로 쓴다. 형식 오류 코드로 DRAFT 를 시험하면 디코딩에서 먼저 실패하므로, 공개 판정을 지워도 테스트가 통과한다.
  - 해석 결과를 사유가 있는 타입(deal 의 `Decision` 같은 모양 — `DealRedirectControllerTest.kt:5,34,72,86`)으로 돌려주게 해서 사유를 단언한다. 모든 실패가 같은 302 라 컨트롤러 응답만으로는 사유를 구분할 수 없다.

### F7. [체크 1] 게이트웨이 라우트 테스트가 무엇을 판정하는지 정해지지 않았다 — REVISE (경미)

- `test-quality.md:17` 은 「게이트웨이 라우트 테스트」라고만 적었다. 기존 스펙은 프록시되는 경로를 다루지 않는다고 명시한다(`GatewayRoutingSpec.kt:16-18`).
- 그래도 같은 파일이 이미 `routeLocator` 로 라우트 표 자체를 검사하는 방법을 쓰고 있다 — 순서(`:157-158`)·목적지 호스트(`:181-186`).
- **수정안**: 판정을 다음 셋으로 적는다.
  - `/r/**` 라우트의 uri 호스트가 `atlas`, `/p,/g,/b/**` 가 `content`.
  - 그 라우트들에 `StripPrefix` 가 0 이다(`spec.md:53` 「접두사를 떼지 않는다」).
  - 인증 필터가 없다.
- 배포 후 e2e(`test-quality.md:18`)에는 음성 대조로 apex `/place`·`/portfolio`·`/privacy` 가 여전히 portal-fe 를 받는지를 넣는다. 인그레스는 `Prefix` 라(`k8s/overlays/oci-arm/ingresses/commerce-platform.yaml:73-123`) 위험은 낮지만, 확인하는 비용이 거의 없다.

### F8. [체크 4·5] 크롤러 판정의 테스트 데이터가 없고, 선례 분류기는 주요 미리보기 봇을 놓친다 — REVISE

- 스펙은 「크롤러 UA 는 기록하지 않는다」(`spec.md:69`)고 정하고 `deal_offer_click` 을 선례로 든다(`spec.md:67`). 그런데 deal 은 봇도 **기록**하고(`DealRedirectService.kt:96-99`), 패턴은 `bot|crawler|spider|slurp|preview|fetch` 뿐이다(`:85`).
  - 이 패턴은 `facebookexternalhit/1.1` 을 놓친다. 단축 주소에서 가장 흔한 요청자인 카카오톡 미리보기(`kakaotalk-scrap`)도 걸리지 않는다. 미리보기 크롤러가 302 를 따라간다는 전제(`spec.md:99`)가 있으니 공유 한 번마다 가짜 클릭이 쌓인다.
  - 레포에는 분류기가 이미 셋이고(`DealRedirectService.kt:85`, `BlogViewService.kt:68-71`, `analytics/.../CrawlerUserAgents.kt:19-25`) 목록이 서로 다르다.
- **수정안**:
  - 네 도메인이 쓸 분류기를 하나로 정한다(`common` 권장, F2 의 게이트 조건 적용).
  - 테스트 표 `test-quality.md:14` 에 **실제 UA 문자열 표**를 데이터로 둔다. 기록 안 함 쪽은 KakaoTalk 스크랩·facebookexternalhit·Slackbot-LinkExpanding·Twitterbot·Discordbot·HeadlessChrome·curl, 기록 쪽은 모바일 Safari·데스크톱 Chrome 이다.
  - 배포 후 curl 실측(`spec.md:77`)이 원장을 오염시키는지도 이 표로 정해진다.

### F9. [체크 5] 디코더 음성 사례가 빠졌다 — REVISE

- 형식 거절(`test-quality.md:9`)에 다음이 없다.
  - **형식은 맞지만 범위 밖**: 7자 base62 는 2^40 을 넘는 값을 표현할 수 있다. 그런 코드는 오버플로 없이 실패해야 한다(`spec.md:33-34`).
  - **비정규 별칭**: 같은 id 를 가리키는 두 번째 코드(앞자리 패딩이 다른 7자 등)는 거절해야 한다. 판정은 `decode(c)` 성공 ⇒ `encode(decode(c)) == c` 이다. 이게 없으면 한 대상에 주소가 여럿 생기고 클릭 집계도 갈린다.
  - **접두사 혼동**: 상세 응답 `shortUrl` 이 맞는 대상 id 를 담는지(`test-quality.md:16`)만 보면, 게임 응답이 `/p/` 접두사를 달아도 디코딩은 성공한다. 판정을 「`shortUrl` 의 호스트가 `1989v.com`, 접두사가 그 도메인 것, 그 경로를 **같은 도메인의 리다이렉터**에 넣으면 `Location` 이 그 상세 주소」로 닫는다. 그러면 `test-quality.md:20-21` 의 「같은 디코더를 거친다」가 실제 경로 전체를 덮는다.
  - 빈 문자열·공백·대소문자만 다른 코드(base62 는 대소문자를 구분한다)·`LIST`.

### F10. [체크 6] 테스트 명명·위치가 정해지지 않았다 — 경미

- 표준은 `구현체 이름 + Test` 다(`test-rules.md:17`). 레포의 통합·스펙 계열은 `*Spec` 을 쓴다(`GatewayRoutingSpec.kt:31`, `GameSchemaIntegrationSpec`, `ContentContextLoadSpec`).
- `test-quality.md` 에 행마다 대상 클래스와 파일 이름을 적어 두면 tasks 단계에서 갈리지 않는다. 예: `ShortCodeCodecTest`, `*ShortLinkRedirectControllerTest`, `AtlasSchemaIntegrationSpec`.

## 요약

차단할 결함은 없다. 다만 ★ 로 표시한 두 축이 지금 계획대로면 **초록인 채로 깨질 수 있다**:

- 코덱 — 순열이 바뀌어도 통과하고(F1), 애초에 배포 게이트에서 돌지 않는다(F2).
- 공개 판정 — 사본 술어로 통과한다(F6).

여기에 FE·보존·백필 쪽 빈 행(F3·F5)과 크롤러 데이터(F8)를 `test-quality.md` 에 채우면 SHIP 수준이다.

F5 의 `copyGameLink` 충돌은 사람 판단이 필요하다. 스펙(`spec.md:62`)과 기존 테스트(`browserHelp.test.ts:22`)가 반대 동작을 고정하고 있다. 이 차원에서는 테스트 계획의 공백으로만 기록하고, usecase 차원 판단으로 넘긴다.

VERDICT: REVISE

## Round 2

- 일자: 2026-10-08
- 대상: 개정된 `spec.md`, 재작성된 `planning/test-quality.md`, `context/review-verdict.md`(C1–C26), `ADR-0103`
- 아래 줄 번호는 개정본 기준이다. Round 1 의 줄 번호는 옛 판을 가리킨다.

### 1차 지적 해소 여부

| 1차 | 해소 | 근거 |
|---|---|---|
| F1 범위·골든 벡터 | **해소** | 골든 벡터 + 회귀 주입(`test-quality.md:7`), 범위 `0 ~ 2^40−1`(`:8`), `2^40` 거절(`:10`), 스펙 고정(`spec.md:30,33`). 인접성 표본(`spec.md:32`)은 테스트 행이 없지만 비밀값이 아니라고 스펙이 밝혀 차단 사유는 아니다 |
| F2 `:common:test` 게이트 | **부분** — 아래 N1 | 검증 행 `test-quality.md:32` 와 CI 로그 확인(`spec.md:102`)은 들어왔다. 고칠 위치 지정이 틀렸다 |
| F3 백필 | **부분** — 아래 N3 | `NOT NULL`·`UNIQUE` 제약(`spec.md:44`, `test-quality.md:12`), 충돌 재생성(`test-quality.md:11`, `spec.md:41`)은 해소. 형식(10자 base62)을 지키는 장치가 없다 |
| F4 계층·폴드 스캔 | **해소** | 컨트롤러 직접 생성 unit(`test-quality.md:15`), 컨텍스트 로드 등록(`:30`, `spec.md:100`) |
| F5 빈 행 | **해소** | 도메인 넷 실패→list(`test-quality.md:16`), 어드민 `shortUrl`(`:13`), 공유 패널 vitest(`:22`), `copyGameLink` 유지(`:23`, `spec.md:74`), 보존 후 누적 유지(`:28`), `RETENTION_RUNNERS`(`:31`, `spec.md:101`) |
| F6 공개 판정 사본 | **해소** | 스펙이 도메인 함수 호출을 고정했다(`spec.md:54-56`). 게임 상세도 같은 함수를 쓴다 — `GameQueryService.kt:170` `if (!game.isPlayable())`. 전수 × 유효 코드 대조(`test-quality.md:14`) |
| F7 게이트웨이 판정 | **해소** | `routeLocator` 로 목적지·접두사 유지·인증 없음·리미터(`test-quality.md:20`) |
| F8 크롤러 UA 표 | **해소** | `common` 분류기 하나 + 실제 UA 표(`spec.md:80`, `test-quality.md:26`) |
| F9 디코더 음성 | **부분** — 아래 N4 | 범위 밖 7자·비정규 표기·길이·글자 거절(`test-quality.md:10`, `spec.md:35-36`), 경로 엣지(`test-quality.md:17`)는 해소. 접두사 혼동은 남았다 |
| F10 명명 | 기각(C25) — 다시 올리지 않는다 | `review-verdict.md:32` |

### 새로 생긴 이슈

#### N1. [체크 2] `:common:test` 를 생성물 파일에 손으로 넣으라고 적었다 — REVISE

- `spec.md:102` 는 `:common:test` 를 「`scripts/ci/topology.sh` 의 atlas·content·search 테스트 목록」에 넣으라고 한다.
- 그 파일은 생성물이다 — `scripts/ci/topology.sh:1` 「손으로 고치지 않는다. ./gradlew generateTopology 가 만든다」. 목록은 `build.gradle.kts:927-932` 가 `:{pod}:app:test` + 폴드 도메인 태스크로만 조립한다. 손으로 고치면 `verifyTopologyGenerated` 가 막거나 다음 생성 때 지워진다.
- **수정안**: 고칠 곳을 둘 중 하나로 바꾼다. (a) `images.yml:136-138` 의 `common/` 변경 분기에서 테스트 태스크에 `:common:test` 를 더한다. (b) 생성기 `build.gradle.kts:929` 에서 더한다. 공유 의존성 변경은 이미 전 JVM 재빌드로 넘어가므로(`images.yml:133-138`) (a) 가 범위가 좁다. 확인 방법(`test-quality.md:32` CI 로그)은 그대로 둔다.

#### N2. [체크 2] ★ 「도메인 TM 으로 실제 저장」을 도메인 단독 통합 테스트에 배정해 막으려는 실패를 재지 못한다 — REVISE

- 스펙이 막으려는 실패는 호스트 조립에서만 생긴다. content 의 기본 datasource 가 place 라서 한정자가 빠지면 game·blog 쓰기가 사라진다(`spec.md:86`).
- 테스트 표는 이를 `integration (도메인 저장소)` 에 둔다(`test-quality.md:24`). 기존 도메인 하네스는 그 도메인 TM 하나만 띄운다 — `GameSchemaIntegrationSpec.kt:148` `@Qualifier("gameTransactionManager")`. 이 구성에서는 한정자를 지워도 다른 후보가 없어 초록이다([[gate-failure-modes]] ③ 바꾼 것에 반응하지 않는 지표).
- 네 datasource 를 실제 MySQL 로 함께 띄우는 하네스는 이미 있다 — `ContentContextLoadSpec.kt:21-26,81,163-206`. atlas 도 `AtlasContextLoadSpec.kt:103-104` 에 MySQL 컨테이너가 있다. resume 쪽 통합 하네스는 따로 없다(Glob 결과 game·blog·place 만).
- **수정안**: `test-quality.md:24` 의 계층을 「context load (호스트, 실제 MySQL)」로 바꾼다. 판정은 게임·글 클릭 한 번 뒤 **game·blog 스키마**의 집계 행이 `was + 1` 이고 place 스키마에는 그 테이블 행이 생기지 않는 것이다. resume 은 `AtlasContextLoadSpec` 에서 같은 판정을 한다. 회귀 주입은 기록 메서드의 TM 한정자를 지우고 빨간불을 보는 것으로 한다.

#### N3. [체크 5] 백필이 만든 코드의 형식을 지키는 장치가 없다 — REVISE

- 백필은 SQL `RANDOM_BYTES()` 로 10자 base62 를 만든다(`spec.md:43`). 바이트를 base62 글자로 바꾸는 SQL 은 짧지 않아 길이·글자 집합을 틀리기 쉽다.
- 걸리는 제약은 `NOT NULL`·`UNIQUE` 뿐이다(`spec.md:44`, `test-quality.md:12`). 형식이 틀린 값도 둘 다 통과한다.
- 형식 검사는 `ResumeShareLink` **복원 시점**에 있다(`spec.md:42`). 그래서 백필이 틀리면 마이그레이션은 성공하고, 배포 뒤 기존 링크를 읽는 어드민 목록과 `/r` 해석이 복원 예외로 실패한다. 커밋된 마이그레이션은 고칠 수 없으니(`spec.md:90`) 복구도 새 버전이 필요하다.
- **수정안**: 같은 마이그레이션에서 `CHECK (REGEXP_LIKE(code, '^[0-9A-Za-z]{10}$', 'c'))` 를 건다. 그러면 틀린 백필은 적용 단계에서 실패한다. MySQL 8.0.16+ 는 CHECK 를 강제하고, 하네스 이미지는 8.0.33 이다(`AtlasContextLoadSpec.kt:104`). 이 제약을 쓰지 않는다면 N2 의 atlas 하네스에 「기존 행을 넣고 마이그레이션 → 전 행이 10자 base62」 판정을 한 줄 더한다.

#### N4. [체크 5] 접두사 혼동이 여전히 열려 있다 — REVISE (경미, F9 잔여)

- `test-quality.md:21` 은 「상세 응답의 `shortUrl` 을 디코딩하면 그 대상 id」다. 게임 응답이 `/p/{code}` 를 달아도 디코딩은 같은 id 로 성공해 초록이다.
- **수정안**: 판정을 「`shortUrl` 이 `{설정 origin}/{그 도메인 접두사}/{code}` 이고 code 디코딩 값이 그 대상 id」로 바꾼다. 접두사 문자열은 기대값에 리터럴로 적는다.

#### N5. [체크 2] ADR 검증 절이 개정된 계층과 어긋난다 — 경미

- `ADR-0103:58` 은 아직 「리다이렉터 … 슬라이스 테스트」, 코덱은 「왕복·충돌 없음」뿐이다. 개정된 계획은 컨트롤러 직접 생성 unit(`test-quality.md:15`)과 골든 벡터(`:7`)다.
- **수정안**: ADR 검증 절을 「코덱 골든 벡터·왕복·거절 unit, 리다이렉터 302·헤더 unit, 호스트 컨텍스트 로드」로 맞춘다. 한 줄 고침이다.

### Round 2 판정

1차의 ★ 세 축 중 둘은 닫혔다. 순열 고정(F1)과 공개 판정 사본(F6)이다. 남은 하나와 새 ★ 하나는 문구만 고치면 된다.

- 코덱 테스트 게이트(N1): 방향은 맞고 고칠 파일만 틀렸다.
- 클릭 저장 TM(N2): 계층을 호스트 컨텍스트 로드로 옮기면 기존 하네스로 된다.

N3 은 CHECK 제약 한 줄로 닫힌다. 사람 판단이 필요한 항목은 없다. N1·N2·N3 을 고치면 SHIP 이다.

VERDICT: REVISE

## Round 3

- 일자: 2026-10-08
- 대상: 최신 `spec.md`, `planning/test-quality.md`, `ADR-0103`. 줄 번호는 최신판 기준이다.

### 2차 지적 해소 여부

| 2차 | 해소 | 근거 |
|---|---|---|
| N1 `:common:test` 배선 위치 | **해소** | `spec.md:105` — 생성물 `topology.sh` 는 손대지 않고 `images.yml` 테스트 단계에 더한다고 명시했다. `verifyTopologyGenerated` 근거도 적혔다. 확인은 CI 로그(`test-quality.md:32`, 로그 줄 `images.yml:281`) |
| N2 클릭 저장 TM 계층 | **해소** | `test-quality.md:24` — `ContentContextLoadSpec`·`AtlasContextLoadSpec` 의 실제 MySQL 호스트 하네스로 옮겼다. 한정자를 지우는 회귀 주입도 들어갔다 |
| N3 백필 형식 | **해소** | `spec.md:46` 형식 `CHECK`(10자 base62, 대소문자 구분) + 위반 시 마이그레이션 실패. `test-quality.md:12` 가 같은 제약을 근거로 든다 |
| N4 접두사 혼동 | **해소** | `test-quality.md:21` — 리터럴 `https://1989v.com/{g|b|p}/` 시작 + 디코딩 값이 대상 id |
| N5 ADR 검증 절 | **부분 (경미, 비차단)** | `ADR-0103:58` 에서 「슬라이스」는 「컨트롤러 unit 테스트」로 바뀌었다. 코덱은 아직 「왕복·충돌 없음」뿐이고 골든 벡터(`test-quality.md:7`)가 빠져 있다. 실행 계획의 원본은 `test-quality.md` 라 구현에는 영향이 없다. 수정안: `ADR-0103:58` 첫 문장을 「코덱 골든 벡터·왕복·거절 단위 테스트.」로 바꾼다 |

### 이번 개정으로 생긴 이슈

없다. 새 문구(`spec.md:46,105`, `test-quality.md:12,21,24`)는 서로 맞고 기존 행과도 충돌하지 않는다.

### Round 3 판정

★ 축 넷(코덱 고정·코덱 게이트·공개 판정·클릭 저장 TM)이 모두 닫혔다. 남은 것은 ADR 검증 절 한 단어(N5 잔여)뿐이고 계획 문서와 구현에는 영향이 없다. 사람 판단이 필요한 항목은 없다.

VERDICT: SHIP
