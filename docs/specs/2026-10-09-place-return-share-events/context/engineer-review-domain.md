# Engineer Review — domain (1라운드)

- 대상: `spec.md`, `docs/adr/ADR-0107-wishlist-collection-share-links.md`
- 대조: `wishlist/CLAUDE.md`, `wishlist/glossary.md`, `docs/context-map.md`, ADR-0074 · ADR-0080 · ADR-0106, wishlist 코드, `portal-fe/src/analytics/events.ts`, analytics `AggregateAttractionPopularityUseCase`

## 체크리스트 판정

| # | 항목 | 판정 |
|---|---|---|
| 1 | BC 경계 | 통과(조건부) — 공유는 wishlist 안, 짧은 주소 해석도 대상을 가진 도메인이 맡는다(ADR-0106:33-37 와 일치). 다만 공개 읽기 경로가 새로 생기는데 그 사실이 BC 규칙 문서에 반영돼 있지 않다 → R8 |
| 2 | glossary 존재 | 있지만 낡음 → R6 |
| 3 | 스펙 어휘 ↔ glossary | 신조어가 등록돼 있지 않다 → R6 |
| 4 | Avoid 동의어 | 통과 — glossary 의 `Avoid: Favorite, Bookmark (의미 분화 시)`(`wishlist/glossary.md:26`)는 조건부다. 스펙 산문은 「찜」만 쓰고, `FavoriteButton` 등은 기존 FE 식별자(ADR-0074:67)를 인용한 것이다 |
| 5 | 스펙 ↔ 코드 용어 일관 | 문제 있음 → R1 · R2 · R7 |
| 6 | 불변식 명시·강제 가능 | 문제 있음 → R3 · R4 |
| 7 | 이벤트의 소속 | 문제 있음 → R5 |
| 8 | 애그리거트 간 직접 참조 | 통과 — `collection_share` 는 `collection_id`·`member_id` 를 id 로만 갖는다(ADR-0107:10) |
| 9 | VO / Entity 분류 | 통과 — 토큰은 값, 공유 링크는 수명주기(생성·폐기·만료)를 가진 엔티티다 |

## 이슈 (REVISE)

**R1 [#5] 저장 의도의 식별자에 `targetType` 이 빠져 있다**
- 스펙: 「저장 의도(`targetKey`, 만든 시각)」(`spec.md:12`)라고 쓰고, 복귀 뒤 PUT 을 한 번 보낸다(`spec.md:14`).
- 근거: 찜 대상의 식별자는 `(targetType, targetKey)` 쌍이다. `targetKey` 는 타입 안에서만 유일하고 그 밖에서는 불투명한 문자열이다(`wishlist/CLAUDE.md:29-32`, ADR-0074:17-22). PUT 경로에도 타입이 들어간다(`WishlistController.kt:40`). `FavoriteButton` 은 type 을 prop 으로 받고(`FavoriteButton.tsx:62-63`), 상점·게임·블로그에서 함께 쓰인다(`FavoriteButton.tsx:45`). 따라서 키만 남기면 복귀한 화면이 어떤 타입으로 PUT 을 보낼지 정할 수 없다.
- 수정: 저장 의도를 `{targetType, targetKey, createdAt}` 으로 바꾼다. SR-1.3 의 「대상」을 이 쌍으로 정의하고, SR-4.1 테스트에 「타입이 다른 의도는 무시하거나 그 타입으로 PUT 한다」를 추가한다.

**R2 [#5] 공개 응답 항목에 `targetType` 이 없고, `addedAt` 이라는 새 용어가 쓰였다**
- 스펙: `{name, items:[{targetKey, addedAt}]}`(`spec.md:20`), 「항목(대상 키 목록)」(ADR-0107:11).
- 근거:
  - 묶음 스키마는 타입을 가리지 않는다(ADR-0080:76-81). 묶음에 넣는 UI 가 관광지에만 열려 있을 뿐이다.
  - 수신자 카드는 `hydrate(type, key)` 로 그린다(`FavoritesPage.tsx:63`).
  - 기존 응답은 `createdAt` 을 쓴다(`WishlistController.kt:205-211`). 이 값은 「찜한 시각」이고, 묶음에 넣은 시각은 저장되지 않는다(`WishlistService.kt:127` 의 `moveTo` 는 시각을 남기지 않는다). 그래서 `addedAt` 이라고 부르면 저장되지 않은 의미를 약속하게 된다.
- 수정: `items:[{targetType, targetKey, createdAt}]` 로 바꾼다. 관광지만 내보내려면 「ATTRACTION 만 반환」을 불변식으로 적는다.

**R3 [#6] 「한 묶음에 살아 있는 링크는 하나」를 강제할 수단이 없다**
- 스펙: ADR-0107:10 은 이 불변식을 선언한다. 그런데 스키마에는 `token` 유일 인덱스와 `collection_id` 일반 인덱스만 있다(`spec.md:19`). 그래서 동시에 들어온 POST 두 건이 살아 있는 행 둘을 만들 수 있다.
- 수정: 강제 방식을 스펙에 적는다. 예를 들면 두 가지다.
  - 한 트랜잭션에서 묶음 행을 `FOR UPDATE` 로 잠근 뒤 기존 링크를 폐기하고 새 링크를 넣는다.
  - 살아 있는 행에만 값을 갖는 생성 컬럼에 유일 제약을 건다.
- SR-4.2 에 「동시 생성 시 살아 있는 링크 1개」 테스트를 넣는다.

**R4 [#6] 묶음 삭제·회원 탈퇴 때 링크를 폐기하는 경로가 정해져 있지 않다**
- 스펙: 「묶음을 지우면 링크도 폐기된다」(ADR-0107:13). 그런데 SR-2.1(`spec.md:19`)에는 FK 도 서비스 처리도 적혀 있지 않다.
- 근거:
  - 묶음 삭제는 행을 실제로 지운다(`WishlistRepositoryAdapter.kt:95-97`).
  - 회원 탈퇴는 찜 항목만 지운다(`MemberEventConsumer.kt:32` → `WishlistRepositoryAdapter.kt:68-69`). 묶음은 남는다. `WishlistCollectionJpaRepository.kt:10` 의 `deleteAllByMemberId` 는 선언만 있고 호출하는 곳이 없다.
  - 결과적으로 탈퇴한 회원의 공유 링크가 묶음 이름과 빈 항목을 계속 공개한다.
- 수정:
  - SR-2.1 에 `collection_share.collection_id` FK 를 `ON DELETE CASCADE` 로 할지, 서비스가 `revoked_at` 을 기록할지 정해 적는다.
  - `member.withdrawn` 처리에 「공유 링크 폐기(또는 삭제)」를 추가한다.
  - SR-4.2 에 두 경로 모두 404 가 나는지 확인하는 테스트를 넣는다.

**R5 [#7] 묶음 공유 `SHARE` 이벤트가 어느 대상에 속하는지 정해져 있지 않다**
- 스펙: 묶음 공유를 만들거나 복사하면 `CLICK` + `SHARE` 를 보낸다(`spec.md:28`, ADR-0107:16). 동시에 EntityType 은 늘리지 않는다(`spec.md:30`).
- 근거:
  - `EntityType`·`ScreenType` 에는 묶음도 찜 화면도 없다(`events.ts:3-20`).
  - `PlacedItem` 은 `entityType`·`entityId`·`screenType` 이 필수다(`events.ts:51-57`).
  - `POST_SELECTION_SECTIONS` 는 관광지 인기 집계를 위한 집합이다(`AggregateAttractionPopularityUseCase.kt:26-31`). 그런데 묶음 공유는 관광지를 「선택한 뒤의 행동」이 아니다.
- 수정: 묶음 공유 이벤트의 `entityType`/`entityId`/`screenType` 을 명시한다. 예를 들어 `PAGE` + 묶음 화면 경로와 `ScreenType` 추가(`FAVORITES`)로 할 수 있다. 그리고 SR-3.3 에 「POST_SELECTION 제외는 관광지 상세 공유에만 의미가 있다」를 적는다. 묶음 id 를 이벤트 원장에 넣을지도 결정해 적는다(개인 자료 식별자).

**R6 [#2·#3] wishlist glossary 가 상품 전용 시절에 머물러 있고 신조어가 등록돼 있지 않다**
- 근거: 현재 정의는 「(memberId, productId) unique, 도메인 모델은 WishlistItem 하나뿐」이다(`wishlist/glossary.md:10,18-23`). ADR-0074 의 다형 대상과 ADR-0080 의 여행 묶음(`WishlistCollection`)이 반영돼 있지 않고, 이번 스펙의 신조어도 없다. 신조어는 공유 링크(`collection_share`), 토큰, 폐기, 만료, 열람 원장, 저장 의도, 화면 상태다.
- 수정: 스펙이 확정된 뒤 `/hns:glossary` 를 실행하고, 위 용어마다 `/hns:glossary --conflict {term}` 를 돌린다.

**R7 [#5] 같은 개념을 두 단어로 부른다 — 「취소」와 「폐기」, 두 가지 「원장」**
- 근거:
  - Goal 은 「공유·취소」(`spec.md:7`), ADR 절 제목은 「취소·만료」(ADR-0107:13)다. 반면 본문과 열 이름은 「폐기」/`revoked_at` 이다(ADR-0107:10,13).
  - 「원장」은 BC 마다 뜻이 다른 단어로 이미 등록돼 있다(`docs/context-map.md:62`). 그런데 스펙은 이벤트 원장과 열람 원장을 모두 그냥 「원장」이라 부른다(`spec.md:7,24`).
- 수정: 「폐기」로 통일한다. 「원장」은 항상 「이벤트 원장」 또는 「열람 원장」으로 주어를 붙인다.

**R8 [#1] 공개 읽기 경로가 BC 규칙 문서와 어긋나고, 짧은 주소 해석이 실패했을 때의 동작이 ADR-0106 과 다르다**
- 근거:
  - wishlist 규칙은 「목록·추가·삭제는 로그인 전용, 대상별 찜 수 조회만 공개」다(`wishlist/CLAUDE.md:38`, ADR-0074:36 「전부 `X-User-Id` 필수」). 공유 열람은 두 번째 공개 읽기 경로인데, 스펙의 산출물 목록에 이 문서들의 갱신이 없다.
  - ADR-0106 은 해석에 실패하면 서비스 목록으로 302 한다(ADR-0106:38). ADR-0107:14 는 토큰 해석에 실패했을 때의 동작을 말하지 않고, 스펙은 설정이 꺼졌을 때만 404 로 정했다(`spec.md:22`).
- 수정:
  - SR-2 에 `wishlist/CLAUDE.md` 의 Key Rules 와 API 표 갱신을 추가한다.
  - 설정이 켜진 상태에서 `/c/{token}` 이 잘못된 토큰을 받으면 무엇을 할지 정해 ADR-0107 §5 에 적는다. 선택지는 「항상 `/shared/{token}` 으로 302 하고 그 화면이 404 를 그린다」와 「ADR-0106 처럼 목록으로 302 한다」다. 다르게 가면 그 이유도 적는다.

## 요약
BLOCK 사유는 없다. Avoid 동의어를 쓰지 않았고, glossary 와 뜻이 다른 용어도 없다. 다만 다음 세 가지는 구현 전에 스펙에 확정해야 한다.
- 찜 대상의 식별자(R1·R2)
- 공유 링크의 불변식을 무엇으로 강제하는가(R3·R4)
- 이벤트가 어느 대상에 속하는가(R5)

VERDICT: REVISE
