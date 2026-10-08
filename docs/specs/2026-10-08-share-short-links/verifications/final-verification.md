# Verification Report: 2026-10-08-share-short-links
**Date:** 2026-10-09  **Status:** PASS WITH ISSUES

검증 위치: 깨끗한 워크트리 `wt-rebase` (HEAD `37b7b9099` == origin/main, 배포됨). 구현 히스토리 없이 코드·테스트·운영 응답만 봤다.

## Summary
SR-1~SR-8 의 요구가 코드와 테스트로 모두 확인됐다. 영향 모듈 11개 백엔드 스위트는 실패 0이고, 운영 apex 단축 주소 4종과 list 4종도 302 와 `no-store`·`noindex` 를 실제로 돌려준다.
기능을 막는 결함은 없다. 다만 Task 8.3(CDP 화면 측정)이 미완이고, `common` 에 크롤러 분류기가 두 벌 생겼으며(SR-6 「분류기 하나」 위반), 이력서 코드 유일 충돌 재시도가 스펙과 조금 다르다.

## Tasks
- [x] Group 1 — common (evidence: `common/.../shortlink/ShortCode.kt:26-29` 상수 = key-decisions 값 · `ShortCodeTest.kt:17-21` 골든 0→5mZiq85, 1→HGWKKUQ, 62→CQy78OF, 2^40−1→FOBkmEh · `ShortLinkProperties.kt:13-21` · `ShortLinks.kt:11` 요청 객체를 받지 않음 · `ShortLinkRedirects.kt:13-20` · `ShortLinkPath.kt` · `crawler/CrawlerUserAgents.kt` · `META-INF/spring/...AutoConfiguration.imports:12` · `common/docs/service.md:45-52` · `.github/workflows/images.yml:282`)
  - 1.7 회귀 주입은 status.md 의 구현자 보고만 있다(재현하지 않음).
- [x] Group 2 — resume(atlas) (evidence: `V31__resume_short_code.sql:12-39` ascii_bin·RANDOM_BYTES·NOT NULL·UNIQUE·CHECK(REGEXP_LIKE …,'c') · `:44-57` 원장·집계 테이블 · `ResumeShareLink.kt:45,69` 형식 검사 · `ResumeAdminService.kt:34,88,125-139` SecureRandom 생성 · `ResumeShortLinkService.kt:40` isUsable · `:49` `transactionManager="transactionManager"`+REQUIRES_NEW · `ResumeJpaRepositories.kt:42-43` ON DUPLICATE KEY UPDATE · `ResumeShortLinkController.kt:32,40,44,56` · `RetentionRunner.kt:47,84` 365일 · `AtlasContextLoadSpec.kt:131,175-217`)
- [x] Group 3 — game (evidence: `V106__game_short_link_click.sql` · `GameShortLinkService.kt:37,47,52` isPlayable·리터럴 `gameTransactionManager`·REQUIRES_NEW · `GameShortLinkController.kt:29,42,50` · `GameQueryService.kt:80` shortUrl · `GameDtos.kt:114` · `GameRetentionRunner.kt:40,73` 90일)
- [x] Group 4 — blog (evidence: `V4__blog_short_link_click.sql` · `BlogShortLinkService.kt:37,46,51` publiclyVisible·리터럴 `blogTransactionManager` · `BlogShortLinkController.kt` · `BlogQueryService.kt:100` · `BlogPostDtos.kt:52` · `BlogRetentionRunner.kt:36,57` 90일)
- [x] Group 5 — place + search (evidence: `V33__attraction_short_link_click.sql` · `AttractionVisibility.kt` `isActive()` · `AttractionShortLinkService.kt:48-54` 영문 `/en/attractions/{id}` · `:38,58` `placeTransactionManager` · `PlaceRetentionRunner.kt:25,32` `@Profile("retention")` · `AttractionShortUrlService.kt:14-17` · `AttractionSearchController.kt:111` · `AttractionDetailResponse.kt:14` · `ContentContextLoadSpec.kt:113-115,167-232`)
- [x] Group 6 — gateway + ingress (evidence: `GatewayRouteConfig.kt:19` `@Qualifier("ipKeyResolver")` · `:41-44` · `:715-723` 두 라우트, `stripPrefix(0)`, 인증 필터 없음 · `commerce-platform.yaml:85-98` apex 에만 /r /p /g /b — 커밋 7b56de985 의 k8s diff 는 apex 블록 추가 14줄뿐)
- [x] Group 7 — frontend (evidence: `portal-fe/src/components/share/SharePanel.tsx:27,30` · `GameDetailPage.tsx:391` · `ReactionBar.tsx:64` · `AttractionPage.tsx:398` · `gameApi.ts:155`·`blogApi.ts:96`·`placeApi.ts:439` · `admin/frontend/src/api/resume.ts:32,109` · `ResumePage.tsx:283` · `PrivacyPage.tsx:105-108,296-297` · `privacyRetention.test.ts:19-24,92-101`)
  - 7.1 문구 「없으면 현재 주소」는 구현(대신 주소 = canonical, 아무것도 없으면 현재 주소)과 다르다. key-decisions 에 기록된 의도된 변경이다.
- [ ] Group 8 — 문서·통합 검증: 8.0 미완(tasks.md 그대로)
  - [x] 8.1 `ADR-0077-ledger-retention.md:21-22,49-50,121` · `ADR-0106-share-short-links.md:3` 「수용」
  - [x] 8.2 단축 경로 언급 확인: `code-dictionary/CLAUDE.md`·`game/CLAUDE.md`·`blog/CLAUDE.md`·`place/CLAUDE.md`
  - [ ] 8.3 UNVERIFIED: CDP 4조합 화면 측정 기록이 없다(tasks.md 미체크, status.md 「미실행」).
  - [x] 8.4 status.md 그룹 8 행

### tasks.md / 문서 번호 드리프트
- tasks.md 는 재번호 결과(V31·V106·V4·V33·ADR-0106)로 맞게 고쳐져 있다.
- `verifications/status.md:9` 「V22 백필 500행」은 재번호 전 이름이다(현재 `V31__resume_short_code.sql`).
- `verifications/status.md` 그룹 3·4 행의 「GameSchemaIntegrationSpec V105 적용, BlogSchemaIntegrationSpec V2 적용」도 재번호 전 기록이다(현재 V106·V4).
- `context/progress.md:15` 는 V22→V31, V105→V106, V2→V4, V20→V33, ADR-0103→0106 대응표를 정확히 적고 있다.
- 커밋 메시지 5bd79aa57·7718741de 는 「ADR-0103」을 쓴다. 지금 ADR-0103 은 다른 문서(`ADR-0103-place-attraction-server-render-enrichment.md`)다. 코드·문서 본문에 남은 단축 링크용 0103 참조는 0건이다(grep).

## SR 점검

| SR | 판정 | 근거 |
|---|---|---|
| SR-1 origin 은 설정에서만 | PASS | `ShortLinks` 생성자가 `ShortLinkProperties` 만 받는다. `ShortLinkPrefix`·`shortlink` 패키지·컨트롤러 4종에 `Host`/`X-Forwarded-Host`/`serverName` 읽기 0건. `GameShortLinkControllerTest.kt:90-91` 이 `serverName=evil.example` + `X-Forwarded-Host` 로 보낸 요청에서 Location 을 확인. 운영: `X-Forwarded-Host: evil.example` → `location: https://game.1989v.com/` |
| SR-1 서브도메인 미개방 | PASS | 운영 `https://game.1989v.com/g/CQy78OF` → `HTTP/2 200`(SPA, 302 아님). ingress 규칙은 `host: 1989v.com` 블록에만 |
| SR-2 ShortCode 골든·거절 | PASS | 상수와 골든 벡터가 key-decisions 와 같다. 거절 표(`ShortCodeTest.kt:69-82`)에 5·8자, 빈 값, base62 밖, 한글, `list`, `zzzzzzz`, 비정규 `0QtPv4F` |
| SR-3 이력서 코드 | PASS (작은 차이 1) | ascii_bin + CHECK `'c'` + UNIQUE + NOT NULL, RANDOM_BYTES 백필. 실제 MySQL 에서 「대소문자만 바꾼 코드는 해석 실패」 통과. 차이: 스펙은 「유일 제약에 걸리면 새로 뽑아 재시도」, 구현은 저장 전 `existsByShortCode` 로 확인 후 재시도하고 저장 시점 경합은 유일 제약 예외로 실패한다(`ResumeAdminService.kt:123-139` 주석에 명시) |
| SR-4 공개 판정 = 도메인 함수 | PASS | `game.isPlayable()`, `post.status.publiclyVisible`, `link.isUsable()`, `attraction.isActive()`. 상태 전수 테스트 `GameShortLinkControllerTest.kt:76-80`, `BlogShortLinkControllerTest.kt:71-75` |
| SR-4 경로 엣지·쿼리 | PASS | 운영: `/g/CQy78OF?utm=1` → 쿼리 없는 목적지, `/g/CQy78OF/x` → `https://game.1989v.com/`, `/g/zzzzzzz` → 홈 |
| SR-4 게이트웨이 | PASS | `@Qualifier("ipKeyResolver")`. `ShortLinkRouteSpec` 5/5(「두 요청 모두 ipKeyResolver 를 거친다」, 「X-User-Id 가 달라도 같은 키」) |
| SR-4 인그레스 | PASS | apex `/r /p /g /b` Prefix → gateway. 운영 `https://1989v.com/privacy` → 200(가로채지 않음) |
| SR-5 상세 shortUrl | PASS | 운영 GET: game `https://1989v.com/g/CQy78OF`, blog `https://1989v.com/b/3uzCNUl`, place(search) `https://1989v.com/p/CQy78OF` |
| SR-5 expose 플래그 | PASS | `k8s/overlays/oci-arm/patches/short-link-expose.yaml` `KGD_COMMON_SHORTLINK_EXPOSE=true`, `kustomization.yaml:72-73` 대상 `^(atlas|content|search)$`. `kubectl kustomize k8s/overlays/oci-arm` exit 0, 렌더 결과에서 env 가 atlas·content·search 세 Deployment 에만 들어감 |
| SR-5 copyGameLink 불변 | PASS | 기능 커밋 10개(3ef0db65d…6f3551628) 어느 것도 `browserHelp.ts`·`GameBrowserHelp.tsx` 를 건드리지 않는다. `browserHelp.test.ts` 4/4 통과 |
| SR-6 크롤러 미기록 | PASS | 컨트롤러 4종 모두 `RESOLVED && !CrawlerUserAgents.isCrawler(ua)` 일 때만 기록. 카카오 스크랩 UA 테스트(game·place·resume), blog 「크롤러·미리보기 봇이 열면」 |
| SR-6 분류기 하나 | **ISSUE** | `common` 에 `com.kgd.common.web.CrawlerUserAgents`(2026-09-20 15cfb4303, analytics·game·ads 사용)가 이미 있었는데, `com.kgd.common.crawler.CrawlerUserAgents` 를 새로 만들었다. 마커 목록이 한 줄씩 복사됐고 미리보기 봇 5개만 다르다. `common/docs/service.md:31,52` 에 두 행이 같이 있다. 스펙이 출발점으로 지목한 analytics `CrawlerUserAgents.kt` 는 이미 없다(스펙 전제가 낡았음). 한쪽만 갱신되는 드리프트 위험 |
| SR-6 REQUIRES_NEW + 리터럴 TM | PASS | game·blog 는 `"gameTransactionManager"`·`"blogTransactionManager"` 리터럴(bf0f1c426), place 는 `const PLACE_TM`, resume 은 `"transactionManager"`. 실제 MySQL 에서 game·blog·place·resume 모두 `click_count == was + 1` |
| SR-6 별도 집계 테이블 | PASS | `*_short_link_stat` 4종. 대상 행 컬럼 추가 없음 |
| SR-6 이력서 원장에 리퍼러·UA 없음 | PASS | 테이블이 `share_link_id, clicked_at` 뿐. `ResumeShortLinkServiceTest` 「링크 id 와 시각만 포트로 넘긴다」 |
| SR-6 보존 러너 + privacyRetention | PASS | 90/90/90/365. `privacyRetention.test.ts` 10/10 |
| SR-7 /r 로그 | PASS | debug·warn 모두 `linkId` 만. `ResumeShortLinkControllerTest` 「링크 id 만 남기고 코드·토큰·목적지는 남기지 않는다」 |
| SR-8 컨텍스트 로드 목록 | PASS | `AtlasContextLoadSpec.kt:131`, `ContentContextLoadSpec.kt:113-115` |
| SR-8 :common:test 배포 게이트 | PASS | `images.yml:282`. CI run 37778957026 로그: `── Gradle test tasks: … :common:test`, `> Task :common:test`, `BUILD SUCCESSFUL in 4m 10s` |

## Test Suite
```
$ ./gradlew :common:test :gateway:test :code-dictionary:domain:test :code-dictionary:feature:test :game:feature:test :blog:feature:test :place:domain:test :place:feature:test :search:app:test :atlas:app:test :content:app:test verifyArchitecture --continue
BUILD SUCCESSFUL in 2m 59s
98 actionable tasks: 35 executed, 63 up-to-date
```
`:common:test` 가 UP-TO-DATE 로 건너뛰어져 따로 강제 실행했다.
```
$ ./gradlew :common:test --rerun
> Task :common:test
BUILD SUCCESSFUL in 9s
```
JUnit XML 집계(모두 이번 실행 시각 04:28~04:29 산출물):

| 모듈 | suites | tests | failures | errors | skipped |
|---|---|---|---|---|---|
| common | 23 | 169 | 0 | 0 | 0 |
| gateway | 9 | 129 | 0 | 0 | 0 |
| code-dictionary:domain | 10 | 61 | 0 | 0 | 0 |
| code-dictionary:feature | 25 | 104 | 0 | 0 | 0 |
| game:feature | 30 | 300 | 0 | 0 | 0 |
| blog:feature | 8 | 47 | 0 | 0 | 0 |
| place:domain | 15 | 96 | 0 | 0 | 0 |
| place:feature | 28 | 140 | 0 | 0 | 0 |
| search:app | 34 | 391 | 0 | 0 | 0 |
| atlas:app | 1 | 10 | 0 | 0 | 0 |
| content:app | 1 | 12 | 0 | 0 | 0 |
| **합계** | 184 | 1459 | 0 | 0 | 0 |

`AtlasContextLoadSpec`·`ContentContextLoadSpec` 은 실제 MySQL(Testcontainers)로 돌았고 skipped 0 이다.

```
$ cd portal-fe && npx vitest run
 Test Files  5 failed | 86 passed (91)
      Tests  17 failed | 769 passed (786)
```
기능 관련 파일은 모두 통과: `SharePanel.test.tsx (5 tests)` · `privacyRetention.test.ts (10 tests)` · `browserHelp.test.ts (4 tests)` · `AttractionPage.test.tsx (53 tests)`.

```
$ cd admin/frontend && npx tsc -b
ADMIN TSC EXIT 0
```

```
$ kubectl kustomize k8s/overlays/oci-arm   (로컬 렌더만, 클러스터 접속 없음)
EXIT 0
```

## Failed Tests
백엔드: 없음.

portal-fe 실패 17건(5파일)은 모두 이 기능과 무관한 환경 원인이다.
- 15건(`tests/games/relayClient.test.ts`·`marbleDeterminism.test.ts`·`rosterHandoff.test.ts`): `ENOENT … portal-fe/public/games/lib/relay.js`, `marble-race/js/*.js`, `card-flip/js/main.js`. `portal-fe/public/games` 는 서브모듈이고 이 워크트리에서는 초기화돼 있지 않다(`git submodule status` → `-bf2c52436…`, 디렉터리 비어 있음). 메인 트리에는 해당 파일이 있다.
- 2파일(`src/__tests__/routes.test.tsx`, `src/pages/tech/__tests__/SearchArchitecturePage.test.tsx`): `Failed to resolve import "…/generated/search-architecture.json"`. `portal-fe/.gitignore:15` 가 무시하는 생성물이다.
- 기능 커밋은 이 파일들을 하나도 건드리지 않았다.

## AC Coverage
| AC / 시나리오 | 테스트 |
|---|---|
| 골든 벡터가 순열 변경에 실패 | `ShortCodeTest` 「고정 입출력 벡터」(주입 결과는 status.md 구현자 보고) |
| Location 호스트가 요청 헤더로 안 바뀜 | `ShortLinksTest:62` + 컨트롤러 4종 「요청 쿼리·호스트는 쓰지 않는다」 |
| 마이그레이션 후 모든 링크가 형식에 맞는 코드 | `AtlasContextLoadSpec` 「단축 코드 마이그레이션이 적용돼…」 + DB 제약 |
| 실제 MySQL 누적 +1 (resume) | `AtlasContextLoadSpec` 「클릭을 적재하면 누적 수가 정확히 1 오른다」 |
| 공개 판정 = isPlayable | `GameShortLinkControllerTest:76-80` |
| PUBLISHED 외 → blog 홈 | `BlogShortLinkControllerTest:71-75` |
| content 에서 game·blog 쓰기가 각 DB 에 남음 | `ContentContextLoadSpec` game·blog·place 「누적 수를 1 올린다」 |
| 원장 정리 후 누적 유지 | `ContentContextLoadSpec` 「90일 넘은 행만 지우고 누적 수는 남긴다」, `PlaceRetentionRunnerSpec` |
| 영문 관광지 목적지 | `AttractionShortLinkControllerTest` 「영문 상세 /en/attractions/{id}」 |
| 상세 shortUrl 리터럴 + 디코딩 id | `GameQueryServiceTest`, `BlogShortLinkDetailTest`, `AttractionSearchControllerShortUrlTest` |
| expose 꺼짐 → null | 같은 세 테스트 + `ResumeAdminServiceTest` |
| 게이트웨이 라우트·리미터 키 | `ShortLinkRouteSpec` 5건 |
| 다른 호스트 인그레스 diff 0 | 커밋 7b56de985 diff 확인(테스트 아님) |
| 방침 숫자 = 러너 상수 | `privacyRetention.test.ts` |
| 공유 패널이 shortUrl 사용·대신 주소 | `SharePanel.test.tsx` 5건 |
| 세 상세에서 공유 패널이 보인다(CDP) | **없음** — Task 8.3 미실행 |
| 운영 apex 4종 + list 4종 | 아래 운영 확인 |

## 운영 확인 (GET 만, 크롤러 UA 로 보내 클릭 원장에 쓰지 않음)
UA `Mozilla/5.0 (compatible; Googlebot/2.1; …)`:
```
/g/CQy78OF   302  location: https://game.1989v.com/games/aero-vendetta
/b/3uzCNUl   302  location: https://blog.1989v.com/posts/claude-code-session-timestamp-and-usage
/p/CQy78OF   302  location: https://place.1989v.com/attractions/62
/r/AAAAAAAAAA 302 location: https://resume.1989v.com/   (없는 코드 → 홈)
/r/list 302 https://resume.1989v.com/ · /p/list 302 https://place.1989v.com/ · /g/list 302 https://game.1989v.com/ · /b/list 302 https://blog.1989v.com/
모든 응답: cache-control: no-store · x-robots-tag: noindex, nofollow
```
유효한 이력서 코드로 `/r` 성공 경로를 열지는 않았다(코드를 모르고, 알아도 열람 기록이 남는다).

## Follow-ups
1. **크롤러 분류기 두 벌 통합** — `common.web.CrawlerUserAgents` 와 `common.crawler.CrawlerUserAgents` 를 하나로 합친다. 미리보기 봇을 기존 분류기에 넣으면 analytics 노출 원장 판정도 바뀌므로 영향 검토가 필요하다. blog `BlogViewService`·deal 판정도 통합 후보다.
2. **Task 8.3 CDP 화면 측정** — 세 상세의 공유 패널, 4조합. 운영에서 expose 가 켜져 있으므로 운영 화면으로 잴 수 있다.
3. 이력서 코드 저장 시점 유일 충돌 재시도(스펙 SR-3 문구와 구현 차이) — 스펙을 구현에 맞추거나 저장 실패 시 재시도를 넣을지 결정한다. 실제 충돌 확률은 무시할 수준이다.
4. `verifications/status.md` 의 재번호 전 이름(V22, V105, V2)을 현재 번호로 고치거나 「재번호 전」이라고 표시한다.
5. `docs/product/roadmap.md` 가 없어 로드맵 완료 표시 후보는 없다.
6. key-decisions 의 후속 후보: 단축 경로 리미터 키를 `CF-Connecting-IP` + Host 허용 목록으로 바꾸는 것(현재 공용 버킷일 수 있음, SR-8 감수 한계).
