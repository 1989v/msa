# 보안 리뷰 — 공유용 단축 링크

- 대상: `spec.md`, `planning/requirements.md`, `context/open-questions.yml`, `docs/adr/ADR-0103-share-short-links.md`
- 차원: security (`hns/0.16.1/skills/spec-review/reviewers/security/checklist.md`)
- 기준 문서: ADR-0064(이력서 게이트), ADR-0089(비밀 게임), ADR-0077(원장 보존), `/privacy`(`portal-fe/src/pages/PrivacyPage.tsx`)
- 지식베이스: 볼트 `1989v/wiki` 에서 open redirect·단축 링크·base62·열거·bearer 키워드로 찾았다. 직접 해당하는 개념 페이지는 없었고, [[gate-failure-modes]] ④(기대값이 대상과 같은 곳에서 온다)만 R3 에 적용했다.

## 요약

| # | 등급 | 한 줄 |
|---|---|---|
| B1 | BLOCK | 이력서 단축 클릭 원장이 리퍼러·UA 를 모은다 — ADR-0064 열람 추적 범위, `/privacy` §6 문구와 충돌 |
| R1 | REVISE | 기존 행 백필이 SQL 마이그레이션이면 `SecureRandom` 이 아니다 — 생성기 요구가 백필에서 깨진다 |
| R2 | REVISE | `Location` 의 origin 출처가 정해져 있지 않다 — 요청 헤더에서 오면 오픈 리다이렉트 |
| R3 | REVISE | 게임 공개 판정을 상태 목록으로 적었다 — 원본은 private 상수라 사본이 생긴다 |
| R4 | REVISE | `/r` 코드는 자격 증명인데 로그 필드 규칙이 없다 |
| R5 | REVISE | 익명 쓰기(클릭 원장·누적 수) 경로에 Rate Limiter 가 없다 |
| R6 | REVISE | `/privacy` §2 수집 항목 표 갱신이 빠졌다 |

## 체크리스트 판정

| 항목 | 판정 | 근거 |
|---|---|---|
| 위협 모델링 (STRIDE) | 부분 | 아래 STRIDE 표. 스펙에 명시적 위협 모델은 없지만 공개 판정·이력서 예외(ADR-0103 §3)가 핵심 위협을 다룬다 |
| 인증/인가 경계 | 통과 (B1·R3 제외) | 단축 경로는 전부 익명. 권한은 이력서 코드(약 59비트, `spec.md:38`)와 각 도메인 공개 판정(`spec.md:49-51`)이 진다 |
| 민감 데이터 흐름 | **실패** | B1, R4 |
| 입력 검증 바운더리 | 부분 | 디코더 문자·길이 검증(`spec.md:33`)은 충분. 출력 쪽(`Location` 조립)이 R2 |
| 서비스 간 통신 | 통과 | 해석은 대상 도메인 안에서 끝난다, 교차 호출 없음 (`spec.md:45-46`, ADR-0103:37) |
| 시크릿/크리덴셜 관리 | 부분 | 순열은 비밀이 아니라고 명시(`spec.md:30`)한 판단은 맞다. 이력서 코드 백필이 R1 |
| 암호화/해싱 | 통과 | 새 저장 비밀값 없음. 이력서 코드는 기존 토큰과 같은 평문 저장 정책(`ResumeShareLink.kt:14`)을 따른다 |
| 감사 로깅 | 부분 | 해석 결과 debug 로그(`spec.md:76`)는 있으나 필드 규칙이 없다 — R4 |
| PCI-DSS / 주문·재고 권한 | 해당 없음 | 결제·주문 경로를 건드리지 않는다 |
| Rate Limiting / Abuse | **실패** | R5 |

### STRIDE

| 위협 | 경로 | 스펙의 방어 | 남은 것 |
|---|---|---|---|
| Spoofing | `/r/{code}` 추측 | 10자 `SecureRandom`(약 2^59). 초당 1,000회로도 평균 수백만 년 | 백필 행의 무작위성 (R1) |
| Tampering | 클릭 누적 수 부풀리기 | 크롤러 UA 제외(`spec.md:69`) | UA 는 위조 가능, 제한 없음 (R5) |
| Repudiation | — | 해당 없음 | — |
| Information Disclosure | 비공개 대상 존재 여부 | 실패를 한 종류의 302 로 통일(`spec.md:52`) — ADR-0064:58-59 의 404 은닉 원칙과 같은 효과 | 이력서 원장 필드 (B1), 로그 (R4) |
| DoS | 해석 실패 요청 폭주 | 형식 오류는 DB 전에 걸러진다(`spec.md:33`) | 형식이 맞는 무작위 코드는 매번 DB 조회 (R5) |
| Elevation | 비공개 게임·초안 글 열기 | 상태 판정(`spec.md:49-51`) | 판정 사본 위험 (R3) |

## 이슈 상세

### B1 [BLOCK] 이력서 단축 클릭 원장이 ADR-0064 열람 추적 범위를 넘는다 — 체크 3

- **스펙 결정**: `spec.md:67` 「도메인마다 클릭 원장 테이블 하나를 둔다. 필드는 대상 id, 시각, 리퍼러 호스트, UA 계열이다」 — `r` 이 포함된다(`spec.md:45`, ADR-0103:42 「각 도메인 DB 에 하나씩」).
- **위반하는 문서**:
  - `docs/adr/ADR-0064-resume-site-gated-serving.md:87-89` 「수집 범위는 토큰·경로·시각으로 한정한다. 쿠키 기반 방문자 식별이나 referer/UA 수집은 하지 않는다」.
  - `portal-fe/src/pages/PrivacyPage.tsx:255-257` 「어떤 공유 링크가 언제 열렸는지만 남고, 열람한 사람을 식별하는 정보는 기록하지 않습니다」. 공개 방침이다.
- 이력서의 리퍼러 호스트는 그 링크를 연 채용 담당자가 쓰는 메일·ATS 도메인을 드러낸다. ADR-0064 는 「방문자 프로파일링이 아니다」를 근거로 이 수집을 의도적으로 뺐다. 스펙은 `/privacy` §6 에 숫자만 더하겠다고 했고(`spec.md:71`), 위 문장은 그대로 남아 거짓이 된다.
- CLAUDE.md 의 「ADR 검토 후 구현, 충돌 시 중단 후 확인 요청」에 해당해 사람 판단이 필요하다.
- **수정안 (택1)**:
  - (권고) `r` 은 새 원장을 만들지 않는다. 목적지 페이지가 이미 `resume_access_log` 에 `share_link_id`·시각을 남긴다(`ResumeQueryService.kt:52,67`). 단축 경유 여부가 꼭 필요하면 링크 id·시각만 가진 원장으로 줄이고, 보존기간은 ADR-0077:46 의 이력서 기준(365일)을 따를지 함께 정한다.
  - ADR-0064 열람 추적 절과 `/privacy` §6 이력서 문장을 같이 개정한다. 개정 이유를 ADR 에 남긴다.

### R1 [REVISE] 기존 행 백필의 무작위성 — 체크 6

- `spec.md:38` 「생성기는 `SecureRandom` 이다」, `spec.md:39` 「기존 행은 마이그레이션이 채운다」.
- code-dictionary 이력서 스키마는 SQL Flyway 다(`code-dictionary/app/.../db/migration/V6__resume.sql` 등). SQL 로 채우면 `RAND()`·`UUID()` 를 쓰기 쉽다. `RAND()` 는 시드로 예측 가능한 PRNG 라 `SecureRandom` 요구가 지금 쓰이고 있는(제출처에 이미 나간) 링크에서만 깨진다.
- **수정안**: SR-3 에 백필 방법을 적는다. `RANDOM_BYTES()`(MySQL CSPRNG)로 만든 바이트를 base62 로 변환하거나, 기동 시 `SecureRandom` 으로 빈 행을 채우는 앱 쪽 백필 중 하나로 정한다. `RAND()`·`UUID()` 는 금지라고 쓴다. 검증 항목으로 「백필 후 NULL 0행 · 전 행 10자 base62 · 유일」을 추가한다.

### R2 [REVISE] `Location` origin 의 출처를 고정한다 — 체크 4 (오픈 리다이렉트)

- `spec.md:22-23` 은 목적지 주소 모양만 적었다. origin 을 어디서 얻는지는 정하지 않았다. 구현자가 `ServletUriComponentsBuilder.fromCurrentRequest` 류나 `Host`/`X-Forwarded-Host` 로 조립하면 헤더를 조작한 요청에 임의 호스트로 302 하는 경로가 생긴다. 이력서는 그 `Location` 에 토큰이 실린다.
- 선례: `blog/feature/.../render/BlogMetaRenderer.kt:28` 가 `@Value("\${blog.origin:https://blog.1989v.com}")` 로 고정값을 쓴다. deal 은 DB 의 `target_url` 을 그대로 쓴다(`DealRedirectController.kt:40`). 단축 링크에는 둘 다 그대로 들어맞지 않으므로 스펙이 정해야 한다.
- **수정안**: SR-1 또는 SR-4 에 다음을 적는다.
  - 목적지 origin 4종과 `list` 목적지는 설정 상수에서만 온다. 요청 헤더에서 오지 않는다.
  - 경로에 붙는 값은 DB 에서 읽은 id·slug 뿐이다. 입력 코드 원문은 넣지 않고, slug 는 경로 세그먼트로 인코딩한다.
  - 슬라이스 테스트 하나: `Host`·`X-Forwarded-Host` 를 바꾼 요청도 `Location` 호스트가 바뀌지 않는다.

### R3 [REVISE] 게임 공개 판정은 같은 함수를 부른다고 못 박는다 — 체크 2

- `spec.md:50` 은 「공개 상세 API 가 내주는 상태(`PUBLISHED`·`BETA`)만 연다」로 상태 목록을 적었다. 요구사항은 「상세 API 의 노출 규칙과 같은 함수를 쓴다」(`requirements.md:48-49`)였다.
- 그 규칙의 원본은 `GameCatalogAdapters.kt:46` 의 `private val PUBLIC_STATUSES` 다. 밖에서 부를 수 없으므로 목록대로 구현하면 리졸버에 두 번째 사본이 생긴다. 공개 상태가 바뀌면(BETA 를 넣었다 뺀 이력이 있다, `game/CLAUDE.md` 「curfew-siren」 행) 단축 경로만 옛 규칙으로 남는다. 테스트가 사본으로 기대값을 만들면 [[gate-failure-modes]] ④(기대값이 대상과 같은 곳에서 온다)가 되어, 판정을 지워도 초록불이 난다.
- 블로그도 같다 — 판정은 `PostStatus.publiclyVisible`(`BlogEnums.kt:47`)를 부르게 적는다.
- **수정안**: SR-4 를 「공개 상세 조회가 쓰는 저장소 메서드(또는 도메인 판정)를 그대로 부른다. 상태 목록을 리졸버에 다시 적지 않는다」로 바꾼다. 검증에 「DRAFT·REVIEW·SUSPENDED 게임, DRAFT·ARCHIVED 글은 `/list` 로 간다」를 실제 어댑터로 넣는다.
- 참고(이슈 아님): ADR-0089 비밀 게임은 카탈로그 행이 없으므로(ADR-0089:51) `/g` 로 인코딩될 id 자체가 없다. 관광지 「존재하면 연다」는 공개 상세 `AttractionService.kt:30-31` 이 상태를 거르지 않는 것과 일치한다.

### R4 [REVISE] `/r` 코드와 토큰을 로그에 남기지 않는다 — 체크 3·8

- `spec.md:76` 은 해석 결과 로그 한 줄만 정했다. 필드 규칙은 없다. 선례인 deal 은 실패 경고에 입력값을 싣는다(`DealRedirectController.kt:56` `slug=$slug`). 같은 모양을 복사하면 `/r` 의 코드(이력서 열람 자격 증명)와, 성공 시 조립한 `Location`(32자 토큰 포함)이 로그로 나간다.
- **수정안**: SR-7 에 적는다 — 로그 필드는 접두사·결과 종류·대상 id(공개 대상만)다. `r` 은 코드·토큰·`Location` 을 남기지 않고 링크 id 만 남긴다. 기록 실패 경고(`spec.md:69`)도 같은 규칙을 따른다.
- 참고: 인그레스 접근 로그에 `/r/{code}` 경로가 남는다. 지금도 `resume.1989v.com/?k=` 요청이 같은 방식으로 남으므로 새 노출은 아니다. 스펙에 한 줄로 인지 사실만 적어 두면 된다.

### R5 [REVISE] 익명 쓰기 경로에 Rate Limiter — 체크 「Rate Limiting / Abuse」

- `spec.md:53` 은 게이트웨이 라우트를 둔다고만 했다. 선례 `deal-redirect`(`GatewayRouteConfig.kt:465-469`)는 리미터가 없다. 같은 파일은 익명 쓰기 경로에 리미터를 건다는 원칙을 갖고 있다(`GatewayRouteConfig.kt:505-516` 「익명 쓰기라 Rate Limiter 를 건다」).
- 단축 해석은 성공할 때마다 원장 INSERT 와 누적 수 UPDATE 를 하는 익명 쓰기다(`spec.md:67-69`). 크롤러 판정은 UA 문자열 기준이라 사람 UA 로 위장한 스크립트가 누적 수를 마음대로 올리고 원장을 채운다. `/r` 은 형식이 맞는 무작위 코드마다 DB 조회가 일어난다.
- **수정안**: 네 라우트(최소 `/r/**`)에 `requestRateLimiter` 를 건다고 SR-4 에 적는다. 무차별 대입은 59비트로 이미 막혀 있으니, 리미터의 목적은 원장·DB 부하 보호라고 밝힌다.

### R6 [REVISE] `/privacy` §2 수집 항목 표 — 체크 3

- `spec.md:71` 은 ADR-0077 표와 `/privacy` §6 만 고친다고 했다. 수집 항목은 §2 표(`PrivacyPage.tsx:72-117`)가 열거한다. 지금 클릭 행은 「혜택 링크 클릭」(`PrivacyPage.tsx:92-94`)뿐이다.
- §6 의 「조회 · 클릭 기록 90일」(`PrivacyPage.tsx:251`)은 숫자상 새 원장을 덮는다. 그러나 §2 에 행이 없으면 「무엇을 모으는가」가 빠진 방침이 된다. ADR-0077:85 「방침에는 실제로 도는 것만 적는다」의 반대 방향 어긋남이다.
- **수정안**: SR-6 에 「`/privacy` §2 표에 『단축 주소로 들어온 방문 — 어떤 대상을 언제, 들어온 사이트 주소, 브라우저 종류』 행을 추가한다」를 넣는다. B1 결론에 따라 이력서 포함 여부를 문구에 반영한다.

## 통과로 본 것

- 공개 대상(p·g·b) 코드 열거: 순열이 비밀이 아니고 대상이 원래 공개라 새로 노출되는 것이 없다(ADR-0103:26). 실패 응답이 하나라 「대상 없음」과 「비공개」를 구분할 수 없다(`spec.md:52`). `game/CLAUDE.md` 「DRAFT/REVIEW/SUSPENDED 는 NOT_FOUND (존재 여부 은닉)」과 같은 효과다.
- 이력서 실패 응답: 철회·없음 모두 resume 홈으로 간다. `TOKEN_ONLY` 이면 홈이 게이트 화면이다(`open-questions.yml:9`). ADR-0064:53-59 의 「폐기·미존재 → 404, 존재 은닉」과 결과가 같다.
- 응답 헤더 `no-store`·`noindex, nofollow`(`spec.md:47-48`): 302 캐시로 철회 뒤에도 토큰 주소로 가는 경로를 막는다.
- IP 비저장(`spec.md:67`), 보존 90일 CronJob 편입(`spec.md:70`, ADR-0077:63-64 「앞으로 생길 원장 정리는 전부 여기 모은다」).
- 서비스 경계: 도메인마다 자기 저장소만 읽는다(`spec.md:45-46`). 단축 전용 모듈을 두지 않아 교차 참조 규칙을 지킨다.

VERDICT: BLOCK

## Round 2 (2026-10-08)

대상: 개정 `spec.md`, `planning/test-quality.md`, `context/review-verdict.md`, `docs/adr/ADR-0103-share-short-links.md`. 아래 줄 번호는 개정 `spec.md` 기준이다.

### 1차 지적 종결 확인

| # | 상태 | 근거 |
|---|---|---|
| B1 | 종결 | `spec.md:82` 「이력서(r): 원장 필드는 링크 id 와 시각뿐이다. 리퍼러·UA 는 모으지 않는다(ADR-0064 수집 범위). 보존은 … 365일」. ADR-0103:44 도 같다. ADR-0064:87-89 범위 안이고 `/privacy` §6 이력서 문장(「어떤 공유 링크가 언제 열렸는지만」)과도 맞는다 |
| R1 | 종결 | `spec.md:43-44` — `RANDOM_BYTES()`, `RAND()`·`UUID()` 금지, 같은 마이그레이션에서 `NOT NULL`·`UNIQUE`. 형식 검사는 엔티티 복원 시점(`spec.md:42`)이라 백필 값이 10자 base62 가 아니면 로드에서 드러난다 |
| R2 | 종결 | `spec.md:24` origin 은 설정값에서만, `Host`·`X-Forwarded-Host` 금지. `spec.md:23` slug 경로 세그먼트 인코딩, `spec.md:60` 쿼리 미전달. 검증은 `test-quality.md:19` |
| R3 | 종결 | `spec.md:54-56` 도메인 함수 호출, 상태 목록 재기재 금지. `Game.isPlayable()`(`Game.kt:153`)은 공개 상세가 실제로 쓰는 판정(`GameQueryService.kt:170`)과 같다. 검증은 상태 전수 대조(`test-quality.md:14`) |
| R4 | 종결 | `spec.md:95` `/r` 로그는 코드·토큰·`Location` 없이 링크 id 만, 기록 실패 경고 포함. 검증 `test-quality.md:29`. 인그레스 접근 로그 인지 문장은 빠졌으나 새 노출이 아니라 지적하지 않는다 |
| R5 | 부분 — 아래 N1 | `spec.md:63` 리미터를 건다. 단 키 선택이 우회 가능하다 |
| R6 | 종결 | `spec.md:89` `/privacy` §2 「단축 주소 클릭」 행(이력서 제외) + §6 숫자 갱신. 이력서 원장은 기존 §6 이력서 문장 범위 안이라 제외가 맞다 |

### 새 이슈

#### N1 [REVISE] 인증 필터 없는 라우트에 `userKeyResolver` 를 쓰면 리미터를 헤더 하나로 우회한다 — 체크 「Rate Limiting / Abuse」

- **스펙 결정**: `spec.md:62-63` 「인증 필터를 걸지 않는다 … IP 기준 `requestRateLimiter` 를 건다(블로그·게임 익명 쓰기 경로와 같은 설정)」.
- **코드 사실**: 그 「같은 설정」은 IP 기준이 아니다. 블로그·게임 익명 쓰기 라우트는 `config.setKeyResolver(userKeyResolver)` 다(`GatewayRouteConfig.kt:254,268,513`). `userKeyResolver` 는 `X-User-Id` 헤더를 먼저 키로 쓴다(`RateLimiterConfig.kt:24-28`). 그 라우트들이 안전한 이유는 `optionalUserConfig()` 인증 필터가 앞에서 클라이언트가 넣은 `X-User-Id` 를 지우기 때문이다(`AuthenticationGatewayFilter.kt:110-113`). 같은 파일이 필터 없는 라우트에서는 「손으로 붙인 X-User-Id 가 그대로 통과한다」고 적고 있다(`GatewayRouteConfig.kt:294-295`).
- 스펙대로 「인증 필터 없음 + 같은 설정」으로 구현하면, 요청마다 `X-User-Id` 값을 바꾸는 스크립트가 버킷을 새로 받는다. R5 에서 막으려던 누적 수 부풀리기와 원장 채우기가 그대로 열린다. `test-quality.md:20` 은 「리미터 있음」만 보므로 이 구현을 통과시킨다.
- **수정안**: `spec.md:63` 을 「키는 `ipKeyResolver`(`RateLimiterConfig.kt:14`)로 명시한다. 인증 필터가 없어 `X-User-Id` 를 신뢰할 수 없기 때문이다」로 바꾼다. 「같은 설정」은 `redisRateLimiter` 와 `setDenyEmptyKey(false)` 에만 걸리게 고친다. `test-quality.md:20` 에 「키 리졸버가 `ipKeyResolver` 다 — `X-User-Id` 를 바꾼 요청이 같은 키로 묶인다」를 추가한다.
- 참고(이번 스펙의 이슈 아님): 두 리졸버 모두 `remoteAddress` 를 쓰는데, 인그레스 뒤라 그 값이 인그레스 파드 주소일 수 있다. 그러면 IP 기준이 사실상 전역 버킷 하나가 된다. 게이트웨이 전체에 이미 있는 동작이라 보고만 한다.

### 그 밖에 본 것 (이슈 없음)

- 백필 base62 변환의 모듈로 편향(256 mod 62): 글자당 엔트로피 손실이 0.01비트 미만이다. 10자 기준 59비트에서 의미 있는 감소가 없다.
- 이력서 실패 302(`spec.md:58`)와 쿼리 미전달(`spec.md:60`): 목적지에 입력값이 섞이지 않아 R2 의 오픈 리다이렉트 경로가 다시 생기지 않는다.
- `/privacy` §2 에서 이력서를 뺀 것(`spec.md:89`): 이력서 원장은 링크 id·시각뿐이라 기존 이력서 열람 기록 설명(`PrivacyPage.tsx:255-257`) 범위 안이다.

VERDICT: REVISE

## Round 3 (2026-10-08)

대상: 개정 `spec.md`, `planning/test-quality.md`, `docs/adr/ADR-0103-share-short-links.md`. 줄 번호는 3차 개정 `spec.md` 기준이다. 범위는 N1 종결 확인과 이번 개정으로 새로 생긴 문장뿐이다.

### N1 종결 확인

| # | 상태 | 근거 |
|---|---|---|
| N1 | 종결 | `spec.md:65` 「키는 `ipKeyResolver` 다 — `userKeyResolver` 는 `X-User-Id` 를 먼저 보는데, 단축 경로에는 그 헤더를 지우는 인증 필터가 없어 헤더만 바꿔 우회할 수 있다」. 「블로그·게임과 같은 설정」 문구는 빠졌다. 검증은 `test-quality.md:20` 「리미터 키가 `ipKeyResolver`(`X-User-Id` 를 바꾼 요청도 같은 키)」로 수정안과 같다 |

### 새 이슈

#### N2 [REVISE] 감수 한계 두 문장이 서로 어긋나 가용성 영향이 실제보다 작게 적혔다 — 체크 「Rate Limiting / Abuse」

- **스펙 문장**: `spec.md:108` 「`ipKeyResolver` 의 키가 인그레스 주소일 수 있다. 그러면 리미터는 사실상 전체 공용 버킷이다」. 바로 다음 `spec.md:109` 「레이트 리미터에 걸린 요청은 … 429 를 받는다. 같은 IP 에서 단시간에 몰릴 때만 생긴다」.
- **코드 사실**: 버킷은 `RedisRateLimiter(100, 200, 1)`(`RateLimiterConfig.kt:42`) — 초당 100, 순간 200 이다. 108줄의 전제가 맞으면 「같은 IP」는 모든 방문자다. 스크립트 하나가 초당 100건을 넘기면 단축 주소 네 종이 전 사용자에게 429 를 낸다. 109줄의 「같은 IP 에서 몰릴 때만」은 이 경우를 가린다.
- 한계를 감수하는 결정 자체는 문제 삼지 않는다(게이트웨이 공통 문제, 2차 참고와 같다). 사람이 승인하는 문장이 영향 범위를 정확히 적어야 한다는 지적이다. 단축 주소는 메신저로 밖에 나간 진입점이라 막히면 공유 경로 전체가 끊긴다.
- **수정안**: `spec.md:109` 를 「키가 인그레스 주소이면 버킷이 전역이라, 전체 요청이 초당 100(순간 200)을 넘을 때 모든 방문자가 429 를 받는다. 한 사람의 스크립트로도 생긴다」로 고친다. 고칠지 여부는 바꾸지 않아도 된다.

### 그 밖에 본 것 (이슈 없음)

- `spec.md:24` origin 설정값 고정과 `spec.md:26` 설정 키 `kgd.common.short-link.*` 공유: 요청 헤더가 끼어들 자리가 없다. R2 종결 상태 유지.
- `spec.md:62-63` 경로 처리(쿼리 무시, 추가 세그먼트는 실패): 목적지에 입력이 섞이지 않는다.
- `spec.md:58` 관광지 판정 `status = ACTIVE`: 공개 상세가 읽는 색인과 같은 기준이라 비공개 노출이 없다.
- `spec.md:105` `:common:test` 배포 게이트 편입: 크롤러 분류기(`spec.md:82`) 회귀가 배포 전에 잡힌다. 보안 측 이슈 없음.

VERDICT: REVISE
