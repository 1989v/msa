# 3라운드 심판 (2026-10-08) — test-strategy N3-1~N3-4 · keep 0 / demote 4 / dismiss 0

판정자 `hns:review-verdict`(읽기 전용이라 메인이 저장). 대상: `engineer-review-test-strategy.md` 「3라운드」 절. 다른 5차원은 3라운드 SHIP.

판정 축: SR-1~8·SR-10 의 **결정 문장**이 바뀌어야 닫히면 REVISE, 결정은 그대로이고 검증 문장(SR-9·`planning/test-quality.md`·tasks)만 더하거나 바꾸면 MINOR. 2라운드 심판이 같은 축으로 「impl N5 trigger undefined 게이트」·「test R-1 대역 viewId 단언」·「test N-8 실행 함정」을 MINOR 로 둔 선례(`review-verdict-round2.md`)를 따랐다.

| 발견 | 판정 | 근거 요약 |
|---|---|---|
| N3-1 `trigger` undefined 게이트가 빨개질 수 없다 | demote → MINOR | 안전망이 undefined 를 `other` 로 바꾸므로 게이트는 동어반복(루트 규칙 「안 물리는 검사는 없는 것보다 나쁘다」). 결정(어휘·안전망·ref 심기)은 불변. **spec.md SR-2.3 끝 문장과 SR-9.1 게이트 절은 추가가 아니라 대체**(`other` 금지 게이트) + 트리거 케이스 5(`area` 는 CDP) + 주입 1 |
| N3-2 MAP_LINK·FAVORITE IMPRESSION 부정 단언 없음 | demote → MINOR | `TrackedLink.tsx:25` 가 노출 동봉, 집계 `:55` 에 제외 없음. IO 대역 `show()` 가 전 대상에 발화하므로 「지도 링크 → TrackedLink」 주입이 실제로 빨개진다. 순수 추가 |
| N3-3 screenRef 합성(시도+시군구) 단언 없음 | demote → MINOR | 허브 `sigunguCode` 는 접두 뗀 값(`PlacePage.tsx:403`), 지역 페이지 screenRef 는 전체 코드(`RegionPage.tsx:280`) — `'110'`·`'11110'` 어느 구현도 초록. 순수 추가. NOTES ③ 주입(접두 제거 → `'110'`)도 채택 |
| N3-4 타입 게이트 빨간불 증명 없음 | demote → MINOR | 타입이라 되돌려도 어느 테스트도 안 빨개짐, `@ts-expect-error` 0건, `tsc -b` 가 `src` 전체를 봄(`compile-changed.sh:26`). `tracker.test.ts` 첫째 줄만 — **둘째 줄(PAGE+sectionId)은 기준선에서 Unused 라 넣지 않는다**(NOTES ①: `PlacedItem.entityType` 이 `EntityType` 전체라 그 리터럴이 `PlacedItem` 으로 컴파일됨) |

NOTES
- ① `PlacedItem.entityType` 을 `Exclude<EntityType,'PAGE'>` 로 좁히면 둘째 줄도 살지만 SR-6.1 결정 손질이라 메인이 **채택하지 않음**(KISS — 목록 호출처의 sectionId 누락만 막으면 이번 Goal 에 충분).
- ② `other` 안전망은 fail-open — 운영에서 ref 누락은 `other` 로 조용히 분모에만 들어간다. 메인이 SR-10 에 「ref 누락 점검」 행(`trigger='other'` 0건)을 **채택**.
- ③ N3-3 주입 한 건 — **채택**(SR-9.3 12건).

프로토콜 판단(메인): 재리뷰 2회 소진 뒤의 REVISE 는 BLOCK 으로 취급해야 하나, 심판이 전건을 MINOR 로 강등해 결정 문장 변경이 없으므로 test-strategy 차원은 **SHIP(MINOR 반영)** 으로 집계하고 추가 재리뷰 없이 tasks 로 간다. 사용자 「이어서 마지막까지」 지시 아래 세션이 내린 판단이며 최종 보고에 명시한다.
