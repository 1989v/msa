# 2라운드 심판 (2026-10-08) — keep 26 / demote 0 / dismiss 0

심판 에이전트(`hns:review-verdict`)가 6개 차원의 2라운드 발견 전건을 판정했다. 기각·강등 후보 없음 — 인용 전부 실측 일치. 아래는 심판 보고를 메인이 그대로 옮긴 것이다(판정 원문은 세션 메시지).

## §1 묶음별 판정

| 묶음 | 차원 | 판정 | 핵심 근거 |
|---|---|---|---|
| G1 `overlay` 트리거 발화 불가 | domain R2-1 · impl N1 · usecase N1 | keep REVISE | `PlacePage.tsx:305` query 의존에 overlay 없음, 오버레이는 별도 useQuery(`:686`, mapView 는 idle 마다 갱신) |
| G2 planning 문서 1라운드 이전 잔재 | security A · domain R2-3 · impl N3 · test N-1①·N-7 | keep REVISE | `requirements.md:25` 가 `keyword` 를 지시 — `AnalyticsStreamTopology.kt:131` 이 그 키를 읽는다 |
| G3 찜 둘째 토글 유실 서술 | domain R2-2 · arch B4 · impl N7 · test N-6 · usecase 메모② | keep REVISE | `tracker.ts:24` 키에 payload 없음 → 같은 view 의 둘째 FAVORITE CLICK 은 방향 무관 유실 |
| G4 어댑터 테스트 기대값이 상수에서 옴 | test N-4 · impl N4 | keep REVISE | `ClickHouseAttractionPopularityAdapterTest.kt:57` 선례처럼 상수 보간 기대값은 상수를 비워도 초록 |
| G5 PAGE 대상 sectionId 타입 | arch B1 · domain R2-5 · impl N2 | keep REVISE | `events.ts:48` 필수 타입. 선택화는 목록 호출처 누락을 통과시켜 SR-8 거부 목록을 지나친다 |
| G6 SESSION_START screenRef 값 미정 | arch 주의② · impl N2 · test N-5⑤ | keep MINOR | `sidoCode` 는 `selectRegion(:425)` 만 채움 → 마운트 시점 항상 빈 값 |
| G7 제외 목록 상수 이름·위치 | domain R2-4 · arch 주의① | keep REVISE | MAP_OVERLAY 도 목록 밖인데 집계 포함 → 「NON_LIST」는 기준을 틀리게 말한다. 어댑터가 application 상수를 읽는 선례 `CollectEventsUseCase.ANONYMOUS_VISITOR` |
| arch B2 집계표 뜻 변경 문서 | architecture | keep REVISE | 소비자 둘(place-ingest `popularity.py`, search `ClickHouseClickSignalReader.kt:38`) 실존 |
| arch B3 ADR-0095 `:63` screen_ref 정의 | architecture | keep REVISE | 「목록 화면이면 NULL」 원문과 어긋남 |
| arch B5 Q4 근거 오류 | architecture | keep REVISE | 소비자는 비율을 계산하지 않는다(`popularity.py:70` sum 정렬, V007 노출은 순위 신호 아님) |
| arch A2 잔여 Goal 문구 | architecture | keep MINOR | 허브 SEARCH 는 여전히 `unknown` 키 searchCount 를 올린다 |
| arch 1R 메모(마커 리스너 viewId ref) | architecture | keep MINOR | `:603` 마커 effect 가 viewId 클로저면 viewId 마다 재생성 |
| security B Q12 누락 | security | keep REVISE | spec Out of Scope 에는 있고 Q12 에 없음 |
| test N-1 ②③ 금지 키 부정 단언 | test-strategy | keep REVISE | SEARCH 전부가 키워드 브랜치를 지난다(`:126`) |
| test N-2 mock 경계 충돌 | test-strategy | keep REVISE | `vi.mock` 호이스트 — `PlacePage.test.tsx:14`·`RegionPage.test.tsx:15` |
| test N-3 MockMvc UA 부재 | test-strategy | keep REVISE | `CrawlerUserAgents.kt:45` UA 없음 = 크롤러 → 202/0 |
| test N-5 ①~④ AC 잔여 | test-strategy | keep REVISE | 수정키(`:1349`)·자동완성(`:848`)·핀(google.maps 필요)·`'*'` |
| test N-8 실행 함정 | test-strategy | keep MINOR | `retry: 3`(`:319`) 이 클라이언트 `retry:false` 를 덮음 |
| test R-1 잔여 대역 viewId 단언 | test-strategy | keep MINOR | prop 존재만 보면 다른 viewId 도 초록 |
| impl N5 핸들러 누락 11곳 + trigger undefined 게이트 | implementation | keep MINOR | 인용 전부 일치 |
| impl N6 가운데 클릭 | implementation | keep MINOR | `onClick` 뿐, `auxclick` 은 안 옴. onAuxClick 선례 0건 |
| impl N8 standalone advice | implementation | keep MINOR | 선례 `AttractionSearchControllerTest.kt:22` |
| usecase N2 비율 분자·분모 불일치 | usecase | keep REVISE | initial view 는 카드가 그려짐(`:1192`), 자동완성 패널은 선택 CLICK 없음 |
| usecase 메모① 뽑기·이곳 보기 | usecase | keep MINOR | `:968` useQuery 밖 직접 호출 |
| usecase 메모③ 같은 검색어 재제출 | usecase | keep MINOR | `:857` 같은 값이면 query 불변 |
| domain 메모 Q8 에 `Placement.kt:13` | domain | keep MINOR | common 주석도 「목록 화면이면 빈 문자열」 |

## §2 상충 결정 5건

| # | 상충 | 결정 | 근거 |
|---|---|---|---|
| ① | overlay 제거(a) vs 오버레이 도착 시 SEARCH 섹션 MAP_OVERLAY(b) | **a 제거** | SR-10 은 「view 하나 = SEARCH 한 행 = trigger 하나」 위에 서 있다. b 는 한 view 에 두 행. 화면도 오버레이 칩을 필터와 갈라 둔다(`:1056-1057`). 오버레이 사용은 MAP_OVERLAY 핀 CLICK 이 말한다. `lang`·`other` 를 어휘에 더해 건수 분모에서 뺀다 |
| ② | SR-10 비율: 자동완성 CLICK 전송 vs 분자를 선택 튜플로 제한 | **view 단위 선택률 + 튜플 제한, SR-3.1 유지** | 자동완성 CLICK 은 아직 없는 viewId 에 붙여야 해 규칙이 하나 더 생긴다. 질의 제한은 FE 변경 0. 결과 view 집합은 「landing 만 뺀 전부」 — page 를 빼면 같은 결함 재발 |
| ③ | 상수 이름·위치 | **`POST_SELECTION_SECTIONS`, `AggregateAttractionPopularityUseCase.companion`, `val Set<String>`** | 기준 문장 「선택 뒤 후속 행동」과 이름이 같아야 한다. 선례 ANONYMOUS_VISITOR. 어댑터 `INSERT_DAY` 는 `private val` |
| ④ | PAGE sectionId: 판별 합집합 vs 선택화 vs 한 값 통일 | **판별 합집합 `PlacedItem \| PageItem(sectionId?: never)`** | 선택화는 fail-open, 한 값 통일은 ADR-0095 §2 섹션 뜻 위반. 선례 `shopApi.ts:110-111`. 루트 규칙 「잡히게보다 쓸 수 없게」 |
| ⑤ | 가운데 클릭: onAuxClick vs 수정키 좌클릭만 | **수정키 좌클릭만** | 선례 0건, Goal 에 불필요(YAGNI). Out of Scope 에 명시 |

사용자 판단이 꼭 필요한 항목: 없음. ①·④ 는 기본 권고로 진행하고 최종 보고에 결정으로 명시한다.

## §3 편집 적용

spec.md(21항) · requirements.md(9줄) · test-quality.md(2줄 + 2라운드 절) · open-questions.yml(Q4·Q8·Q12 갱신, Q13 신설) — 2026-10-08 메인 세션이 그대로 반영. 참고: 심판·리뷰어 모두 `skills/spec-review/references/review-protocol.md` 가 0.16.1 캐시에 없다고 보고 — 심각도는 `SKILL.md` 의 SHIP/REVISE/BLOCK 정의로 판정.
