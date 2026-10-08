# Engineer Review — architecture (1라운드)

대상: `spec.md` · `docs/adr/ADR-0107-wishlist-collection-share-links.md`
기준: `docs/conventions/package-structure.md`(ADR-0083), ADR-0106, ADR-0077, 현행 코드

## 체크리스트 판정

| 항목 | 판정 | 근거 |
|---|---|---|
| 레이어 책임 분리 | 미흡 → A1 | 새 포트·유스케이스·설정 위치가 스펙에 없음 |
| 상향 의존 금지 | 통과(조건부) | A1 반영 시 |
| 외부 연동은 포트로 | 해당 없음 | 외부 호출 없음 |
| 모듈 경계 변경의 근거 | 미흡 → A3·A4 | wishlist 원장 정리 호스트 없음, `ShortLinkPrefix` 확장 배선 누락 |
| 패턴 일관성 | 미흡 → A4 | ADR-0106 해석 실패 동작과 어긋남 |
| 순환 의존 | 통과 | wishlist → common 단방향 |
| 트랜잭션 경계 소유 | 미흡 → A2 | 묶음 삭제·탈퇴 시 링크 폐기 경로 없음 |
| 인터페이스 표면 최소 | 통과 | 소유자 3 + 공개 1 API |
| 얕은 통과 모듈 | 통과 | `/c` 해석은 설정 꺼짐·폐기 판정을 가져 삭제 테스트를 통과 |
| 정보 은닉 | 미흡 → A5 | 공개 경로의 헤더 신뢰 범위 |
| Seam 현실성 | 통과 | 포트는 기존 Outbound Port 규칙(ADR-0083)에 따른 경계 |
| 계측 계약 | 경미 → A6 | 묶음 공유 이벤트의 entityType 미정 |

## 이슈

### A1 — 새 코드의 레이어 위치가 정해지지 않았다 (REVISE)
- 스펙 SR-2.2·SR-2.4 는 API·설정만 적고 레이어 배치가 없다.
- 표준 위반이 생기기 쉬운 지점: 포트는 `application/{묶음}/port`(`package-structure.md:58`), 컨트롤러는 UseCase 인터페이스만 주입(`:69-72`), 서비스가 읽는 `@ConfigurationProperties` 는 `application/{entity}/config`(`:93-95`). 스펙상 설정 꺼짐 판정은 "공유 서비스" Kotest 대상(SR-4.2)이므로 application 이 읽는다.
- 수정안: SR-2 에 한 줄 추가 — `application/share/{port/CollectionSharePort, usecase/ManageCollectionShareUseCase·GetSharedCollectionUseCase, config/WishlistShareProperties}`, 어댑터·JPA 엔티티는 `infrastructure/persistence`. 토큰 생성·만료·폐기 판정은 domain `CollectionShare` 모델에 둔다(`WishlistCollection.kt` 와 같은 모양).

### A2 — 묶음 삭제·회원 탈퇴 때 링크가 살아남는다 (REVISE)
- ADR-0107 §4(`ADR-0107…md:13`) "묶음을 지우면 링크도 폐기" 인데, 현재 삭제는 `WishlistService.kt:102-106` → `WishlistRepositoryAdapter.kt:95-98` 로 묶음 행만 지운다. 스펙 SR-2 에도 SR-4.2 테스트 목록에도 이 경로가 없다.
- 탈퇴는 더 크다: `MemberEventConsumer.kt:32` 는 찜 항목만 지우고 묶음은 남긴다. 그러면 탈퇴 회원의 공유 링크가 **묶음 이름 + 빈 목록으로 200** 을 계속 낸다 — ADR-0107 §2 의 은닉 의도와 ADR-0078(식별 최소화)에 어긋난다.
- 수정안: (1) `delete()` 같은 트랜잭션에서 그 묶음의 링크 폐기(또는 `collection_share.collection_id` FK `ON DELETE CASCADE` — 둘 중 하나를 스펙에 명시). (2) 탈퇴 소비자에서 해당 회원 링크 전부 폐기. (3) SR-4.2 에 두 경우 → 404 테스트, SR-4.3 회귀 주입 목록에 "삭제 시 폐기 제거" 추가.

### A3 — 열람 원장은 읽는 곳이 없고, 정리할 호스트도 없다 (REVISE)
- 스펙 SR-2.6 은 열람 원장 + 90일 보존을 요구하지만 Out of Scope(`spec.md:42`)가 "공유 열람 통계 화면"을 뺐다 — 쓰기만 있고 읽기가 없는 테이블이다.
- 정리 경로도 없다: retention 은 atlas 이미지(`k8s/base/retention/cronjob.yaml:43`)와 content 이미지(`cronjob-content.yaml:42`)만 돌고, "원장이 사는 이미지가 정리한다"(`cronjob-content.yaml:14-15`) 규칙상 wishlist(account 파드)에는 러너가 없다(`ADR-0077…md:116-122` 러너 목록에 wishlist 없음, `account/app` 에 Runner 없음). "대상 표에 한 줄"로는 지워지지 않는다 — 실제로는 새 CronJob + `WishlistRetentionRunner` 가 필요하고, 무료 범위 단일 노드에 배치가 하나 더 뜬다.
- 수정안(택1, 권장 ①): ① 원장을 이번 범위에서 빼고 ADR-0107 §6 을 "열람 기록 없음"으로 — 통계 화면이 생길 때 같이 만든다(YAGNI). ② 남긴다면 SR-2.6 에 `retention-account` CronJob(account 이미지, `retention` 프로파일) + `wishlist/feature/.../infrastructure/retention/WishlistRetentionRunner` + 스케줄 충돌 회피 시각까지 명시.

### A4 — `/c` 단축 주소 배선이 빠졌고 실패 동작이 ADR-0106 과 다르다 (REVISE)
- `ShortLinks` 는 접두사별 목적지 origin 을 `getValue` 로 꺼낸다(`ShortLinks.kt:15-20,38`). `C` 를 더하면서 `ShortLinkProperties.kt:14-21` 에 origin(apex)을 안 넣으면 `destination(C, …)` 이 `NoSuchElementException` 으로 죽는다.
- apex 인그레스는 접두사를 하나씩 연다(`k8s/overlays/oci-arm/ingresses/commerce-platform.yaml:85-98`). `/c` 줄이 없으면 portal-fe 의 `/` 가 받아 SPA 404 가 된다. 게이트웨이도 `/c` → `account:8093` 라우트가 새로 필요하다(`GatewayRouteConfig.kt:715-724` 는 atlas·content 만).
- 실패 동작: ADR-0106 은 "해석에 실패하면 서비스 목록으로 302"(`ADR-0106…md:38`, `ShortLinks.kt:42`)인데 스펙 SR-2.4·SR-4.4 는 `/c/x` 404. 비공개 자료라 404 가 맞을 수 있으나 그렇다면 ADR-0107 §5 에 "ADR-0106 §실패 동작의 예외 — 존재 은닉" 을 적는다.
- 수정안: SR-2.3 에 ① `ShortLinkProperties` 에 목적지 추가(또는 `C` 는 `origin` 사용을 명시) ② 인그레스 `/c` ③ 게이트웨이 `short-link-collection` 라우트(`shortLinkLimit`) ④ 실패 = 404 근거를 ADR 에. `ShortLinkAutoConfiguration.kt:8` 주석의 호스트 목록에 account 추가.

### A5 — 공개 열람 경로에서 `X-User-Id` 를 믿지 않게 분리한다 (REVISE)
- 인증 필터가 없는 라우트는 클라이언트가 붙인 `X-User-Id` 가 지워지지 않는다(`GatewayRouteConfig.kt:712-714`). 그런데 `WishlistController.kt:27-28` 은 "이 prefix 전체가 ROLE_USER 필터를 거치므로 X-User-Id 는 신뢰한다" 고 적고 있고, `/count` 로 이미 사실과 어긋난 상태다.
- 수정안: 공개 `GET /shared/{token}` 과 `/c/{token}` 은 헤더 파라미터가 없는 별도 컨트롤러(`presentation/share/...`)에 둔다 — 소유자 판정 코드가 같은 클래스에 섞이지 않게. 게이트웨이 라우트는 `wishlist-service`(`:368`) **앞**에, 리미터는 IP 키 `shortLinkLimit`(`:41-45`). `WishlistController` 주석은 "공개 예외: /count" 로 고친다.

### A6 — 묶음 공유 이벤트의 entityType 이 정해지지 않았다 (경미)
- SR-3.2 는 묶음 공유를 `CLICK`+`SHARE`, SR-3.4 는 EntityType 을 늘리지 않는다고만 한다. 현재 유니온(`portal-fe/src/analytics/events.ts:3-11`)에 묶음이 없어 구현자가 `ATTRACTION` + 묶음 id 를 넣으면 관광지 id 공간에 묶음 id 가 섞인다(인기 집계는 `POST_SELECTION_SECTIONS` 로 빠지지만 다른 조회는 아니다).
- 수정안: 묶음 공유는 `entityType: 'PAGE'`, `entityId: 'favorites'` 처럼 고정값을 스펙에 적고, 묶음 id 는 payload 로만.

## 통과 확인
- `POST_SELECTION_SECTIONS` 는 application 상수(`AggregateAttractionPopularityUseCase.kt:31`)를 어댑터가 참조(`ClickHouseAttractionPopularityAdapter.kt:44`) — 방향 맞음.
- SR-1(로그인 복귀)은 FE 내부 상태와 기존 PUT 멱등(`WishlistService.kt:30-36`)만 쓴다 — 서버 경계 변경 없음.
- ADR-0106 계산형 코드를 쓰지 않고 행 토큰을 쓰는 결정은 이력서 링크 선례(`ADR-0106…md:31`)와 같다.

VERDICT: REVISE
