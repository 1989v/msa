# 판정 결과: ADR-0107 여행 묶음 공유 스펙, 심판 1라운드

리뷰 6개 차원에서 나온 발견 47건을 모두 판정했습니다. 유지 44, 강등 1, 기각 2입니다. 리뷰어가 BLOCK 으로 올린 발견은 없었고, 이번 판정에서도 BLOCK 으로 올린 것은 없습니다. 판정은 모두 워크트리 `wt-impl` 에서 인용 위치를 직접 열어 확인한 결과입니다.

**구현 전에 꼭 고칠 셋**
- **B3 (404 이중 의미)**: 스펙대로 만들면 기능을 켜도 첫 공유 링크를 만들 수 없습니다.
- **B1 (저장 의도에 타입 없음)**: 기존 `toggle` 을 그대로 쓰면 이미 찜한 관광지가 해제됩니다.
- **B6 (공개 라우트)**: 클라이언트가 위조한 `X-User-Id` 가 백엔드까지 그대로 갑니다.

---

## 1. 묶음 표

| 묶음 | 포함 발견 | 판정 | 핵심 증거 |
|---|---|---|---|
| B1 저장 의도의 타입·소비 위치·토글 위험 | R1, I-3, S#6, F4, U2, U4, F2, F3 | 유지 REVISE | `FavoriteButton.tsx` 의 `type: FavoriteTargetType` prop, 호출처 9곳. `useFavorites.ts` 는 `keys.has(targetKey)` 면 `removeFavorite`. `main.tsx:32` 가 `<StrictMode>` |
| B2 비로그인으로 돌아온 경우 | F10, U3 | 유지 REVISE | 스펙 `:13-14` 에 「로그인 뒤」「로그인 상태로 돌아왔고」만 있고 반대 경우가 없음 |
| B3 `GET …/share` 404 의 두 가지 뜻 | I-2, F5, U1, F7 | 유지 REVISE | 스펙 `:20`「살아 있는 링크 또는 404」와 `:22`「서버 응답(404)으로 공유 버튼을 숨긴다」가 서로 부딪힘 |
| B4 묶음 삭제·탈퇴 때 링크 폐기 | A2, R4, I-5, S#3, U5 | 유지 REVISE | `MemberEventConsumer.kt:32` 는 찜 항목만 지움. 묶음 저장소의 `deleteAllByMemberId` 는 부르는 곳이 없음. `deleteCollection` 은 행 `delete` 뿐 |
| B5 열람 원장 (읽는 곳·정리 주체 없음) | A3, I-1, S#4 | 유지 REVISE | retention 이미지가 `commerce/atlas`·`commerce/content` 둘뿐. wishlist 에는 `@KafkaListener` 2개. `RETENTION_RUNNERS` 에 wishlist 없음 |
| B6 공개 라우트 좁히기 | A5, I-7, S#1 | 유지 REVISE | `GatewayRouteConfig.kt:712-714`「X-User-Id 가 지워지지 않는다」. `WishlistController` 주석은「prefix 전체가 ROLE_USER 필터를 거치므로 X-User-Id 는 신뢰」 |
| B7 `/c` 배선·common 변경 회피·실패 동작 | A4, I-8, I-9, R8 | 유지 REVISE | `ShortLinks.kt:38` 가 `serviceOrigins.getValue(prefix)` 로 꺼냄. 인그레스에 `/r /p /g /b` 만 있음. `images.yml` 은 `^(common/…` 이 바뀌면 전체 JVM 재빌드. ADR-0106:38 은 실패 시 302 |
| B8 묶음 공유 이벤트의 대상 | A6, R5, U7 (+F9 일부) | 유지 (A6 만 MINOR) | `EntityType`·`ScreenType` 에 묶음·찜 화면이 없음. 중복 키는 `viewId\|entityType\|entityId\|sectionId\|action`. 인기 집계 SQL 은 `entity_type = 'ATTRACTION'` |
| B9 살아 있는 링크는 하나 (동시 생성) | R3, I-4 | 유지 REVISE | 스펙 `:19` 는 `token` 유일 인덱스와 `collection_id` 일반 인덱스만 둠 |
| B10 소유자 아닌 요청 = 404 하나로 | S#5, U6 (일부) | 유지 REVISE | `WishlistService.ownedCollection` → `ErrorCode.NOT_FOUND`. 묶음 id 는 `AUTO_INCREMENT` |
| B11 공개 응답의 모양·상한 | R2, I-6, U6 | 유지 REVISE | 기존 응답 필드는 `createdAt`. `FavoritesPage` 가 `size: 100` 과 `Promise.all(hydrate)` 를 씀 |
| B12 레이트리밋 서술 | S#2 | 유지 REVISE | `RateLimiterConfig.kt:33-35`「remoteAddress 는 ingress 파드 IP 하나라 모든 방문자가 한 통」 |
| B13 레이어 배치 | A1 | 유지 REVISE | `package-structure.md` 규칙 6·7·11 |
| B14 테스트 보강 | F1, F6, F8, F9, U8 | 유지 REVISE | wishlist 테스트는 단위 3개뿐. `safeNext`·`buildLoginHref` 테스트 0건 (grep rc=1). `ClickHouseAttractionPopularityAdapterTest` 에 SQL 리터럴 4곳 |
| B15 용어·glossary | R6 강등, R7 기각 | — | glossary 가 낡은 것은 이번 스펙 이전부터. 「취소/폐기」 통일은 표기 문제 |

---

## 2. 발견별 판정 JSON

```json
[
  {"id":"A1 새 코드의 레이어 위치가 정해지지 않았다","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"docs/conventions/package-structure.md","line":93,"quote":"application 서비스가 읽으면 `application/{entity}/config/{X}Properties.kt`"},
               {"file":"docs/specs/2026-10-09-place-return-share-events/spec.md","line":22,"quote":"설정 `kgd.wishlist.share.enabled`(기본 false): 꺼져 있으면 위 API 전부와 `/c/` 해석이 404"}],
   "reason":"스펙에 배치가 없고, 레이어 표준이 있는데도 최근 세 도메인이 위반한 채 통과한 전례가 CLAUDE.md 에 적혀 있다. 반증 없음."},
  {"id":"A2 묶음 삭제·회원 탈퇴 때 링크가 살아남는다","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"wishlist/feature/src/main/kotlin/com/kgd/wishlist/infrastructure/consumer/MemberEventConsumer.kt","line":32,"quote":"wishlistRepositoryPort.deleteAllByMemberId(memberId)"},
               {"file":"wishlist/feature/src/main/kotlin/com/kgd/wishlist/infrastructure/persistence/adapter/WishlistRepositoryAdapter.kt","line":69,"quote":"wishlistItemJpaRepository.deleteAllByMemberId(memberId)"},
               {"file":"docs/adr/ADR-0107-wishlist-collection-share-links.md","line":13,"quote":"묶음을 지우면 링크도 폐기된다"}],
   "reason":"탈퇴 처리는 항목만 지우고 묶음 행을 남긴다는 인용이 원문과 같다. B4 로 묶는다."},
  {"id":"A3 열람 원장은 읽는 곳이 없고 정리할 호스트도 없다","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"k8s/base/retention/cronjob.yaml","line":43,"quote":"image: commerce/atlas:latest"},
               {"file":"k8s/base/retention/cronjob-content.yaml","line":42,"quote":"image: commerce/content:latest"},
               {"file":"portal-fe/src/pages/__tests__/privacyRetention.test.ts","line":19,"quote":"const RETENTION_RUNNERS = [ … (wishlist 러너 없음)"}],
   "reason":"「표에 한 줄」로는 행이 지워지지 않는다. B5 로 묶는다."},
  {"id":"A4 /c 단축 주소 배선 누락·실패 동작 불일치","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"common/src/main/kotlin/com/kgd/common/shortlink/ShortLinks.kt","line":38,"quote":"val base = serviceOrigins.getValue(prefix) + path"},
               {"file":"k8s/overlays/oci-arm/ingresses/commerce-platform.yaml","line":87,"quote":"- path: /r … /p … /g … /b (\"/c\" 없음)"},
               {"file":"docs/adr/ADR-0106-…md","line":38,"quote":"해석에 실패하면 서비스 목록으로 302 한다"}],
   "reason":"인그레스·게이트웨이·origin 매핑이 모두 빠져 있고, 실패 동작이 ADR-0106 과 다르다. B7 로 묶는다."},
  {"id":"A5 공개 열람 경로에서 X-User-Id 를 믿지 않게 분리","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"gateway/src/main/kotlin/com/kgd/gateway/config/GatewayRouteConfig.kt","line":713,"quote":"인증 필터를 걸지 않으므로 클라이언트가 붙인 X-User-Id 가 지워지지 않는다"},
               {"file":"wishlist/feature/src/main/kotlin/com/kgd/wishlist/presentation/wishlist/controller/WishlistController.kt","line":27,"quote":"이 prefix 전체가 ROLE_USER 필터를 거치므로 X-User-Id 는 신뢰한다"}],
   "reason":"원문과 같다. B6 로 묶는다."},
  {"id":"A6 묶음 공유 이벤트의 entityType 미정","verdict":"keep","severity":"MINOR",
   "evidence":[{"file":"portal-fe/src/analytics/events.ts","line":3,"quote":"export type EntityType = 'ATTRACTION' | … | 'SERVICE' (묶음 없음)"}],
   "reason":"리뷰어가 경미로 올린 등급을 그대로 둔다. 수정안의 PAGE+고정 id 는 PlacedItem 으로 섹션을 함께 실을 수 있어 성립한다. B8 로 묶는다."},
  {"id":"R1 저장 의도의 식별자에 targetType 이 빠져 있다","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"portal-fe/src/components/favorite/FavoriteButton.tsx","line":63,"quote":"type: FavoriteTargetType;"},
               {"file":"wishlist/feature/src/main/kotlin/com/kgd/wishlist/presentation/wishlist/controller/WishlistController.kt","line":40,"quote":"@PutMapping(\"/{targetType}/{targetKey}\")"}],
   "reason":"PUT 경로에 타입이 필요한데 의도에는 키만 있다. B1 로 묶는다."},
  {"id":"R2 공개 응답에 targetType 없음, addedAt 신조어","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"wishlist/feature/src/main/kotlin/com/kgd/wishlist/presentation/wishlist/controller/WishlistController.kt","line":211,"quote":"val createdAt: LocalDateTime"},
               {"file":"docs/specs/2026-10-09-place-return-share-events/spec.md","line":20,"quote":"{name, items:[{targetKey, addedAt}]}"}],
   "reason":"묶음에 넣은 시각은 저장되지 않으므로 addedAt 은 지킬 수 없는 의미를 약속한다. B11 로 묶는다."},
  {"id":"R3 한 묶음에 살아 있는 링크 하나를 강제할 수단이 없다","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"docs/specs/2026-10-09-place-return-share-events/spec.md","line":19,"quote":"`token` 유일 인덱스, `collection_id` 인덱스"}],
   "reason":"스키마만으로는 막히지 않는다. B9 로 묶는다."},
  {"id":"R4 묶음 삭제·회원 탈퇴 때 링크 폐기 경로 미정","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"wishlist/feature/src/main/kotlin/com/kgd/wishlist/infrastructure/persistence/repository/WishlistCollectionJpaRepository.kt","line":10,"quote":"fun deleteAllByMemberId(memberId: Long)"}],
   "reason":"grep 으로 확인: 묶음 저장소의 이 메서드를 부르는 곳이 없다. B4 로 묶는다."},
  {"id":"R5 묶음 공유 SHARE 이벤트의 소속 미정","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"portal-fe/src/analytics/events.ts","line":16,"quote":"ScreenType = 'PLACE_HUB' | 'PLACE_REGION' | 'ATTRACTION_DETAIL' | 'UNIFIED_SEARCH'"},
               {"file":"analytics/…/ClickHouseAttractionPopularityAdapter.kt","line":67,"quote":"WHERE entity_type = 'ATTRACTION'"}],
   "reason":"PlacedItem 에서 screenType 은 필수인데 쓸 값이 없다. B8 로 묶는다."},
  {"id":"R6 wishlist glossary 가 상품 전용 시절에 머물러 있다","verdict":"demote","severity":"MINOR",
   "evidence":[{"file":"wishlist/glossary.md","line":10,"quote":"(memberId, productId) pair에 unique 제약(JPA 레벨), 도메인 모델은 WishlistItem 하나뿐"}],
   "reason":"ⓑ ADR-0074 다형 대상과 ADR-0080 묶음도 glossary 를 고치지 않고 도입됐다. 이번 스펙이 만든 결함이 아니라 기존 부채라서 후속 정리로 강등한다."},
  {"id":"R7 취소/폐기, 두 가지 원장","verdict":"dismiss","severity":"MINOR","evidence":[],
   "reason":"헌법 5 — 표기 통일이고 동작·계약 차이가 없다(스타일)."},
  {"id":"R8 공개 읽기 경로가 BC 규칙 문서와 어긋남·/c 실패 동작","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"wishlist/CLAUDE.md","line":38,"quote":"찜 목록·추가·삭제는 로그인 전용이고, 대상별 찜 수 조회만 공개다"}],
   "reason":"공개 경로가 하나 늘어나는데 BC 규칙 문서를 고치는 일이 산출물에 없다. 실패 동작은 B7 로 묶는다."},
  {"id":"I-1 retention 배치가 wishlist 원장에 닿지 않는다","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"wishlist/feature/src/main/kotlin/com/kgd/wishlist/infrastructure/consumer/MemberEventConsumer.kt","line":20,"quote":"@KafkaListener("},
               {"file":"account/app/src/test/kotlin/com/kgd/account/AccountContextLoadSpec.kt","line":37,"quote":"\"spring.kafka.listener.auto-startup=false\","}],
   "reason":"account 이미지로 배치를 띄우면 리스너가 함께 뜨는 함정이 실제로 있다. B5 로 묶는다."},
  {"id":"I-2 GET …/share 의 404 가 두 뜻","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"docs/specs/2026-10-09-place-return-share-events/spec.md","line":22,"quote":"FE 는 서버 응답(404)으로 공유 버튼을 숨긴다"}],
   "reason":"스펙 안에서 서로 부딪힌다. B3 로 묶는다. 수정안의 「빈이 없으면 404」는 NOTES 의 405 위험 참고."},
  {"id":"I-3 저장 의도에 대상 타입·소비 위치가 없다","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"portal-fe/src/components/favorite/useFavorites.ts","line":39,"quote":"if (keys.has(targetKey)) { await removeFavorite(type, targetKey);"},
               {"file":"portal-fe/src/components/favorite/FavoriteButton.tsx","line":69,"quote":"const { loggedIn, isFavorite, toggle } = useFavorites(type, tracking);"}],
   "reason":"별 하나마다 훅이 생기고, toggle 은 이미 찜이면 DELETE 를 보낸다. B1 로 묶는다."},
  {"id":"I-4 살아 있는 링크 하나가 동시 요청에서 깨진다","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"wishlist/feature/src/main/resources/wishlistdb/migration/V3__collections.sql","line":16,"quote":"ENGINE=InnoDB"}],
   "reason":"MySQL 에는 부분 유일 인덱스가 없다. B9 로 묶는다."},
  {"id":"I-5 묶음 삭제·회원 탈퇴 때 링크 미정리","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"wishlist/feature/src/main/kotlin/com/kgd/wishlist/infrastructure/persistence/adapter/WishlistRepositoryAdapter.kt","line":97,"quote":"collectionJpaRepository.findByIdAndMemberId(id, memberId)?.let { collectionJpaRepository.delete(it) }"}],
   "reason":"B4 로 묶는다."},
  {"id":"I-6 공개 열람 응답의 크기 상한이 없다","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"portal-fe/src/components/favorite/FavoritesPage.tsx","line":127,"quote":"size: 100,"},
               {"file":"portal-fe/src/components/favorite/FavoritesPage.tsx","line":131,"quote":"await Promise.all(page.items.map((item) => hydrate(type, item.targetKey)))"}],
   "reason":"인증 없는 경로가 항목 수만큼 병렬 하이드레이션을 일으킨다. B11 로 묶는다."},
  {"id":"I-7 게이트웨이 공개 라우트 메서드·헤더 좁히기","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"gateway/src/main/kotlin/com/kgd/gateway/config/GatewayRouteConfig.kt","line":252,"quote":"r.method(HttpMethod.POST) … f.removeRequestHeader(\"X-User-Id\").removeRequestHeader(\"X-User-Roles\")"}],
   "reason":"선례(토스 웹훅)가 있다. B6 로 묶는다."},
  {"id":"I-8 ShortLinkPrefix 에 c 를 넣으면 전 JVM 재빌드","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":".github/workflows/images.yml","line":136,"quote":"grep -qE '^(common/|buildSrc/|…' → 공유 의존성 변경 감지 — 전체 JVM rebuild"}],
   "reason":"원문과 같다. 단, 수정안 (a) 가 권한 `common/docs/service.md` 수정도 같은 정규식에 걸린다(NOTES). B7 로 묶는다."},
  {"id":"I-9 설정 키가 놓일 곳, /c 실패 시 동작","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"place/feature/…/AttractionShortLinkController.kt","line":55,"quote":"private const val PREFIX = \"/p\""}],
   "reason":"B7·B3 로 묶는다."},
  {"id":"S#1 공개 라우트가 신원 헤더를 지우지 않고 메서드·경로가 넓다","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"wishlist/feature/…/WishlistController.kt","line":64,"quote":"@DeleteMapping(\"/{targetType}/{targetKey}\")"}],
   "reason":"`/shared/x` 모양이 PUT·DELETE 패턴과 겹친다. 지금은 parseTargetType 의 400 이 우연히 막을 뿐이다. B6 로 묶는다."},
  {"id":"S#2 레이트리밋 키가 사실상 전역 버킷","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"gateway/src/main/kotlin/com/kgd/gateway/config/RateLimiterConfig.kt","line":33,"quote":"클러스터 안에서 remoteAddress 는 ingress 파드 IP 하나라 그대로 쓰면 모든 방문자가 한 통을 나눠 쓴다"}],
   "reason":"ADR Consequences 의 방어선 서술이 사실과 어긋난다."},
  {"id":"S#3 탈퇴 회원의 공유 링크가 계속 열린다","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"wishlist/feature/…/MemberEventConsumer.kt","line":33,"quote":"log.info { \"Deleted all wishlist items for memberId=$memberId\" }"}],
   "reason":"B4 로 묶는다."},
  {"id":"S#4 열람 원장 정리 주체 없음, 수집 목적 비어 있음","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"docs/adr/ADR-0077-ledger-retention.md","line":121,"quote":"단축 주소 클릭 원장 정리 | `{Game,Blog,Place}RetentionRunner` · code-dictionary `RetentionRunner`"}],
   "reason":"B5 로 묶는다."},
  {"id":"S#5 소유자 아닌 요청 응답이 403/404 미정","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"wishlist/feature/…/WishlistService.kt","line":133,"quote":"?: throw BusinessException(ErrorCode.NOT_FOUND, \"묶음을 찾을 수 없습니다\")"}],
   "reason":"기존 선례가 404 이므로 하나로 정할 수 있다. B10 으로 묶는다."},
  {"id":"S#6 저장 의도 재생 범위·복원값 검증 미기술","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"portal-fe/src/auth/auth.ts","line":59,"quote":"export function clearLocalSession(): void {"}],
   "reason":"B1 로 묶는다. 수정안이 말한 「URL 파라미터와 같은 파서」는 PlacePage 에 없으므로(searchParams 0건) 허용값 검사로 바꿔 반영한다."},
  {"id":"F1 복귀 테스트가 저장 의도를 손으로 심으면 자기 근거가 된다","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"docs/specs/2026-10-09-place-return-share-events/spec.md","line":36,"quote":"단위·컴포넌트 테스트로 대신하고 그 사실을 적는다"}],
   "reason":"쓰는 쪽과 읽는 쪽을 잇는 테스트가 유일한 증거가 된다. safeNext·buildLoginHref 테스트 0건도 grep 으로 확인했다."},
  {"id":"F2 PUT 0회만 보면 DELETE 회귀를 놓친다","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"portal-fe/src/components/favorite/useFavorites.ts","line":40,"quote":"await removeFavorite(type, targetKey);"}],
   "reason":"B1 로 묶는다."},
  {"id":"F3 PUT 1회를 버튼 하나로 재면 다중 마운트 중복을 못 잡는다","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"portal-fe/src/main.tsx","line":32,"quote":"<StrictMode>"}],
   "reason":"B1 로 묶는다."},
  {"id":"F4 의도에 대상 타입이 없어 PUT 기대값을 정할 수 없다","verdict":"keep","severity":"REVISE","evidence":[],
   "reason":"R1 과 같은 근거다. B1 로 묶는다."},
  {"id":"F5 SR-2.2 와 SR-2.4 가 충돌","verdict":"keep","severity":"REVISE","evidence":[],
   "reason":"I-2 와 같은 근거다. B3 로 묶는다."},
  {"id":"F6 공유 서버 쪽 부정 케이스 누락","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"gateway/src/test/…/GatewayRouteAuthSpec.kt","line":301,"quote":"Then(\"같은 접두의 다른 결제 경로는 공개로 열리지 않는다\")"}],
   "reason":"선례 테스트가 있다. B4·B6·B10·B11 의 테스트 몫이다."},
  {"id":"F7 설정 꺼짐 404 를 서비스 테스트로만 보면 경로 하나가 빠져도 모른다","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"wishlist/feature/…/WishlistController.kt","line":40,"quote":"@PutMapping(\"/{targetType}/{targetKey}\")"}],
   "reason":"꺼짐 상태의 `GET /shared/x` 는 PUT 패턴과 경로가 겹쳐 405 가 날 수 있다(NOTES). HTTP 레이어 확인이 반드시 필요하다는 근거다."},
  {"id":"F8 저장소·보존기간 테스트의 자리가 없다","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"deal/feature/src/test/kotlin/com/kgd/deal/infrastructure/persistence/DealSchemaIntegrationSpec.kt","line":1,"quote":"(선례 존재; wishlist 테스트는 WishlistItemTest·WishlistServiceTest·WishlistCollectionTest 뿐)"}],
   "reason":"Clock 주입 수단도 wishlist 에 없다. 보존기간 몫은 B5 가 결정되면 사라진다."},
  {"id":"F9 계측 기대값 누락·복원 계측 부정 케이스","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"analytics/…/ClickHouseAttractionPopularityAdapterTest.kt","line":72,"quote":"toUInt32(countIf(action = 'CLICK' AND section_id NOT IN ('MAP_LINK', 'FAVORITE'))) AS clicks"}],
   "reason":"SQL 리터럴 4곳을 함께 고쳐야 한다는 지적이 원문과 같다. 엔티티 몫은 B8 로 묶는다."},
  {"id":"F10 로그인하지 않고 돌아온 경우 미정의","verdict":"keep","severity":"REVISE","evidence":[],
   "reason":"B2 로 묶는다."},
  {"id":"U1 공유 버튼 노출이 자기모순","verdict":"keep","severity":"REVISE","evidence":[],
   "reason":"B3 로 묶는다. 고치지 않으면 켜도 첫 링크를 만들 수 없다."},
  {"id":"U2 저장 의도의 대상 타입·소비 위치 미정","verdict":"keep","severity":"REVISE","evidence":[],
   "reason":"B1 로 묶는다."},
  {"id":"U3 로그인 포기·우회 흐름","verdict":"keep","severity":"REVISE","evidence":[],
   "reason":"B2 로 묶는다."},
  {"id":"U4 자동 찜의 선행 조건 (keys 로드)","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"portal-fe/src/components/favorite/useFavorites.ts","line":30,"quote":"enabled: loggedIn,"}],
   "reason":"B1 로 묶는다."},
  {"id":"U5 묶음 삭제 → 링크 폐기 누락, 빈 상태","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"wishlist/feature/src/main/resources/wishlistdb/migration/V3__collections.sql","line":25,"quote":"REFERENCES wishlist_collection (id) ON DELETE SET NULL;"}],
   "reason":"B4 로 묶는다. 빈 상태는 SR-2 의 FE 항목에 반영한다."},
  {"id":"U6 공유 API 사후 조건·입력 경계","verdict":"keep","severity":"REVISE","evidence":[],
   "reason":"POST 응답 모양과 expiresInDays 경계가 스펙에 없다. B10·B11 로 묶는다."},
  {"id":"U7 계측의 엔티티·화면·중복 키","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"docs/specs/2026-10-08-place-hub-instrumentation/spec.md","line":56,"quote":"트래커 중복 키는 `viewId|entityType|entityId|sectionId|action` 이다"}],
   "reason":"「PAGE 는 섹션을 못 갖는다」는 PageItem 에만 맞고 PlacedItem 은 PAGE 와 섹션을 함께 실을 수 있다. 다만 결론(값 미정·채널 유실)은 성립한다. B8 로 묶는다."},
  {"id":"U8 S3-4b·S3-6a 완료 조건의 배포 확인","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"docs/plans/2026-10-08-place-growth-work-plan.md","line":97,"quote":"수신자 세션에서 열람·저장 동작 확인"}],
   "reason":"계획서의 완료 조건이 SR-4.4 로 이어지지 않는다."}
]
```

---

## 3. spec.md 편집 목록

아래 문안은 6절 사용자 판단의 **권고 기본값**을 넣은 것입니다. 기본값과 다르게 정하면 표시한 줄만 바꾸면 됩니다.

**(1) 4행, 머리 인용 블록 끝에 한 문장 추가**
> 「설정 키는 코드 기본값 false 이고, 켤 때는 account 오버레이 env `KGD_WISHLIST_SHARE_ENABLED=true` 로 넣는다(wishlist:feature 에는 yml 이 없다).」

**(2) Goal(7행)**: 「공유·길찾기 행동이 원장에 남는다」를 「공유·길찾기 행동이 이벤트 원장에 남는다」로 바꿉니다. 열람 원장을 빼면서 생기는 혼동을 막기 위한 것이고, R7 판정과는 상관없습니다.

**(3) SR-1 전체를 아래로 교체**

```
### SR-1 로그인 복귀 완주 (S3-3)
1. 저장 의도: 비로그인 별 클릭(`FavoriteButton.tsx:72-80`)은 `type === 'ATTRACTION'` 일 때만, 이동 전에 현재 호스트 sessionStorage 키 `kgd.favoriteIntent.v1` 에 `{targetType:'ATTRACTION', targetKey, createdAt}`(createdAt = epoch ms)을 쓴다. 키 하나(덮어쓰기), createdAt 부터 10분 지나면 무효. 다른 타입(PRODUCT·GAME·BLOG_POST)은 지금처럼 로그인으로만 보내고 의도를 남기지 않는다.
2. 화면 상태: 허브는 별 클릭이 로그인으로 이동하기 직전에 sessionStorage 키 `kgd.placeHubState.v1` 에 {검색어·분류·속성·지역 3단계·행사 상태·선택 관광지 id·page·createdAt} 을 쓴다(10분). 허브 첫 마운트에서 유효한 상태가 있으면 **로그인 여부와 무관하게** 복원하고 키를 지운다. 복원값은 외부 입력으로 다룬다 — 분류·속성·행사 상태는 화면이 아는 값 목록, 지역 코드·관광지 id 는 숫자 문자열, page 는 0 이상 정수가 아니면 통째로 버리고 지운다. 복원 마운트는 SEARCH 를 정확히 1건(`trigger:'restore'`) 내고, 그 마운트에서 기본 상태의 `initial`/`landing` SEARCH 를 내지 않는다. `restore` 는 SearchTrigger 에 추가하고 계측 스펙 SR-10 「건수에서 빼는 것」에 넣는다(결과 view 에는 들어간다 — landing 만 빠지므로). 같은 커밋에서 표를 고친다. 상세 페이지는 주소가 곧 상태라 저장 의도만.
3. 의도 소비: 페이지 단위 훅 하나를 `PlacePage`·`AttractionPage`·수신자 화면(`/shared/:token`)에 한 번씩 둔다 — 별마다 두지 않는다. 조건은 `isLoggedIn()` 참 + 의도 유효 + `ATTRACTION` `/keys` 조회 성공 뒤. 의도 읽기·삭제는 첫 await 전에 동기로 한다(StrictMode 이중 마운트에서도 PUT 1회). 키 목록에 이미 있으면 아무것도 하지 않는다(PUT·DELETE·알림·계측 0). 없으면 `toggle` 이 아니라 `addFavorite('ATTRACTION', targetKey)` 를 직접 부르고, 성공하면 keys 캐시를 갱신해 별을 채우고 알림 「찜했습니다」. PUT 실패 또는 `/keys` 실패면 의도를 지우고, 별은 비운 채 알림 없이 `console.warn` 한 줄. 비로그인 마운트는 의도를 소비하지도 지우지도 않는다(10분 무효가 정리한다).
4. 로그인 next 는 지금처럼 현재 href(`auth.ts:123-128`) — 허브 상태를 주소에 넣지 않는다.
5. 계측: 자동 완료 찜은 그 성공 콜백에서 기존 `FAVORITE` CLICK(`saved:true`) 1건 + payload `resumed:true`. tracking 을 받는 화면(허브·상세)만 낸다.
6. `clearLocalSession`(`auth.ts:59-67`)은 두 키를 지운다.
```

**(4) SR-2 전체를 아래로 교체**

```
### SR-2 여행 묶음 공유 (S3-4b, ADR-0107)
1. 스키마: wishlist Flyway V4(착수 때 다른 세션 미커밋 번호 확인) `collection_share` — `id` PK · `token CHAR(10)` UNIQUE · `collection_id BIGINT NOT NULL` FK → `wishlist_collection(id) ON DELETE CASCADE` · `member_id BIGINT NOT NULL` 인덱스 · `created_at` · `expires_at NULL` · `revoked_at NULL`.
2. 레이어(ADR-0083): 포트 `application/share/port/CollectionSharePort`, 유스케이스 인터페이스 `application/share/usecase/{ManageCollectionShareUseCase, GetSharedCollectionUseCase}`, 설정 `application/share/config/WishlistShareProperties`, 어댑터·JPA 엔티티 `infrastructure/persistence`. 토큰 생성·만료·폐기 판정은 domain `CollectionShare` 모델(`WishlistCollection.kt` 와 같은 모양), 시각은 `Clock` 주입. 서비스는 클래스 레벨 `@Qualifier("wishlistTransactionManager")`.
3. 「살아 있는 링크는 묶음당 하나」: 생성은 wishlist TM 트랜잭션 하나에서 소유 묶음 행을 `PESSIMISTIC_WRITE` 로 잠근 뒤, 살아 있는 행에 `revoked_at=now` → 새 행 삽입.
4. 소유자 API(인증): `POST /api/v1/wishlist/collections/{id}/share` body `expiresInDays`(생략 = 30, `null` = 만료 없음, 1~365 밖은 400) → `200 {token, url:"https://1989v.com/c/{token}", expiresAt|null}`. `GET …/share` → `200 {link: {token,url,expiresAt}|null}`(링크 없음은 `link:null`, 404 아님). `DELETE …/share` → 200, 멱등. 없는 묶음·남의 묶음은 상태·본문이 같은 404 하나(`WishlistService.ownedCollection` 선례).
5. 공개 API: `GET /api/v1/wishlist/shared/{token}` → `200 {name, items:[{targetType:'ATTRACTION', targetKey}], truncated}` — ATTRACTION 항목만, 찜 createdAt 내림차순 최대 100건, 넘으면 `truncated:true`. 시각·소유자 id·이름은 싣지 않는다. 없음·폐기·만료(열람 시점 판정)·묶음 삭제·소유자 탈퇴는 모두 같은 404. 이 API 와 `/c` 해석은 `X-User-Id` 파라미터가 없는 별도 컨트롤러 `presentation/share/` 에 둔다.
6. 폐기 경로: 묶음 삭제는 FK CASCADE 로 공유 행이 지워진다. 탈퇴는 `MemberEventConsumer.onMemberWithdrawn` 같은 트랜잭션에서 그 회원의 `collection_share` 를 `member_id` 로 삭제한다(묶음 행이 남는 기존 결함은 이번 범위 밖 — 보고만).
7. 게이트웨이: 라우트 `wishlist-shared-public` = `method(GET)` + `path("/api/v1/wishlist/shared/{token}")`(한 세그먼트), `removeRequestHeader` X-User-Id·X-User-Roles·Authorization, `requestRateLimiter { shortLinkLimit(it) }`, `wishlist-service` 라우트보다 **앞**에 선언. `short-link-collection` = `path("/c","/c/**")`, 같은 헤더 제거 + `shortLinkLimit`, → `http://account:8093`. apex 인그레스(`k8s/overlays/oci-arm/ingresses/commerce-platform.yaml` 단축 주소 블록)에 `- path: /c` 한 줄. `WishlistController` 클래스 주석은 「공개 예외: /count, /shared/{token}(별도 컨트롤러)」로 고친다.
8. 짧은 주소 `/c/{token}`: common 은 고치지 않는다. wishlist 공개 컨트롤러가 `PREFIX = "/c"` 상수(선례 `AttractionShortLinkController.kt:55`)를 갖고, DB 를 보지 않고 `ShortLinkProperties.origin + "/shared/" + 인코딩한 token` 으로 `ShortLinkRedirects.redirect` 302 한다. 무효 토큰은 수신 화면이 「찾을 수 없는 링크」를 그린다(ADR-0106 「빈 화면을 보지 않게」와 같은 취지, ADR-0107 §5). 접두사 목록 갱신은 ADR-0107 §5 와 `wishlist/CLAUDE.md` 에 적는다 — `common/` 아래 파일은 건드리지 않는다(전 JVM 재빌드).
9. 설정 `kgd.wishlist.share.enabled`(기본 false): 꺼지면 소유자 3 + 공개 1 + `/c` 다섯 경로가 모두 404 다(405·400 아님 — HTTP 레이어 테스트로 확인). FE 막대: `GET …/share` 가 404 면 공유 버튼 숨김, `200 link:null` 이면 「공유 링크 만들기」, `200 link` 면 복사(SharePanel 재사용)·폐기, 그 밖의 오류(5xx·네트워크)면 숨김. FE 에 별도 플래그 없음.
10. 수신자 화면: apex `/shared/:token`, 카드는 `FavoritesPage` 카드 재사용, 각 카드 별 = 수신자 자신의 찜(SR-1.3 소비 지점 포함), `noindex`, sitemap·llms 제외, 묶음 이름은 텍스트로만 렌더(`dangerouslySetInnerHTML` 금지). 상태 셋 — 404(「찾을 수 없거나 만료된 링크」) / 항목 0 또는 하이드레이션 전부 실패(빈 상태 문구) / 정상.
11. 열람 원장은 두지 않는다(읽는 곳이 없다 — 통계 화면과 함께 만든다). ADR-0077 표·`/privacy` §6·retention CronJob 변경 없음.
12. 문서: `wishlist/CLAUDE.md` Key Rules 의 공개 경로 문장에 「공유 토큰 열람」을 더하고, API 표에 네 행 + `/c/{token}` 을 추가한다.
13. 레이트리밋은 단축 경로와 같은 `shortLinkLimit`(ingress IP 키 = 사실상 전역 부하 상한)이다. 방문자별 제한은 하지 않는다.
```

**(5) SR-3 교체**
- SR-3.2 를 아래로 바꿉니다.
  > 「공유: 관광지 상세 SharePanel 의 복사·Web Share·X·LinkedIn 은 `CLICK` + `entityType:'ATTRACTION'`·`entityId`=관광지 id·`screenType:'ATTRACTION_DETAIL'`·`sectionId:'SHARE'`·payload `{kind:'attraction', channel}`. 묶음 공유 만들기·복사는 `CLICK` + `entityType:'PAGE'`·`entityId:'favorites'`·`screenType:'FAVORITES'`(ScreenType 에 추가)·`sectionId:'SHARE'`·payload `{kind:'collection', channel}` — 묶음 id 는 싣지 않는다. SharePanel 에 선택적 `onShare(channel)` 콜백을 더한다.」
- SR-3.3 끝에 덧붙입니다.
  > 「— 인기 집계는 `entity_type='ATTRACTION'` 만 보므로 이 제외는 관광지 상세 공유에만 의미가 있다. 상수 줄과 어댑터 테스트 SQL 리터럴 네 곳을 함께 고친다.」
- SR-3.4 를 바꿉니다.
  > 「EventAction·EntityType 은 늘리지 않는다. `events.ts` SectionId 에 `DIRECTIONS`·`SHARE`, ScreenType 에 `FAVORITES`.」
- SR-3.5 를 새로 둡니다.
  > 「중복 키(`viewId|entityType|entityId|sectionId|action`)는 바꾸지 않는다. 같은 view·대상에서 두 번째 공유 채널은 버려지는 것을 받아들인다 — 채널 분포는 view 당 첫 채널이다(FAVORITE 유실 수용과 같은 선택).」

**(6) SR-4 전체를 아래로 교체**

```
### SR-4 검증
1. vitest:
   - 이어 붙인 시나리오 1건(필수): 게스트로 허브 렌더 → 필터 조작 → 별 클릭(`location.href` 가로채기, `FavoriteButton.test.tsx:76-85` 선례) → 언마운트 → `portal_user_id` 쿠키 설정 → 같은 sessionStorage 로 `StrictMode` 재마운트(별 여러 개) → 질의 인자 복원·SEARCH 1건 `restore`(initial/landing 0건)·PUT 1회·의도 삭제·`CLICK/FAVORITE` 1건 `resumed:true`.
   - 손으로 심는 테스트는 경계용: 10분 지난 의도 무시, 이미 찜이면 PUT·DELETE·알림·track 0, `/keys` 지연 변형, PUT 실패 시 별 비움·의도 삭제, 비ATTRACTION 별 클릭은 의도 미저장, 형식이 틀린 허브 상태는 복원 안 함·삭제, 비로그인 재마운트 → 상태 복원 O·의도 유지·PUT 0, `clearLocalSession` 이 두 키 삭제.
   - `buildLoginHref`→`safeNext` 왕복이 place href 를 돌려준다(`vi.resetModules` + location 스텁 뒤 import).
   - 공유 막대 세 칸(404 → 숨김 / `link:null` → 만들기 / `link` → 복사·폐기) + 5xx → 숨김. 수신자 화면 세 상태·noindex·소유자 정보 없음. 길찾기·공유 계측의 entityType·entityId·screenType·sectionId·payload 전부, `MAP_LINK` 는 그대로 `MAP_LINK`.
2. Kotest:
   - domain `CollectionShare`(토큰 10자·영숫자, `Clock` 고정 만료·30일 기본·만료 없음).
   - 서비스: 재생성 시 이전 폐기, 연속 생성 두 번 → 살아 있는 행 1, `expiresInDays` 0·366 → 400, 없는 id 와 남의 id 의 응답 동일 404, 만료·폐기·없음 → 같은 404, 탈퇴 이벤트 → 토큰 404.
   - 컨트롤러: 공개 응답 JSON 키 집합이 정확히 `{name, items[{targetType,targetKey}], truncated}`, 101건 → 100 + truncated.
   - 설정 꺼짐: WebMvc 로 다섯 경로 각각 404.
   - `WishlistSchemaIntegrationSpec`(Testcontainers MySQL + Flyway, `DealSchemaIntegrationSpec` 모양): V4 적용, 같은 토큰 두 번 삽입 → 유일 제약 위반, 묶음 삭제 → 공유 행 CASCADE.
   - 게이트웨이: 공개 GET 인증 없이 통과, `PUT /api/v1/wishlist/shared/x` 는 공개 라우트에 안 걸림, 백엔드에 X-User-Id 미도달, `/api/v1/wishlist/collections/1/share` 무토큰 401, 레이트리밋 필터 존재.
   - `/c/{token}` → `https://1989v.com/shared/{token}` 302·no-store·noindex.
   - `POST_SELECTION_SECTIONS` 상수와 SQL 리터럴.
3. 회귀 주입(임시 사본, 각 빨강 확인): 의도 저장 삭제 · 복원 삭제 · 복원 시 기본 질의 억제 삭제 · 1회 가드 삭제 · 복귀가 `toggle` 재사용 · 의도 TTL 판정 삭제 · 링크 만료 판정 삭제 · 설정 꺼짐 분기 삭제 · 공개 라우트 헤더 제거 삭제 · 공개 경로를 `/api/v1/wishlist/**` 로 넓힘 · 탈퇴 시 공유 삭제 제거 · CASCADE 제거 · 공개 응답에 `memberId` 추가 · 섹션 POST_SELECTION 제외 삭제.
4. 배포 뒤:
   - 설정 꺼진 상태에서 `/api/v1/wishlist/shared/x` 404, `/c/x` 404.
   - 길찾기·상세 공유는 계측 스펙 SR-9.4 방식으로 보낸 건수 = 202 accepted = ClickHouse 행.
   - 로그인 복귀는 게스트 절반(별 클릭 → 두 키 존재 · next 가 place href)을 CDP 로 실측하고, 로그인 뒤 절반만 「미확인」으로 적는다.
   - S3-4b 완료는 Q1 승인 뒤 켠 상태에서 수신자 열람·찜 확인으로 판정한다. 그 전까지 미완.
```

**(7) Existing Code to Leverage(39행)**에 다음을 추가합니다: `MemberEventConsumer.kt:32`, `WishlistService.kt:131-133`, `RateLimiterConfig.kt:14-16,33-35`, `AttractionShortLinkController.kt:55`, `DealSchemaIntegrationSpec.kt`, `GatewayRouteAuthSpec.kt:301`, `ClickHouseAttractionPopularityAdapterTest.kt`. 그리고 `ShortLinkPrefix.kt`·`ShortLinks.kt` 는 「참고만(수정 안 함)」으로 표시합니다.

**(8) Out of Scope(42행)**에 「공유 열람 원장」, 「탈퇴 회원의 묶음 행 정리(기존 결함, 별건)」, 「glossary 재작성(R6, 후속)」을 추가합니다.

---

## 4. ADR-0107 편집 목록

- **§1** 「다시 만들면 이전 것을 폐기한다.」 뒤에 덧붙입니다.
  > 「강제는 생성 트랜잭션이 소유 묶음 행을 비관적 잠금으로 잡은 뒤 폐기 → 삽입하는 것으로 한다(MySQL 에 부분 유일 인덱스가 없다). `collection_id` 는 `wishlist_collection` FK `ON DELETE CASCADE`.」
- **§2** 「묶음 이름과 항목(대상 키 목록)을 읽는다」를 아래로 바꿉니다.
  > 「묶음 이름과 관광지 항목 `{targetType, targetKey}` 최대 100건(넘으면 `truncated`)을 읽는다. 시각은 싣지 않는다.」

  「없음·폐기·만료는 모두 **404**」는 아래로 바꿉니다.
  > 「없음·폐기·만료·묶음 삭제·소유자 탈퇴·설정 꺼짐은 모두 같은 **404**. 소유자 API 에서 남의 묶음도 없는 묶음과 같은 404」
- **§4** 끝에 덧붙입니다.
  > 「회원이 탈퇴하면(`member.withdrawn`) 그 회원의 공유 행을 모두 지운다.」
- **§5 전체를 교체**합니다.
  > 「5. **짧은 주소**: apex `/c/{token}` → `/shared/{token}` 302(no-store·noindex). wishlist 가 자기 컨트롤러 상수 `/c` 로 받고, 토큰을 조회하지 않고 넘긴다 — 무효 토큰은 수신 화면이 「찾을 수 없는 링크」를 그린다. ADR-0106 의 「실패 시 서비스 목록 302」와 다른 이유: 비공개 자료라 해석 단계에서 유효 여부를 드러내지 않고, 수신 화면이 빈 화면 대신 안내를 보여 주므로 ADR-0106 의 취지는 지켜진다. 접두사 `c` 는 ADR-0106 의 접두사 목록에 더하되 `common` 의 `ShortLinkPrefix` 는 바꾸지 않는다(common 변경은 전 JVM 이미지 재빌드).」
- **§6 전체를 교체**합니다.
  > 「6. **기록**: 열람 원장을 두지 않는다. 읽는 화면이 없어 방침에 수집 목적을 적을 수 없고, wishlist 가 사는 account 이미지에는 정리 배치가 없다. 통계 화면을 만들 때 원장·보존기간·정리 배치를 함께 정한다.」
- **§7 전체를 교체**합니다.
  > 「7. **계측**: 링크 생성·복사는 이벤트 원장 `CLICK` + `entityType:'PAGE'`·`entityId:'favorites'`·`screenType:'FAVORITES'`·`sectionId:'SHARE'`, payload `{kind:'collection', channel}`. 묶음 id 는 싣지 않는다. action·EntityType 을 늘리지 않는다.」
- **Consequences 첫 줄 교체**
  > 「개인 자료가 처음으로 로그인 없이 열린다 — 방어선은 토큰 엔트로피(약 59비트, 62^10)와 404 은닉이다. 게이트웨이 레이트리밋(ADR-0106 단축 경로와 같은 `shortLinkLimit`)은 키가 ingress IP 라 방문자별 제한이 아니라 전체 부하 상한이다. 공개 라우트는 GET 한 세그먼트만 열고 신원 헤더를 지운다.」
- **Consequences 둘째 줄 교체**
  > 「승인 전에는 설정으로 꺼져 있어 소유자 API·공개 API·짧은 주소가 모두 404 를 내고, FE 는 그 404 로 공유 버튼을 숨긴다.」

---

## 5. 재리뷰 차원

| 차원 | 필요 | 범위 |
|---|---|---|
| security | 필수 | SR-2.5·2.7·2.8·2.13, ADR §2·§5·Consequences |
| implementation | 필수 | SR-1.3, SR-2.1·2.3·2.6·2.8·2.9 (특히 꺼짐 = 404 가 405 없이 성립하는지) |
| test-strategy | 필수 | SR-4 전체 |
| usecase | 필수 | SR-1.2~1.3(비로그인 복귀), SR-2.4·2.9·2.10 |
| domain | 축소 | SR-3.2·ADR §7 (이벤트 소속), SR-2.5 응답 용어 |
| architecture | 축소 | SR-2.2·2.8 (common 미변경 결정, 레이어 배치) |

---

## 6. 사용자 판단 항목

| # | 질문 | 권고 기본값 | 근거 |
|---|---|---|---|
| J1 | 열람 원장을 이번 범위에 둘까 | **두지 않는다** | 읽는 곳이 없고, account 이미지에 정리 배치가 없으며, 만들면 Kafka 리스너 함정과 무료 범위 단일 노드에 배치 하나가 더 붙는다 |
| J2 | `/c` 접두사를 common `ShortLinkPrefix` 에 넣을까 | **넣지 않는다**(wishlist 상수, `common/` 미수정) | `common/` 이 바뀌면 전 JVM 재빌드되어 OCIR 무료 한도를 쓴다 |
| J3 | 켜진 상태에서 무효 토큰 `/c/x` 는 어떻게 할까 | **항상 `/shared/{token}` 302, 수신 화면이 안내** | 비공개 자료의 유효 여부를 해석 단계에서 드러내지 않는다. ADR-0106 과 다른 이유는 ADR §5 에 적는다 |
| J4 | 탈퇴 회원의 묶음 행이 남는 기존 결함(이름이 DB 에 잔존)을 이번에 고칠까 | **이번엔 공유 행만 삭제, 묶음 행 정리는 별건 승인** | 보이스카우트 규칙은 발견하고 보고까지다 |
| J5 | 같은 view 에서 두 번째 공유 채널이 버려지는 것을 받아들일까 | **받아들인다** | FAVORITE 유실을 받아들인 선례와 같다. 받아들이지 않으면 트래커 중복 키를 바꿔야 한다 |
| J6 | 공개 응답을 관광지만·100건 상한으로 할까 | **그렇게 한다** | 묶음을 고르는 UI 가 ATTRACTION 에만 있고, 소유자 화면도 size 100 |
| J7 | ADR-0107 승인 (Q1, 기존 항목) | 꺼진 채 배포, 승인 뒤 켬 | 변경 없음 |

---

SUMMARY: keep 44 / demote 1 / dismiss 2

NOTES:
- ① 설정이 꺼진 상태에서 `GET /api/v1/wishlist/shared/x` 는 `WishlistController` 의 `PUT/DELETE /{targetType}/{targetKey}` 와 경로가 겹칩니다. 그래서 404 가 아니라 405 가 날 수 있고, 리뷰 I-2 의 「빈이 없으면 404」 수정안을 그대로 따르면 SR-4.4 와 어긋날 수 있습니다. 위 편집문은 메커니즘을 정하지 않고 「다섯 경로 404, HTTP 레이어 테스트」로만 고정했습니다.
- ② I-8 수정안 (a) 가 권한 `common/docs/service.md` 한 줄 추가도 `images.yml` 의 `^common/` 정규식에 걸려 전 JVM 재빌드를 부릅니다. 그래서 편집문은 접두사 기록을 ADR 과 `wishlist/CLAUDE.md` 로 옮겼습니다.
- ③ 허브가 「이동 직전에」 상태를 남기려면 `FavoriteButton` 이 이동하기 전에 허브를 부를 길(예: `onBeforeLogin` prop)이 필요한데, 스펙에도 리뷰에도 그 방식이 없습니다. 구현 때 정하면 됩니다.
- ④ blog 호스트는 FE 에 `/c/*`(분류) 라우트를 쓰지만 apex 운영에서는 꺼져 있고(`App.tsx:184`) 인그레스도 호스트별이라 충돌하지 않습니다. 다만 로컬 단일 origin 개발에서는 `/c` 가 겹칩니다.

판정 대상 파일:
- `/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl/docs/specs/2026-10-09-place-return-share-events/spec.md`
- `/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl/docs/adr/ADR-0107-wishlist-collection-share-links.md`