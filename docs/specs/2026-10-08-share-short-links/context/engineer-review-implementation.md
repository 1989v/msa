# Engineer Review — implementation

- 대상: `docs/specs/2026-10-08-share-short-links/spec.md` (+ `planning/requirements.md`, `planning/test-quality.md`, `context/open-questions.yml`, `docs/adr/ADR-0103-share-short-links.md`)
- 차원: implementation (구현 가능성 · 기존 코드 충돌 · 복잡도 · NFR · 마이그레이션/롤백 · 동시성)
- 날짜: 2026-10-08
- KB 조회(`HNS_KB_PATH` 볼트 `wiki/`): 단축 링크·base62·리다이렉터 관련 개념 페이지는 없다. 원칙 페이지 [[yagni]] · [[kiss]] · [[premature-optimization]] 를 판정 기준으로 썼다.

## 요약

뼈대는 구현할 수 있다. 게이트웨이 비 `/api` 경로 선례(`GatewayRouteConfig.kt:465-469` `deal-redirect`, `:531-535` `blog-page`)가 있다.
apex 인그레스에는 `/r` `/p` `/g` `/b` 와 겹치는 규칙이 없다(`commerce-platform.yaml:69-86`, `private-games.yaml:42-47`).
`common` 은 다섯 모듈(search:app 포함)이 이미 의존한다.
다만 스펙 결정 하나가 기존 ADR 과 정면으로 부딪힌다(B1). 기존 코드와의 충돌 둘(R1·R2)과 참조 대상 오류 하나(R3)도 구현 전에 고쳐야 한다.

---

## BLOCK

### B1. 이력서 클릭 원장이 ADR-0064 의 수집 범위를 넘는다 — 체크 #2

- **스펙 결정**: `spec.md` SR-6:67 — "도메인마다 클릭 원장 테이블 하나를 둔다. 필드는 대상 id, 시각, **리퍼러 호스트, UA 계열**". SR-6:70 은 그런 원장을 네 개(r 포함) 둔다고 적는다. `ADR-0103.md:42` 도 같은 결정이다.
- **충돌 문서·코드**:
  - `docs/adr/ADR-0064-resume-site-gated-serving.md:87-89`: "수집 범위는 **토큰·경로·시각**으로 한정한다. 쿠키 기반 방문자 식별이나 referer/UA 수집은 하지 않는다"
  - `code-dictionary/feature/src/main/resources/codedictionarydb/migration/V6__resume.sql:32`: "referer/UA/쿠키 미수집"
  - `portal-fe/src/pages/PrivacyPage.tsx:56-58`: 이력서 호스트는 "광고도 분석 도구도 싣지 않"는 예외로 고지돼 있다.
  - ADR-0103 의 "관련"(`:4`)에는 ADR-0064 가 있지만, 이 수집 범위를 개정한다는 문장은 없다.
- **사람 판단이 필요한 이유**: 개인정보 고지 범위를 바꾸는 결정이다. 고를 수 있는 안은 셋이다.
  1. (권고) **이력서 단축 원장을 두지 않는다.** 제출처 링크별 열람 수는 이미 `resume_access_log` 가 센다(`ResumeAdminService.kt:62-75` `visitCount`, 보존 365일 `RetentionRunner.kt:70`). 단축 경유 여부까지 알아야 한다는 요구는 스펙에 없다(User Story 4 는 "몇 번 들어왔는지"). [[yagni]]
  2. 이력서 원장만 `share_link_id`·시각으로 줄인다. 리퍼러와 UA 는 빼고, 보존기간은 `resume_access_log` 와 같은 365일로 맞출지도 함께 정한다.
  3. ADR-0064 를 개정해 referer 호스트·UA 계열 수집을 허용하고 `/privacy` 이력서 예외 문구를 고친다.

---

## REVISE

### R1. `copyGameLink` 를 `shortUrl` 로 바꾸면 기존 기능이 깨진다 — 체크 #2

- **스펙 결정**: SR-5:62 — "게임 상세의 기존 링크 복사(`copyGameLink`)도 `shortUrl` 을 쓴다."
- **실제 코드**: `copyGameLink` 는 공유 버튼이 아니다. 카카오 인앱 브라우저에서 **외부 브라우저로 옮길 때 쓰는 "현재 링크 복사"**다(`portal-fe/src/pages/games/GameBrowserHelp.tsx:7,12`, `href = window.location.href`). 테스트도 방 코드·해시를 포함한 **정확한 현재 주소**를 복사하는지 고정한다(`portal-fe/src/pages/games/__tests__/browserHelp.test.ts:22`, `.../games/a?room=A#join`). 단축 주소로 바꾸면 초대 방 코드(`?room=`)와 `#join` 이 사라져 다른 브라우저로 넘어간 사람이 방에 못 들어온다.
- **수정안**: SR-5:62 를 지운다. `copyGameLink` 는 손대지 않고, 게임 상세에는 새 공용 공유 패널(SR-5:59)만 붙인다.

### R2. 누적 클릭 수를 대상 행 컬럼에 두면 덮어쓰기·부수 효과가 생긴다 — 체크 #2, #6

- **스펙**: SR-6:68 은 "대상별 누적 클릭 수를 원장과 별도로 유지한다"까지만 적고 위치를 정하지 않았다. `open-questions.yml:22`(Q3 권고안)는 "대상 행의 누적 카운트 컬럼"이다.
- **충돌**:
  - **관광지**: bulk 동기화가 엔티티를 도메인에서 통째로 다시 만든다(`place/.../AttractionRepositoryAdapter.kt:36-43`, `AttractionJpaEntity.fromDomain(merged)`). 매핑된 카운트 컬럼은 매일 수집 배치가 돌 때마다 도메인 값으로 덮인다. 증가 UPDATE 와 겹치면 갱신도 사라진다.
  - **관광지**: `attractions.updated_at` 에 `ON UPDATE CURRENT_TIMESTAMP` 가 걸려 있다(`placedb/migration/V3__create_attractions.sql:23`). 임베딩 대기 판정이 이 값을 쓴다(`AttractionEmbeddingJpaRepository.kt:26` `a.updated_at > e.embedded_at`). 클릭 한 번마다 그 관광지가 임베딩 재처리 대기열에 들어간다.
  - **게임**: `game/CLAUDE.md` Key Rules 가 "실시간 카운터를 Game row 에 두지 않는다"(GameStats 는 프로젝션)고 정해 두었다.
- **수정안**: SR-6 에 누적 수의 저장 위치를 적는다. 권고는 도메인별 카운터 테이블 `{domain}_share_count(target_id PK, click_count BIGINT, last_clicked_at)` 이고, 갱신은 `INSERT … ON DUPLICATE KEY UPDATE click_count = click_count + 1` 한 문장이다. 원자적이고, 대상 행의 `updated_at`·전체 동기화와 무관하다. 기록은 `DealRedirectService.kt:60` 처럼 `REQUIRES_NEW` 로 조회와 분리한다.

### R3. 관광지 "상세 API"는 place 가 아니라 search 이고, 목적지에 언어가 빠졌다 — 체크 #1

- **상세 API 위치**: 관광지 상세 FE 는 `/api/search/attractions/{id}` 를 부른다(`portal-fe/src/api/placeApi.ts:179`). 응답은 search:app 이 낸다(`search/app/.../AttractionSearchController.kt:70-75`). SR-5:58 의 `shortUrl` 을 실을 곳은 search:app 의 `AttractionSearchResult` 다. 읽기 문서 계약이 따로 관리되므로(`search/CLAUDE.md` §인덱스 문서 계약) `shortUrl` 은 색인 필드가 아니라 응답 조립 시점에 `common` 코덱으로 계산한다고 적는다. "Existing Code to Leverage" 표에도 search:app 을 더한다.
- **언어**: 국문·영문은 다른 행이다. id 도 다르다(`V3__create_attractions.sql:2`). `/attractions/{en-id}` 를 열면 canonical 은 맞지만(`AttractionPage.tsx:132-134`) 화면 언어와 주변 검색 언어는 경로 언어를 따른다(`:121`). SR-1:22 목적지를 `lang=en` 이면 `place.1989v.com/en/attractions/{id}`, 아니면 `/attractions/{id}` 로 고친다. 해석기는 행의 `lang` 을 읽는다.
- 같은 맥락: 관광지는 `status` 컬럼이 있다. 임베딩 쪽은 `status = 'ACTIVE'` 로 거른다(`AttractionEmbeddingJpaRepository.kt:26`). SR-4:51 "존재하면 연다"를 "`status = ACTIVE` 면 연다"로 맞추면 두 판정이 같은 기준을 쓴다.

### R4. 이력서 코드 백필 방법과 롤백 호환이 정해지지 않았다 — 체크 #3, #5

- SR-3:38-39 는 "생성기는 `SecureRandom`", "기존 행은 마이그레이션이 채운다", "이 마이그레이션 뒤로 코드가 빈 행은 없다"를 함께 요구한다. 레포에는 Java/Kotlin 기반 Flyway 마이그레이션 선례가 없다(`BaseJavaMigration` 검색 0건). SQL 로 채우면 `SecureRandom` 이 아니다.
- **수정안**:
  1. 한 마이그레이션에서 `ADD COLUMN short_code CHAR(10) NULL` → 기존 행 채우기 → `MODIFY … NOT NULL` + `UNIQUE` 순으로 한다.
  2. 백필 생성기를 명시한다. 예: MySQL `RANDOM_BYTES()` 바이트를 base62 로 매핑하는 식이다. SR-3 의 요구는 "`SecureRandom`"이 아니라 "암호학적 난수"로 완화한다. 행이 몇 개뿐이라는 근거도 적는다.
  3. 도메인 `ResumeShareLink.create/restore`(`ResumeShareLink.kt:30-61`)에 코드 인자와 형식 검사를 추가하는 것을 태스크에 넣는다.
- **롤백**: 마이그레이션은 불변이고(`code-dictionary/CLAUDE.md` §Flyway) 롤포워드뿐이다. 옛 이미지로 되돌리면 `short_code NOT NULL` 때문에 옛 코드의 링크 생성 INSERT 가 실패한다. "롤백 시 링크 생성 불가, 조회·해석은 무관"을 스펙에 적거나, 컬럼에 기본값 없이 NOT NULL 을 거는 시점을 다음 배포로 미룬다.

### R5. 익명 쓰기 경로의 한도와 코덱 경계 — 체크 #4

- **Rate limit**: 해석 성공마다 원장 INSERT 와 카운터 UPDATE 가 일어난다. 익명이 유효한 코드를 반복 호출하면 무제한으로 행이 쌓인다(크롤러 UA 제외는 UA 를 바꾸면 우회된다). 블로그·게임의 익명 쓰기는 Rate Limiter 를 건다(`GatewayRouteConfig.kt:507-518`). deal `/go` 는 걸지 않았다(`:465-469`). SR-4:53 에 단축 라우트 4종에 `requestRateLimiter`(키 리졸버 `userKeyResolver`, `denyEmptyKey=false`)를 걸지 정한다. 걸지 않는다면 deal 과 같은 판단이라고 적는다.
- **디코더 값 범위**: SR-2:33 은 글자·길이 검사만 적었다. 7자 base62 는 `62^7 ≈ 3.5×10^12` 로 `2^40 ≈ 1.1×10^12` 를 넘는다. 디코딩 값이 `2^40` 이상이면 역순열에 넣기 전에 "해석 실패"로 돌려준다는 문장을 더한다. 0 패딩이 다른 같은 값(비정규 표기)도 거절한다.
- **테스트 문서 불일치**: `planning/test-quality.md:7` "Long 상한 근처" 왕복은 SR-2:34(2^40−1 초과는 인코딩 거부)와 맞지 않는다. "2^40−1 경계와 2^40 거부"로 고친다.

### R6. 자동 게이트·배선 누락 — 체크 #1, #2

구현 태스크에 아래를 명시한다. 빠뜨리면 조용히 404가 나거나 방침 숫자 검사를 비켜 간다.

- 새 해석 컨트롤러(place·game·blog 의 `/p` `/g` `/b`)를 `content/app/src/test/kotlin/com/kgd/content/ContentContextLoadSpec.kt:99` 목록에, `/r` 컨트롤러를 `atlas/app/src/test/kotlin/com/kgd/atlas/AtlasContextLoadSpec.kt` 에 더한다(`code-dictionary/CLAUDE.md` "막는 유일한 자동 장치").
- 새 보존기간 상수를 둔 러너를 `portal-fe/src/pages/__tests__/privacyRetention.test.ts:18-21` `RETENTION_RUNNERS` 에 더하고 단축 링크 원장 케이스를 추가한다(SR-6:71 의 "같은 숫자"를 기계로 확인하는 곳).
- place 에는 보존 러너가 없다. `retention-content` CronJob(`k8s/base/retention/cronjob-content.yaml:46`)이 `retention` 프로파일로 띄우는 content 이미지에 `PlaceRetentionRunner` 를 새로 둔다. 이력서는 `RetentionRunner.kt`(atlas) 쪽이다. SR-6:70 의 "보존기간 CronJob"을 이 두 곳으로 구체화한다.
- `/privacy` 는 §6 보존기간만이 아니라 §2 수집 항목 표(`PrivacyPage.tsx:91-95`, "혜택 링크 클릭" 행과 같은 형식)에도 "단축 주소 클릭" 행을 더한다.
- `shortUrl` 의 origin(`https://1989v.com`)은 설정값 하나로 둔다. 로컬 k3d 와 운영이 다르고, 네 도메인(+search)이 같은 값을 써야 한다.

---

## 체크리스트 판정

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| 1 | 참조 클래스·모듈 존재 | 부분 통과 | 표의 경로는 전부 실재한다(`DealRedirectController.kt`, `V1__deal.sql:65-73`, `ResumeAdminService.kt`, `ResumeShareLink.kt`, `ResumePage.tsx:281`, `resume.ts:99`, `GameCatalogAdapters.kt:46`, `SharePanel.tsx`, `browserHelp.ts:25`, retention 2종). 관광지 상세 API 위치가 틀렸다(R3), 게이트 목록이 빠졌다(R6) |
| 2 | 기존 코드와 충돌 없음 | 실패 | B1(ADR-0064), R1(`copyGameLink`), R2(attractions 덮어쓰기·`updated_at`·Game row 카운터 금지) |
| 3 | 복잡도 위험 식별 | 보완 | 코덱 순열은 `common` 순수 함수 한 벌이라 단순하다. 이력서 백필 방식이 미정이다(R4). 이력서 원장 중복은 B1 권고안으로 줄인다 |
| 4 | NFR 안티패턴 없음 | 보완 | 해석은 PK 단건 조회라 N+1 이 없다. 기록 실패는 302 를 막지 않는다(SR-6:69, deal 선례). 익명 쓰기 한도가 미정이고 디코더 값 범위 검사가 빠졌다(R5). 캐시·비동기 적재는 측정 전이라 넣지 않는 것이 맞다 [[premature-optimization]] |
| 5 | 마이그레이션·롤백 전략 | 보완 | SR-6:72 "새 버전으로 추가"는 맞다. 현재 최신 번호는 placedb V19, blogdb V1, codedictionarydb V21이다. 커밋 직전에 번호를 다시 확인한다(`game/CLAUDE.md`). 이력서 NOT NULL 컬럼의 롤백 호환이 미정이다(R4) |
| 6 | 동시성 안전 | 보완 | 카운터를 대상 행에 두면 전체 동기화와 경합한다(R2). 카운터 테이블 upsert 로 바꾸면 해소된다. 이력서 10자 코드 충돌 확률은 62^10 ≈ 8.4×10^17 공간에서 무시할 수준이다. 유일 제약 위반 시 1회 재시도면 충분하다 |

## 이슈 수

- BLOCK 1 (B1)
- REVISE 6 (R1–R6)

VERDICT: BLOCK

---

## Round 2

- 날짜: 2026-10-08
- 대상: 개정된 `spec.md`, `planning/test-quality.md`, `context/review-verdict.md`(C1–C26 매핑), `ADR-0103-share-short-links.md`
- 아래 줄 번호는 개정본 `spec.md` 기준이다.

### 1차 지적 해소 여부

| 1차 | 판정 | 개정 스펙 근거 |
|---|---|---|
| B1 이력서 원장이 ADR-0064 범위 초과 | **해소** | SR-6:82 "원장 필드는 링크 id 와 시각뿐이다. 리퍼러·UA 는 모으지 않는다… 365일", `ADR-0103.md:44`. 1차 제시안 2번 채택. SR-6:89 가 `/privacy` §2 에서 이력서를 제외한다. |
| R1 `copyGameLink` | **해소** | SR-5:74, `test-quality.md:23` |
| R2 대상 행 카운터 | **해소** | SR-6:84-85 별도 집계 테이블 + `INSERT … ON DUPLICATE KEY UPDATE`, `ADR-0103.md:43` |
| R3 상세 API 위치·언어 | **해소** | SR-5:68-70(search:app 응답 조립 시 계산, 색인 무변경), SR-1:22(`/en/attractions/{id}`), `test-quality.md:18,21`. 확인: search 문서 id 는 place id 를 문자열로 바꾼 값이다(`AttractionApiReindexTasklet.kt:103`). 다만 `status` 부분은 반영하지 않았다(C26 demote). 근거 문장이 사실과 달라 아래 N2 로 다시 올린다. |
| R4 백필·롤백 | **해소** | SR-3:40-45. 앱 생성은 `SecureRandom`, 백필은 `RANDOM_BYTES()`, 같은 마이그레이션에서 `NOT NULL`·`UNIQUE` 설정, 형식 검사는 `ResumeShareLink` 생성·복원 시점, 롤백 시 링크 생성 불가 명시. 실현 가능성 확인: atlas 테스트 컨테이너가 `mysql:8.0.33` 이고(`AtlasContextLoadSpec.kt:104`) H2 를 쓰지 않으므로 `RANDOM_BYTES()` 가 테스트 게이트에서도 돈다. |
| R5 리미터·디코더 경계 | **부분 해소** | 디코더: SR-2:35-36, `test-quality.md:8,10` 해소. 리미터: SR-4:63 에 넣었지만 설정 문구가 서로 맞지 않는다. 아래 N1. |
| R6 게이트·배선 | **해소(1건 제외)** | SR-8:100-101(컨텍스트 로드 스펙, `RETENTION_RUNNERS`), SR-6:88(place 러너 신설, CronJob 무변경), SR-6:89(§2·§6), SR-1:24(origin 은 설정값). place 러너가 매니페스트 변경 없이 도는지 확인했다. `cronjob-content.yaml:42,47` 이 content 이미지를 `retention` 프로파일로 띄우고, 기존 러너도 같은 방식으로 도메인 모듈 안의 `@Profile("retention")` 컴포넌트다(`GameRetentionRunner.kt:27-30`). content 기본 datasource 가 place 라는 SR-6:86 의 전제도 맞다(`ContentApplication.kt:10`, `content/app/.../application.yml:16`). 남은 1건(`:common:test` 게이트)은 아래 N3. |

### 개정으로 새로 생긴 문제

#### N1. 리미터 키 리졸버: "IP 기준"과 "블로그·게임과 같은 설정"이 서로 다른 것을 가리킨다 — 체크 #4 (REVISE)

- **스펙**: SR-4:62-63. 단축 라우트에 "인증 필터를 걸지 않"고 "IP 기준 `requestRateLimiter` 를 건다(블로그·게임 익명 쓰기 경로와 같은 설정)".
- **코드**:
  - 블로그·게임 익명 쓰기 라우트는 `userKeyResolver` 를 쓴다(`GatewayRouteConfig.kt:511-515`). 이 리졸버는 `X-User-Id` 헤더를 먼저 보고, 없을 때만 IP 를 쓴다(`RateLimiterConfig.kt:24-29`).
  - 그 라우트들은 `authFilter.apply(optionalUserConfig())` 를 함께 건다(`:510`). 이 필터가 클라이언트가 넣은 신원 헤더를 지운다(`AuthenticationGatewayFilter.kt:110-113`).
  - 단축 라우트에는 인증 필터가 없다. "같은 설정"대로 `userKeyResolver` 를 쓰면 클라이언트가 보낸 `X-User-Id` 가 그대로 키가 된다. 요청마다 헤더 값을 바꾸면 리미터를 우회해 원장 INSERT 를 무제한으로 쌓을 수 있다. R5 가 막으려던 경로다.
- **참고(이번 수정 범위 밖)**: 게이트웨이에는 `forward-headers-strategy` 설정이 없다(`gateway/src/main/resources` 검색 0건). 그래서 `remoteAddress` 는 ingress 파드 주소일 가능성이 높다. 이 경우 "IP 기준"은 실제로 전체가 함께 쓰는 버킷 하나(`RedisRateLimiter(100, 200, 1)`, `RateLimiterConfig.kt:41-42`)다. 남용 한 건이 모든 사용자의 단축 주소를 429 로 만들 수 있다. 플랫폼 공통 문제이므로 스펙에는 한계로만 적는다.
- **수정안**: SR-4:63 을 "`ipKeyResolver`(`RateLimiterConfig.kt:14`)를 명시해 건다"로 고친다. 인증 필터 없이 `userKeyResolver` 를 쓰지 않는다는 이유도 적는다. 대안은 `optionalUserConfig()` 를 함께 걸어 블로그와 정말 같은 설정으로 맞추는 것이다. `test-quality.md:20` 의 게이트웨이 라우트 테스트에 "키 리졸버가 클라이언트 헤더에 좌우되지 않는다"를 더한다.

#### N2. 관광지 공개 판정 "존재 여부(기존 상세와 같다)"는 기존 상세와 같지 않다 — 체크 #1, #2 (REVISE)

- **스펙**: SR-4:54-56. "공개 판정은 도메인의 기존 함수를 부른다… 관광지는 존재 여부(기존 상세와 같다)".
- **코드**: 기존 상세는 search 색인을 읽는다(`AttractionSearchController.kt:70-73`). 색인은 `status == "ACTIVE"` 인 행만 싣는다(`AttractionApiReindexTasklet.kt:75`). 따라서 기존 상세의 실제 판정은 "존재"가 아니라 "ACTIVE"다. place 에 행은 있지만 ACTIVE 가 아닌 관광지는 해석기가 상세로 302 를 보내고, 받은 쪽 상세는 404(`AttractionSearchController.kt:73`)가 된다. SR-4:58 의 "실패는 list 로" 약속이 깨진다. 공유된 뒤 비활성화된 관광지에서 실제로 생기는 경우다.
- **수정안**: SR-4:56 을 "관광지는 `status = ACTIVE`(색인 적재 기준과 같다)"로 고친다. SR-4:54 "상태 목록을 다시 적지 않는다"를 지키려면 판정을 도메인 함수 하나(예: `Attraction.isActive()`)로 두고, 해석기와 기존 네이티브 쿼리 상수(`AttractionJpaRepository.kt:38`, `AttractionEmbeddingJpaRepository.kt:26`)가 같은 값을 쓰게 한다. `test-quality.md:14` 공개 판정 표에 관광지 상태 전수 행을 더한다.

#### N3. `:common:test` 를 넣을 곳으로 지목한 `topology.sh` 는 손으로 고칠 수 없는 생성물이다 — 체크 #1 (REVISE)

- **스펙**: SR-8:102. "`:common:test` 를 배포 게이트(`scripts/ci/topology.sh` 의 atlas·content·search 테스트 목록)에 넣고".
- **코드**:
  - `topology.sh:1`: "생성물 — 손으로 고치지 않는다. ./gradlew generateTopology 가 만든다". 손으로 고치면 `verifyTopologyGenerated` 가 실패한다(`build.gradle.kts:957-980`).
  - 생성기는 파드의 도메인 목록에서만 테스트 태스크를 만든다(`build.gradle.kts:928-933`). `common` 을 넣을 입력이 없다.
  - 지금 `common/` 이 바뀌면 전체 JVM 을 다시 빌드한다(`images.yml:136-138`). 그런데 테스트 단계(`images.yml:263-282`)는 파드별 목록만 돌리므로, 코덱이 들어갈 `common` 의 테스트는 **어디서도 돌지 않는다**. 1차 C14 가 지적한 구멍이 그대로 남는다.
- **수정안**: SR-8:102 의 대상을 `images.yml` 테스트 단계로 바꾼다. 공유 의존성 변경을 감지했을 때(또는 JVM 서비스가 하나라도 있을 때) `TASKS+=" :common:test"` 한 줄을 넣는다. 생성기를 고쳐 파드 목록마다 붙이는 방법도 있지만, 생성 규칙에 예외를 하나 더하게 된다. 확인 기준은 그대로 둔다. CI 로그의 `── Gradle test tasks:` 줄(`images.yml:281`)에 `:common:test` 가 보여야 한다.

### 그 밖의 확인 (이슈 아님)

- `RANDOM_BYTES()`: MySQL 8 함수다. 운영과 테스트 모두 MySQL 8 이므로 Flyway SQL 에서 쓸 수 있다. 바이트를 `% 62` 로 매핑하면 편향이 조금 생긴다(256 = 62×4+8). 몇 행짜리 일회성 백필이라 무시해도 된다.
- 이력서 해석기의 원장·카운터는 atlas 호스트 기본 TM(code-dictionary)을 쓴다. SR-6:86 의 한정자 경고는 content 쪽만 해당하며, 그 구분이 맞다.
- search:app 은 `@PathVariable id: String` 으로 받는다(`AttractionSearchController.kt:71`). `shortUrl` 계산 시 Long 변환에 실패하면 `null` 로 둔다. SR-5:73 의 대체 동작(현재 주소)이 받아 주므로 스펙을 고칠 필요는 없고, 구현 메모로 충분하다.

### 체크리스트 재판정

| # | 항목 | 1차 | 2차 | 근거 |
|---|---|---|---|---|
| 1 | 참조 클래스·모듈 존재 | 부분 통과 | 보완 | R3·R6 해소. `topology.sh` 지목 오류(N3) |
| 2 | 기존 코드와 충돌 없음 | 실패 | 보완 | B1·R1·R2 해소. 관광지 판정이 기존 상세와 어긋남(N2) |
| 3 | 복잡도 위험 식별 | 보완 | 통과 | R4 해소 |
| 4 | NFR 안티패턴 없음 | 보완 | 보완 | 디코더 해소. 리미터 키 리졸버 우회(N1) |
| 5 | 마이그레이션·롤백 전략 | 보완 | 통과 | SR-3:43-45, SR-6:90 |
| 6 | 동시성 안전 | 보완 | 통과 | SR-6:84 upsert, SR-3:41 재시도 |

### 이슈 수 (Round 2)

- 1차 7건 중 6건 해소, 1건 부분 해소(R5 → N1)
- 새 REVISE 3건 (N1 리미터 키 리졸버, N2 관광지 ACTIVE 판정, N3 `:common:test` 게이트 위치)
- BLOCK 0

VERDICT: REVISE

---

## Round 3

- 날짜: 2026-10-08
- 대상: 최신 `spec.md`, `planning/test-quality.md`. 줄 번호는 최신본 `spec.md` 기준이다.

### 2차 지적 해소 여부

| 2차 | 판정 | 근거 |
|---|---|---|
| N1 리미터 키 리졸버 | **해소** | SR-4:65 가 `ipKeyResolver` 를 명시하고, `userKeyResolver` 를 쓰지 않는 이유(인증 필터 부재로 `X-User-Id` 위조 가능)를 적었다. `test-quality.md:20` 에 "`X-User-Id` 를 바꾼 요청도 같은 키" 검증이 있다. 전체 공용 버킷 한계와 429 동작은 SR-8:108-109 에 한계로 적혔다. |
| N2 관광지 ACTIVE | **해소** | SR-4:58 "관광지는 `status = ACTIVE` 다(기존 상세가 읽는 search 색인이 ACTIVE 행만 싣는다)". 근거가 코드와 맞다(`AttractionApiReindexTasklet.kt:75`). `test-quality.md:18` 에 "ACTIVE 아닌 관광지는 목록으로" 행이 있다. 남은 점: SR-4:56 "상태 목록을 다시 적지 않는다"와 달리 관광지는 리터럴을 한 번 더 적는다. 도메인 함수 하나로 묶을지는 구현 메모로 충분하다(비차단). |
| N3 `:common:test` 게이트 | **해소** | SR-8:105 가 대상을 `.github/workflows/images.yml` 테스트 단계로 바꾸고, `topology.sh` 는 생성물이라 손대지 않는다고 적었다. 넣을 자리는 실재한다. `images.yml:268-282` 가 `TASKS` 를 조립하고 `:281` 이 `── Gradle test tasks:` 를 출력한다. 확인 기준은 `test-quality.md:32` 다. |

### 개정 검증 (이번 편집분)

- **`CHECK` + 정규식 (SR-3:46)**: 테스트 하네스는 둘 다 실제 MySQL 이다(`AtlasContextLoadSpec.kt:103-104`, `ContentContextLoadSpec.kt:163-164`, `mysql:8.0.33`). MySQL 8.0.16 부터 `CHECK` 를 강제한다. 결정적 내장 함수(`REGEXP_LIKE`)는 `CHECK` 식에 쓸 수 있다. `ALTER TABLE … ADD CHECK` 는 기존 행을 검사하므로 "백필 결과가 형식을 어기면 마이그레이션이 실패한다"도 성립한다. 실현 가능하다.
- **SR-1:26 설정 키 묶음**, **SR-8:108-109 한계 서술**: 기존 코드와 충돌하는 곳이 없다.

### 새 이슈

#### N4. 이력서 코드의 "대소문자 구분"은 `CHECK` 가 아니라 컬럼 콜레이션이 정한다 — 체크 #2, #6 (REVISE, 비차단)

- **스펙**: SR-3:46. "`NOT NULL`·`UNIQUE` 와 형식 `CHECK`(10자 base62, 대소문자 구분)를 건다".
- **코드**: `resume_share_link` 는 `DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` 다(`code-dictionary/feature/src/main/resources/codedictionarydb/migration/V6__resume.sql:30`). 새 컬럼에 콜레이션을 지정하지 않으면 테이블 기본값인 대소문자 무시(`_ci`)를 물려받는다. 그러면 두 가지가 생긴다.
  - `UNIQUE` 가 `aB3…` 와 `Ab3…` 를 같은 값으로 본다. 충돌 재시도(SR-3:43)가 받아 주므로 동작은 하지만, 코드 공간이 62^10 이 아니라 36^10 처럼 판정된다.
  - 해석 조회 `WHERE short_code = ?` 가 대소문자를 바꾼 입력도 같은 링크로 연다. 추측 공격에서 실효 엔트로피가 SR-3:42 의 "약 59비트"에서 약 52비트로 준다. 공개 콘텐츠 코드(SR-2)는 비정규 표기를 거절하는데 이력서 코드만 다른 표기를 받아 주는 불일치도 생긴다.
  - `CHECK` 의 문자 클래스 `[0-9A-Za-z]` 는 두 경우를 다 허용하므로 콜레이션 문제를 막지 못한다.
- **수정안**: SR-3:46 에 "`short_code` 컬럼은 `CHAR(10) CHARACTER SET ascii COLLATE ascii_bin`(또는 `utf8mb4_bin`)"을 적는다. "대소문자 구분"은 `CHECK` 괄호에서 빼고 콜레이션 문장으로 옮긴다. `test-quality.md:11` 이나 `:16` 에 "대소문자만 바꾼 이력서 코드는 해석 실패"를 한 줄 더한다. 이 검증은 실제 MySQL 하네스(`AtlasContextLoadSpec`)에서만 의미가 있다.

### 참고 (이슈 아님)

- MySQL 은 DDL 을 트랜잭션으로 묶지 않는다. 백필 마이그레이션이 중간(예: `CHECK` 추가)에서 실패하면 컬럼은 이미 추가된 채 `flyway_schema_history` 에 실패 행이 남고, `flyway repair` 와 수동 정리가 필요하다. 형식 위반은 `RANDOM_BYTES()` 매핑 버그일 때만 생기고, 하네스가 같은 마이그레이션을 먼저 돌리므로 운영 전에 잡힌다. 스펙을 고칠 필요는 없다.

### 체크리스트 재판정

| # | 항목 | 2차 | 3차 | 근거 |
|---|---|---|---|---|
| 1 | 참조 클래스·모듈 존재 | 보완 | 통과 | N3 해소. `images.yml:268-282` 실재 |
| 2 | 기존 코드와 충돌 없음 | 보완 | 보완 | N2 해소. 테이블 기본 콜레이션 `_ci` 와 "대소문자 구분"이 충돌(N4) |
| 3 | 복잡도 위험 식별 | 통과 | 통과 | 변경 없음 |
| 4 | NFR 안티패턴 없음 | 보완 | 통과 | N1 해소. 공용 버킷 한계는 SR-8:108 에 명시 |
| 5 | 마이그레이션·롤백 전략 | 통과 | 통과 | `CHECK`·`REGEXP_LIKE` 가 MySQL 8.0.33 하네스에서 성립 |
| 6 | 동시성 안전 | 통과 | 통과 | N4 를 고치면 유일 제약이 의도한 공간에서 동작 |

### 이슈 수 (Round 3)

- 2차 3건(N1·N2·N3) 모두 해소
- 새 REVISE 1건 (N4 이력서 코드 컬럼 콜레이션). 한 줄 수정이다.
- BLOCK 0

VERDICT: REVISE
