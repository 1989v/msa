# Task Breakdown: 공유용 단축 링크

## Overview
Total Task Groups: 8

표준: 레이어 `docs/conventions/package-structure.md`(UseCase 인터페이스 + Outbound Port + Adapter, 견본 `inventory/feature`) ·
테스트 `docs/standards/test-rules.md`(Kotest BehaviorSpec + MockK) · JPA `docs/conventions/jpa-persistence.md` ·
트랜잭션 `docs/conventions/transactional-usage.md` · 로깅 `docs/conventions/logging.md` · FE `DESIGN.md`·`docs/conventions/frontend-design.md`.
검증 명령은 새로 쓴 테스트만 지정한다(전체 스위트는 verifier). 커밋은 그룹마다 경로를 좁혀 한다(공유 워킹트리).

배포 순서 장치(SR-8): `kgd.common.short-link.expose` 기본 `false`. 해석 경로를 배포·실측한 뒤 운영 설정에서 켜야 상세 응답·어드민 응답에 `shortUrl` 이 실린다.

### Task Group 1: common — 코덱·주소 조립·크롤러 분류·게이트
**Dependencies:** None
**Phase:** foundation
**Required Skills:** Kotlin, Spring auto-configuration
- [x] 1.0 Complete common
  - [x] 1.1 테스트 작성: `ShortCode` 골든 벡터(0, 1, 62, 2^40−1 리터럴) · 왕복 · 10만 표본 충돌 없음 · 거절(2^40, 5·8자, base62 밖, `list`, 디코드 ≥2^40 7자, 비정규 표기) · `ShortLinks` 가 `Host`·`X-Forwarded-Host` 와 무관하게 설정 origin 으로 `Location`·`shortUrl` 을 만든다 · 302 헤더(`no-store`·`noindex`) · `CrawlerUserAgents` 실제 UA 표(카카오톡 스크랩·facebookexternalhit·Slackbot·Discordbot·헤드리스 크롬·일반 브라우저)
  - [x] 1.2 `ShortCode`(순수 Kotlin, 고정 순열 + base62, 6~7자, 실패는 null) — SR-2
  - [x] 1.3 `ShortLinkProperties`(`kgd.common.short-link.*`: origin, 서비스 origin 넷, `expose`) + 302 응답·단축 주소 조립 헬퍼 + auto-configuration 등록 — SR-1
  - [x] 1.4 `CrawlerUserAgents`(analytics 목록 출발 + 미리보기 봇 추가). 기존 analytics·blog 판정은 손대지 않는다 — SR-6
  - [x] 1.5 `common/docs/service.md` Provided Components 표 갱신
  - [x] 1.6 `.github/workflows/images.yml` 테스트 단계에 `:common:test` 추가(생성물 `scripts/ci/topology.sh` 는 손대지 않는다) — SR-8
  - [x] 1.7 골든 벡터 회귀 주입: 순열 상수를 임시 사본에서 바꿔 빨간불 확인 후 원복
  - [x] 1.8 Verify: `./gradlew :common:test --tests '*ShortCode*' --tests '*ShortLinks*' --tests '*CrawlerUserAgents*'`
**Acceptance Criteria:**
- 골든 벡터가 순열 변경 회귀에서 실패한다(주입 결과를 기록).
- `Location` 호스트가 요청 헤더로 바뀌지 않는다.

### Task Group 2: resume(atlas) — `/r` 해석·이력서 코드·클릭 원장
**Dependencies:** Task Group 1
**Phase:** backend
**Required Skills:** Kotlin, Spring MVC, JPA, Flyway(MySQL 8)
- [x] 2.0 Complete resume
  - [x] 2.1 테스트 작성: `ResumeShareLink` 코드 형식 검사(생성·복원) · 생성 시 10자 코드 자동 부여 · 유일 충돌 시 재생성 · 리다이렉터 302/목적지 `resume.1989v.com/?k=` · 폐기·없음·형식 오류 → resume 홈 302 · 경로 엣지(쿼리 무시, `/r`·`/r/`·`/r/list` → 홈, 추가 세그먼트 실패) · 원장 행에 리퍼러·UA 없음 · 기록 실패에도 302 · 로그에 코드·토큰 없음 · 어드민 목록 `shortUrl`(expose 켜짐/꺼짐)
  - [x] 2.2 `V22__resume_short_code.sql`: `short_code` 컬럼(`ascii_bin`) → `RANDOM_BYTES()` 백필 → `NOT NULL`·`UNIQUE`·`CHECK(REGEXP_LIKE(...,'c'))`; 원장 `resume_short_link_click(share_link_id, clicked_at)`; 집계 `resume_short_link_stat(share_link_id PK, click_count)` — SR-3, SR-6
  - [x] 2.3 도메인·application: 코드 생성(SecureRandom), `ResolveResumeShortLinkUseCase`(`isUsable()`), `RecordResumeShortLinkClickUseCase`(REQUIRES_NEW, 원자적 증가) + Port/Adapter — SR-3, SR-4, SR-6
  - [x] 2.4 `ResumeShortLinkController` `GET /r/**` (common 헬퍼, 크롤러 미기록) — SR-4, SR-7
  - [x] 2.5 어드민 링크 응답에 `shortUrl` — SR-3
  - [x] 2.6 `RetentionRunner` 에 클릭 원장 365일 항목 — SR-6
  - [x] 2.7 `AtlasContextLoadSpec`: 새 컨트롤러 빈 등록 확인 + 실제 MySQL 에서 클릭 기록 후 `click_count == was + 1` · 대소문자만 바꾼 코드 해석 실패 · 백필 마이그레이션 적용 — SR-8
  - [x] 2.8 Verify: `./gradlew :code-dictionary:domain:test --tests '*ResumeShareLink*' :code-dictionary:feature:test --tests '*ResumeShortLink*' --tests '*RetentionRunner*' :atlas:app:test --tests '*AtlasContextLoadSpec'`
**Acceptance Criteria:**
- 마이그레이션 뒤 모든 기존 링크가 형식에 맞는 코드를 갖는다(제약이 보장).
- 실제 MySQL 에서 누적 수가 1 오른다.

### Task Group 3: game(content) — `/g` 해석·상세 shortUrl·클릭 원장
**Dependencies:** Task Group 1
**Phase:** backend
**Required Skills:** Kotlin, Spring MVC, JPA, Flyway
- [x] 3.0 Complete game
  - [x] 3.1 테스트 작성: `GameStatus` 전수 × 유효 코드 — 리다이렉터가 여는 집합 == `isPlayable()` 참 집합 · 302 목적지 `game.1989v.com/games/{slug}`(slug 경로 인코딩) · 실패 → game 홈 · 기록 실패에도 302 · 상세 `shortUrl` 이 리터럴 `https://1989v.com/g/` 로 시작하고 디코딩하면 그 id
  - [x] 3.2 `V105__game_short_link_click.sql`: 원장(game_id, clicked_at, referrer_host, ua_family) + 집계(game_id PK, click_count) — Game 행 컬럼 금지(`game/CLAUDE.md`)
  - [x] 3.3 UseCase·Port·Adapter(`gameTransactionManager` 한정 + REQUIRES_NEW) + `GameShortLinkController` `GET /g/**`
  - [x] 3.4 `GameDetailDto.shortUrl`(expose 설정 따름)
  - [x] 3.5 `GameRetentionRunner` 에 원장 90일 항목
  - [x] 3.6 Verify: `./gradlew :game:feature:test --tests '*GameShortLink*' --tests '*GameRetentionRunner*' --tests '*GameQueryService*'`
**Acceptance Criteria:**
- 공개 판정이 상세 API 와 같은 함수(`isPlayable()`)를 부른다(상태 목록 사본 없음).

### Task Group 4: blog(content) — `/b` 해석·상세 shortUrl·클릭 원장
**Dependencies:** Task Group 1
**Phase:** backend
**Required Skills:** Kotlin, Spring MVC, JPA, Flyway
- [x] 4.0 Complete blog
  - [x] 4.1 테스트 작성: `PostStatus` 전수 × 유효 코드 — 여는 집합 == `publiclyVisible` · 302 `blog.1989v.com/posts/{slug}` · 실패 → blog 홈 · 기록 실패에도 302 · 상세 `shortUrl` 리터럴 `/b/` + 디코딩 id
  - [x] 4.2 `V2__blog_short_link_click.sql`: 원장 + 집계
  - [x] 4.3 UseCase·Port·Adapter(`blogTransactionManager` 한정 + REQUIRES_NEW) + `BlogShortLinkController` `GET /b/**`
  - [x] 4.4 블로그 글 상세 응답 `shortUrl`
  - [x] 4.5 `BlogRetentionRunner` 에 원장 90일 항목
  - [x] 4.6 Verify: `./gradlew :blog:feature:test --tests '*BlogShortLink*' --tests '*BlogRetentionRunner*'`
**Acceptance Criteria:**
- `PUBLISHED` 외 상태는 blog 홈으로 간다.

### Task Group 5: place(content) + search — `/p` 해석·관광지 shortUrl·클릭 원장
**Dependencies:** Task Group 1
**Phase:** backend
**Required Skills:** Kotlin, Spring MVC, JPA, Flyway
- [x] 5.0 Complete place
  - [x] 5.1 테스트 작성: `status = ACTIVE` 만 열림 · 영문 행 `/en/attractions/{id}`, 국문 `/attractions/{id}` · 실패 → place 홈 · 기록 실패에도 302 · 원장 90일 초과 삭제 후 누적 수 유지 · search 상세 `shortUrl` 리터럴 `/p/` + 디코딩 id
  - [x] 5.2 `V20__attraction_short_link_click.sql`: 원장 + 집계(관광지 행 컬럼 금지 — 일괄 수집이 행을 다시 쓴다)
  - [x] 5.3 UseCase·Port·Adapter(place TM 명시 + REQUIRES_NEW) + `AttractionShortLinkController` `GET /p/**`
  - [x] 5.4 `PlaceRetentionRunner` 신설(원장 90일) — `retention-content` CronJob 이 매니페스트 변경 없이 실행하는지 기존 러너 구조로 확인
  - [x] 5.5 search:app 관광지 상세 응답 조립 시 `shortUrl` 계산(색인 문서 불변)
  - [x] 5.6 `ContentContextLoadSpec`: 새 컨트롤러 3종 빈 등록 + 실제 MySQL 에서 game·blog·place 클릭 기록 후 각 `click_count == was + 1`. TM 한정자를 지우는 회귀를 임시 사본에서 주입해 빨간불 확인
  - [x] 5.7 Verify: `./gradlew :place:feature:test --tests '*AttractionShortLink*' --tests '*PlaceRetentionRunner*' :search:app:test --tests '*AttractionSearch*' :content:app:test --tests '*ContentContextLoadSpec'`
**Acceptance Criteria:**
- content 호스트에서 game·blog 쓰기가 각자 DB 에 실제로 남는다(값으로 판정).

### Task Group 6: gateway + ingress
**Dependencies:** Task Group 2, 3, 4, 5
**Phase:** edge
**Required Skills:** Spring Cloud Gateway, Kustomize
- [x] 6.0 Complete edge
  - [x] 6.1 테스트 작성: `routeLocator` 로 `/r/**` → `ATLAS_URI`, `/p,/g,/b/**` → `CONTENT_URI`, 접두사 유지, 인증 필터 없음, 리미터 키 `ipKeyResolver`(`X-User-Id` 를 바꾼 요청도 같은 키)
  - [x] 6.2 `GatewayRouteConfig.kt` 경로 2개(`requestRateLimiter` + `ipKeyResolver`) — SR-4
  - [x] 6.3 `k8s/overlays/oci-arm/ingresses/commerce-platform.yaml` apex 호스트에 `/r` `/p` `/g` `/b` → gateway — SR-4
  - [x] 6.4 Verify: `./gradlew :gateway:test --tests '*GatewayRoute*'` && `kubectl kustomize k8s/overlays/oci-arm >/dev/null`
**Acceptance Criteria:**
- 다른 호스트의 인그레스 규칙 diff 0.

### Task Group 7: frontend — 공용 공유 패널·어드민 복사·개인정보처리방침
**Dependencies:** Task Group 2, 3, 4, 5
**Phase:** frontend
**Required Skills:** React, TypeScript, vitest
- [ ] 7.0 Complete frontend
  - [ ] 7.1 테스트 작성: 공용 `SharePanel` 이 `shortUrl` 을 복사·공유하고 없으면 현재 주소 · 기존 `browserHelp.test.ts`(현재 주소 복사) 그대로 통과 · `privacyRetention.test.ts` 에 새 러너(Place·각 원장 상수) 대조
  - [ ] 7.2 `SharePanel` 을 공용 컴포넌트로 이동, 블로그·게임·관광지 상세에 배치(`DESIGN.md` 토큰, `docs/design/k-heritage.html` 규칙) — SR-5
  - [ ] 7.3 FE API 타입에 `shortUrl?` 추가(game·blog·place)
  - [ ] 7.4 admin-fe 이력서 링크 복사 → `shortUrl`(없으면 기존 주소) — SR-3
  - [ ] 7.5 `PrivacyPage.tsx` §2 「단축 주소 클릭」 행(이력서 제외) · §6 보존기간 — SR-6
  - [ ] 7.6 Verify: `cd portal-fe && npx vitest run src/pages/__tests__/privacyRetention.test.ts src/pages/games/__tests__/browserHelp.test.ts src/components/share && npx tsc -b` · `cd admin/frontend && npx tsc -b`
**Acceptance Criteria:**
- 개인정보처리방침의 숫자와 러너 상수가 테스트로 대조된다.
- 세 상세에서 공유 패널이 보인다(CDP 측정은 Group 8).

### Task Group 8: 문서·통합 검증
**Dependencies:** Task Group 1–7
**Phase:** validate
**Required Skills:** docs, CDP
- [ ] 8.0 Complete docs & validation
  - [ ] 8.1 ADR-0077 표에 단축 링크 원장 4종(90일·이력서 365일) · ADR-0103 상태 「수용」 · `docs/changelog` 해당 없음 확인
  - [ ] 8.2 각 서비스 `CLAUDE.md`(code-dictionary·game·blog·place) 에 단축 경로 한 줄
  - [ ] 8.3 로컬 FE 화면 검증: 세 상세 공유 패널 — `docs/standards/fe-visual-verification.md` 4조합 CDP 측정(start·측정·stop 한 명령)
  - [ ] 8.4 Verify: `./gradlew :common:test :gateway:test --tests '*GatewayRoute*'` 재실행 + `scripts/lint` 없음 확인, `git diff --stat` 에 범위 밖 파일 0
**Acceptance Criteria:**
- 배포 후 실측(SR-7)은 사용자 승인 배포 뒤 별도 수행: apex 단축 4종 + list 4종 `Location`, `expose` 켠 뒤 공유 버튼 단축 주소.

## Execution Order
1. Task Group 1 (common)
2. Task Group 2, 3, 4, 5 (도메인별 — 서로 독립, 파일 겹침 없음. 단 3·4·5 는 `ContentContextLoadSpec` 을 5.6 에서 한 번에 고친다)
3. Task Group 6 (gateway·ingress)
4. Task Group 7 (frontend)
5. Task Group 8 (문서·통합 검증)
