# Specification: 공유용 단축 링크

## Goal

이력서·관광지·게임·블로그 글이 생기는 순간부터 `1989v.com/{r|p|g|b}/{code}` 라는 짧은 고정 주소를 갖게 한다.
공유 버튼은 그 주소를 보여 준다. 원래 주소는 길고, 이력서 제출처 링크는 32자 토큰을 포함한다.

## User Stories

- 운영자로서 이력서 제출처 링크를 짧은 주소로 복사하고 싶다. 지원서 입력란과 메신저에서 잘리지 않게 하려고.
- 방문자로서 글·게임·관광지 상세의 공유 버튼을 누르면 짧은 주소를 받고 싶다.
- 짧은 주소를 받은 사람으로서 열면 원래 페이지로 가고 싶다. 대상이 사라졌으면 그 서비스 목록으로 가고 싶다.
- 운영자로서 단축 주소로 몇 번 들어왔는지 알고 싶다.

## Specific Requirements

### SR-1 주소 체계

- 단축 주소의 호스트는 `1989v.com` 하나다. 서브도메인에는 단축 경로를 열지 않는다.
- 접두사와 대상: `r` 이력서 제출처 링크, `p` 관광지, `g` 게임, `b` 블로그 글.
- `/{접두사}/list` 는 해당 서비스 홈으로 가는 고정 별칭이다(resume·place·game·blog 서브도메인 루트).
- 목적지: `resume.1989v.com/?k={token}`, `place.1989v.com/attractions/{id}`(영문 행은 `/en/attractions/{id}`),
  `game.1989v.com/games/{slug}`, `blog.1989v.com/posts/{slug}`. slug 는 경로 세그먼트로 인코딩한다.
- 단축 주소의 origin(`https://1989v.com`)과 서비스 origin 은 **설정값에서만** 얻는다. 요청의 `Host`·`X-Forwarded-Host` 는 쓰지 않는다.
- 302 응답 조립(헤더 포함)과 단축 주소 조립은 `common` 의 헬퍼 한 곳에서 한다. 도메인은 접두사와 목적지만 넘긴다.
- 설정 키는 `kgd.common.short-link.*` 하나의 묶음이다(단축 origin 과 서비스 origin 넷). atlas·content·search 가 같은 키를 읽는다.
  `common` 에 컴포넌트를 더하므로 `common/CLAUDE.md` 의 규칙대로 `common/docs/service.md` Provided Components 표를 갱신한다.

### SR-2 공개 콘텐츠 코드 `ShortCode` — 대상 id 에서 결정된다

- 관광지·게임·글의 코드는 대상의 숫자 id 에 고정 순열을 적용한 뒤 base62 로 쓴 값이다.
  길이는 6~7자이고 id 범위는 0 ~ 2^40−1 이다. 범위를 넘는 id 는 인코딩을 거부한다.
- 매핑 테이블과 생성 절차는 없다. 같은 대상은 언제나 같은 코드를 갖고, 슬러그가 바뀌어도 코드는 그대로다.
- 순열은 연속한 id 가 연속한 코드로 보이지 않게 하려는 것이고, 비밀값이 아니다. 공개 여부는 SR-4 가 지킨다.
- **순열 상수는 바꾸지 않는다.** 바꾸면 이미 퍼진 주소가 전부 깨진다. 고정 입출력 벡터 테스트가 이를 지킨다.
- 인코더·디코더는 `common` 의 순수 Kotlin 코드 한 벌이고, 세 도메인과 상세 응답이 같은 것을 쓴다.
- 디코더가 해석 실패로 돌려주는 입력: 길이가 6~7자가 아닌 것, base62 밖의 글자, 디코드 값이 2^40 이상인 것,
  다시 인코딩하면 입력과 달라지는 비정규 표기. 예외는 던지지 않는다.

### SR-3 이력서 코드 — 무작위로 정하고 저장한다

- 제출처 링크(`resume_share_link`)마다 10자 무작위 base62 코드를 둔다(약 59비트). 생성기는 `SecureRandom` 이다.
- 링크를 만들 때 자동으로 부여한다. 유일 제약에 걸리면 새로 뽑아 다시 시도한다.
  형식 검사(10자 base62)는 기존 토큰처럼 `ResumeShareLink` 생성·복원 시점에 한다.
- 기존 행은 Flyway SQL 마이그레이션이 MySQL `RANDOM_BYTES()` 로 채운다. `RAND()`·`UUID()` 는 쓰지 않는다.
  같은 마이그레이션에서 채운 뒤 `NOT NULL`·`UNIQUE` 와 형식 `CHECK`(10자 base62, 대소문자 구분)를 건다. 테이블 기본 콜레이션이 `utf8mb4_unicode_ci` 라서 코드 컬럼은 `ascii_bin` 으로 명시한다. 그렇지 않으면 유일 제약과 조회가 대소문자를 무시해 실효 엔트로피가 약 52비트로 줄어든다. 백필 결과가 형식을 어기면 마이그레이션이 실패한다.
- 롤백 주의: 이 마이그레이션 이후 옛 이미지로 되돌리면 옛 코드가 코드 값 없이 INSERT 해 링크 생성이 실패한다. 링크 생성 외 기능은 영향이 없다.
- 코드는 바꾸지 않는다. 폐기(`revoke`)한 링크의 코드는 해석에 실패한다.
- 어드민 링크 목록 응답은 `shortUrl` 을 포함하고, 복사 버튼은 단축 주소를 복사한다.

### SR-4 해석 — 대상을 가진 도메인이 302 로 응답한다

- `/r/**` 는 atlas 의 resume 이 처리한다. `/p/**` `/g/**` `/b/**` 는 content 의 place·game·blog 가 각자 처리한다.
  다른 도메인을 호출하지 않는다.
- 성공 응답은 302 이고 `Location` 은 SR-1 의 목적지다. 헤더는 `Cache-Control: no-store` 와 `X-Robots-Tag: noindex, nofollow` 다.
- 공개 판정은 도메인의 기존 함수를 부른다. 상태 목록을 다시 적지 않는다.
  게임은 `Game.isPlayable()`(공개 상세와 같다), 글은 `PostStatus.publiclyVisible`, 이력서는 `ResumeShareLink.isUsable()`,
  관광지는 `status = ACTIVE` 다(기존 상세가 읽는 search 색인이 ACTIVE 행만 싣는다).
- 비밀 게임(ADR-0089)은 카탈로그 행이 없어 코드 자체가 없다.
- 해석 실패(형식 오류·대상 없음·공개 아님·폐기)는 모두 그 서비스의 `/{접두사}/list` 목적지로 302 한다.
  실패 종류는 응답에서 구분되지 않는다.
- 경로 처리: 쿼리스트링은 무시하고 목적지에 넘기지 않는다. 코드 없는 `/{접두사}` 와 `/{접두사}/` 는 list 와 같이 처리한다.
  `/{접두사}/{code}/…` 처럼 세그먼트가 더 붙으면 해석 실패로 처리한다.
- 게이트웨이에 `/r/**` → atlas 경로와 `/p/**` `/g/**` `/b/**` → content 경로를 둔다. 둘 다 접두사를 떼지 않고 인증 필터를 걸지 않는다.
  클릭 기록이 익명 쓰기라서 `requestRateLimiter` 를 건다. 키는 `ipKeyResolver` 다 — `userKeyResolver` 는 `X-User-Id` 를 먼저 보는데, 단축 경로에는 그 헤더를 지우는 인증 필터가 없어 헤더만 바꿔 우회할 수 있다.
- 인그레스는 `1989v.com` 호스트에서 `/r` `/p` `/g` `/b` 를 gateway 로 보낸다. 다른 호스트 규칙은 바꾸지 않는다.

### SR-5 상세 응답과 공유 버튼

- 상세 응답에 `shortUrl`(절대 주소)을 더한다. 게임은 game 상세 API, 글은 blog 상세 API 에 더한다.
  관광지는 FE 가 부르는 search:app 상세(`/api/search/attractions/{id}`) 응답을 조립할 때 계산한다. 색인 문서는 바꾸지 않는다.
  search 문서 id 와 place 관광지 id 가 같다는 전제를 쓴다.
- FE 는 코드를 계산하지 않는다.
- 블로그 `SharePanel` 을 공용 컴포넌트로 옮기고 블로그·게임·관광지 상세가 같이 쓴다.
  복사·`navigator.share`·외부 공유 링크가 모두 `shortUrl` 을 쓰고, 값이 없으면 그 대상의 canonical 주소로 대신한다(게임 화면 주소에는 방 초대 `?room=…#join` 이 섞일 수 있다).
- 게임의 「현재 링크 복사」(`copyGameLink`, 카카오 인앱 안내)는 바꾸지 않는다. 방 코드가 든 초대 주소를 그대로 복사해야 한다(`online-versus-lobby.md` §4).
- 공유 패널은 `DESIGN.md` 토큰만 쓰고 브랜드 면 규칙(`docs/design/k-heritage.html`)을 따른다.

### SR-6 클릭 계측과 보존

- 해석에 성공한 요청만 기록한다. 크롤러 UA 는 기록하지 않는다(deal 은 봇도 기록하지만 여기는 다르다).
  크롤러 판정은 `common` 의 분류기 하나로 한다. 목록은 analytics `CrawlerUserAgents.kt` 를 출발점으로 하고, 카카오톡 스크랩·`facebookexternalhit`·Slack·Discord 미리보기를 더한다. 실제 UA 문자열 표로 테스트한다.
  기존 두 판정(analytics `CrawlerUserAgents`, blog `BlogViewService`)은 이번에 바꾸지 않고, 통합 후보로 별도 보고한다.
- **공개 콘텐츠(p·g·b)**: 도메인 DB 마다 클릭 원장 하나를 둔다. 필드는 대상 id, 시각, 리퍼러 호스트, UA 계열이다(`deal_offer_click` 과 같다). IP 는 저장하지 않는다. 보존 90일.
- **이력서(r)**: 원장 필드는 링크 id 와 시각뿐이다. 리퍼러·UA 는 모으지 않는다(ADR-0064 수집 범위). 보존은 `resume_access_log` 와 같은 365일이다(ADR-0077).
  이 원장은 「단축 주소로 들어온 횟수」를 센다. 어드민의 기존 `visitCount` 는 「페이지 열람」을 세며, 둘은 다른 숫자다.
- 대상별 누적 클릭 수는 도메인마다 **별도 집계 테이블**에 두고 원자적으로 증가시킨다(`INSERT … ON DUPLICATE KEY UPDATE`).
  대상 행에 컬럼을 두지 않는다. 게임 행 실시간 카운터 금지 규칙(`game/CLAUDE.md`)과 관광지 일괄 수집의 행 덮어쓰기 때문이다.
- 기록은 도메인 트랜잭션 관리자 한정자와 `REQUIRES_NEW` 로 한다. content 호스트의 기본 datasource 는 place 라서, 한정자가 없으면 game·blog 쓰기가 조용히 사라진다.
  기록이 실패해도 302 는 나간다.
- 원장 정리는 각 도메인 모듈의 보존 러너가 한다. place 는 러너를 새로 만들고, 나머지는 기존 러너에 항목을 더한다. CronJob 매니페스트는 바꾸지 않는다.
- ADR-0077 표, `/privacy` §2 수집 항목(「단축 주소 클릭」 행, 이력서 제외)과 §6 보존기간을 같은 숫자로 갱신한다.
- 스키마 변경은 각 도메인 Flyway 디렉터리에 새 버전으로 추가한다. 이미 커밋된 마이그레이션은 고치지 않는다.

### SR-7 관측

- 해석 결과(성공·형식 오류·대상 없음·공개 아님·폐기)를 debug 로그 한 줄로 남긴다. 람다 형식(`docs/conventions/logging.md`)이다.
- `/r` 은 로그(기록 실패 경고 포함)에 코드·토큰·`Location` 을 남기지 않고 링크 id 만 남긴다.
- 운영 확인: apex 단축 주소 4종과 `list` 4종에 실제로 요청해 `Location` 을 본다.

### SR-8 배선과 배포

- 새 컨트롤러를 `ContentContextLoadSpec`·`AtlasContextLoadSpec` 의 빈 목록에 추가한다. 빠지면 배포 후 조용히 404 가 난다.
- 새 보존 러너를 `privacyRetention.test.ts` 의 `RETENTION_RUNNERS` 에 추가한다.
- `:common:test` 를 배포 게이트에 넣는다. `scripts/ci/topology.sh` 는 `generateTopology` 가 만드는 생성물이라 손으로 고치지 않고, `.github/workflows/images.yml` 테스트 단계에 `:common:test` 를 더한다(손으로 고친 생성물은 `verifyTopologyGenerated` 가 막는다). CI 로그로 실행을 확인한다.
- 배포 순서: 해석 경로(SR-4)를 배포해 실측한 뒤에 `shortUrl` 노출(SR-5)을 켠다. 그 전에 공유된 주소가 깨지는 일을 막는다.
- 감수하는 한계: 해석 파드가 내려가 있으면 게이트웨이가 200 과 빈 응답을 낸다(`gateway/CLAUDE.md`). 플랫폼 공통 동작이라 이번에는 대응하지 않는다.
  게이트웨이에 forwarded-header 설정이 없어 `ipKeyResolver` 의 키가 인그레스 주소일 수 있다. 그러면 리미터는 사실상 전체 공용 버킷이다. 게이트웨이 공통 문제라 이번에는 고치지 않는다.
  레이트 리미터에 걸린 요청은 목록 302 가 아니라 429 를 받는다. 키가 공용 버킷이면 한 클라이언트가 한도(초당 100, 순간 200)를 넘길 때 모든 방문자의 단축 주소 4종이 함께 429 를 받는다. 지금 유입 규모에서는 감수한다.

## Existing Code to Leverage

| 무엇 | 경로 |
|---|---|
| 302 리다이렉터 모양 · 조용한 클릭 기록 | `deal/feature/.../presentation/controller/DealRedirectController.kt` |
| 클릭 원장 스키마 | `deal/feature/src/main/resources/dealdb/migration/V1__deal.sql` (`deal_offer_click`) |
| 게이트웨이가 비 `/api` 경로를 받는 선례 · 익명 쓰기 리미터 | `gateway/src/main/kotlin/com/kgd/gateway/config/GatewayRouteConfig.kt` |
| 이력서 토큰 생성 · 링크 엔티티 | `ResumeAdminService.kt`, `ResumeShareLink.kt` (`isUsable()`) |
| 어드민 링크 복사 | `admin/frontend/src/pages/ResumePage.tsx:281`, `admin/frontend/src/api/resume.ts:99` |
| 공개 판정 | `Game.isPlayable()`(`Game.kt:153`), `PostStatus.publiclyVisible`(`BlogEnums.kt:47`) |
| 관광지 상세 응답 | `search/.../AttractionSearchController.kt`, FE `portal-fe/src/api/placeApi.ts:179` |
| 공유 패널 | `portal-fe/src/pages/blog/SharePanel.tsx` |
| 서비스 홈 주소 | `portal-fe/src/shell/serviceHref.ts` (`SUBDOMAIN_ORIGIN`) |
| apex 인그레스 | `k8s/overlays/oci-arm/ingresses/commerce-platform.yaml` |
| 보존 러너 | `BlogRetentionRunner.kt`, `privacyRetention.test.ts`, `docs/adr/ADR-0077-ledger-retention.md` |

## Out of Scope

- 임의 외부 URL 단축과 커스텀 별칭.
- 서브도메인 단축 경로, deal·rank 단축 주소.
- 만료·사용 횟수 제한. 이력서 링크는 폐기로만 끈다(ADR-0064).
- 단축 주소 전용 OG 카드. 미리보기 크롤러는 302 를 따라가 목적지의 meta 를 읽는다.
- 클릭 수를 보여 주는 어드민 화면. 이번에는 저장만 하고, 조회는 DB 로 한다.
- 게이트웨이 빈 200 응답 개선(SR-8).

## Open Questions

없음. 결정 4건은 `context/open-questions.yml`, 리뷰 반영 근거는 `context/review-verdict.md` 에 있다.
