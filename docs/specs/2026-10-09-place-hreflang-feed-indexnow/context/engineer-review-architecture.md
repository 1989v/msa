# Engineer Review — architecture (1라운드)

- 대상: `docs/specs/2026-10-09-place-hreflang-feed-indexnow/spec.md`
- 체크리스트: hns 0.16.1 경로가 캐시에 없어 `hns/0.15.1/skills/spec-review/reviewers/architecture/checklist.md` 사용
- 근거 경로는 워크트리 루트 기준

## 판정 요약
레이어 배치는 대체로 맞다(짝 판정 = search 색인 시점, 본문 해시 = place SSOT, 외부 송신 = place-ingest). 다만 ADR 두 건과 정면으로 엇갈리는 결정을 개정 없이 두고 있고, 변경 ID를 ingest 가 받는 경로(포트/엔드포인트)가 비어 있다.

## Findings

### A1. ADR-0062 §8 「상세에 hreflang 을 걸지 않는다」를 뒤집는데 개정 대상에 없다 (Layer: 아키텍처 결정 일관성)
- 스펙: `spec.md:15`(SR-1.4 SSR·sitemap 에 hreflang), `spec.md:4`(ADR 은 ADR-0103 개정 한 줄만)
- 문서: `docs/adr/ADR-0062-seo-and-organic-discovery.md:136-138` — 「hreflang 을 걸지 않는다 … 짝을 알 수 없으므로」. 코드 주석도 같은 결정을 근거로 든다: `search/app/.../render/AttractionPageRenderer.kt:65`, `portal-fe/src/pages/place/AttractionPage.tsx:171-173`, `portal-fe/scripts/prerender-seo.mjs:707-708`.
- 수정안: ADR-0062 에 개정 블록을 둔다 — 「S1-8 판정 규칙을 통과한 일대일 짝에만」으로 범위를 좁혀 원 결정의 이유(짝을 모름)가 어떻게 해소됐는지 적고, 위 세 주석을 같이 고치는 것을 태스크에 넣는다.

### A2. place 에 파생 열을 두는 것이 ADR-0103 §4·대안 6 과 충돌 — 이유를 개정 블록에 남겨야 한다
- 스펙: `spec.md:4`, `spec.md:18`(attractions 에 `content_hash`·`content_updated_at`)
- 문서: `docs/adr/ADR-0103-place-attraction-server-render-enrichment.md:33-35`(파생값은 search 가 색인 시점에 계산, place 에 저장하지 않음), `:52`(「파생 속성을 place 컬럼으로 — 기각」)
- 판단: 이번 값은 이전 실행과의 비교라 **상태**가 필요하고, search 는 매일 새 색인을 만들어(`AttractionApiReindexTasklet.kt:89-92,337`) 이전 값을 들고 있지 않다. 그래서 place 에 두는 것은 맞다. 다만 「같은 문서 필드 확장」(`spec.md:4`)이라는 이유로는 기각된 대안을 되살리는 근거가 되지 않는다.
- 수정안: 개정 블록에 「본문 변경 시각은 상태 비교가 필요해 색인 시점 순수 함수로 만들 수 없다 — §4 의 예외」를 한 줄로 적는다.

### A3. ingest 가 「바뀐 관광지」를 어떻게 받는지 포트가 없다 (External integrations via Ports)
- 스펙: `spec.md:28`(content_updated_at 이 이번 실행 시작 이후인 관광지)
- 코드: ingest 는 place 를 HTTP 로만 본다(`place/ingest/src/place_client.py:14,72-93` — 전량 키셋 스캔뿐). bulk 응답은 건수만 준다(`place_client.py:96-105`, `AttractionRepositoryAdapter.kt:25-46` 의 `UpsertSummary(created, updated)`).
- 수정안: 둘 중 하나를 스펙에 명시한다. ① place 에 `GET /internal/attractions/content-updated?since=&afterId=&size=` (UseCase 인터페이스 + `AttractionRepositoryPort` 메서드 + 어댑터 — ADR-0083 레이어 표준, `place/CLAUDE.md:136-138` 의 `/internal/attractions/**` 관례) ② 전량 스캔 응답의 `contentUpdatedAt` 으로 클라이언트에서 거르기(6만 행 스캔). ①이 단순하고 DB 인덱스 하나면 된다.

### A4. 정규화 규칙 「`sourceText` 와 같은 규칙」은 서비스 경계를 넘는 지식 복사다
- 스펙: `spec.md:19`
- 코드: `sourceText` 는 search:domain 에만 있다(`search/domain/.../AttractionSeoText.kt:46`) — 그 자체가 copy.mjs 의 사본이고 패리티 테스트로 묶여 있다(`AttractionSeoText.kt:3-8`). place 는 search 를 import 할 수 없다(CLAUDE.md 「cross-reference 금지」).
- 판단: 해시는 place 가 자기 이전 값과만 비교하므로 search 규칙과 같을 필요가 없다. 「같은 규칙」이라 적으면 세 번째 사본과 패리티 의무가 생긴다(`place/CLAUDE.md:31-32` 가 임베딩에서 같은 함정을 기록).
- 수정안: 「place:domain 이 갖는 자체 정규화(태그 제거·엔티티 디코드·공백 접기). search 규칙과의 일치는 요구하지 않는다. 규칙을 바꾸면 해시 버전을 올려 첫 채움 경로로 처리」로 바꾼다.

### A5. 짝 판정의 위치 — 1차 투영 패스와 search:domain 순수 함수로 명시
- 스펙: `spec.md:12`(「search:batch 가 계산」)
- 코드: 2차 패스는 페이지 단위라 상대 언어 문서를 모른다(`AttractionApiReindexTasklet.kt:151-331`). 전량을 보는 곳은 1차 투영(`:391-418`)이고, 같은 성격의 `SamePlaceGrouper` 가 search:domain 순수 함수로 거기서 돈다(`SamePlace.kt:15-39`, Tasklet `:415`). 투영에는 `googlePlaceId` 가 없다(`RegionAggregator.kt:15-29`).
- 수정안: 「`RegionProjection` 에 `googlePlaceId` 를 더하고, search:domain 의 순수 객체(예: 언어 대체 짝 판정기)가 1차 패스의 전체 투영으로 계산 → 2차 패스가 `alternateId` 를 붙인다」로 명시. 투영 메모리 증가는 문서당 약 40B(6.5만 건 약 2.6MB)라 힙 256MB(`Tasklet:51`)에 무리 없다.

## 체크 항목
| 항목 | 결과 |
|---|---|
| 레이어 책임 분리 | 대체로 OK — A3·A5 명시 필요 |
| 상향 의존 금지 | OK |
| 외부 연동은 포트 경유 | A3 |
| 경계 변경 근거 | A1·A2 |
| 패턴 일관성 | A5(SamePlaceGrouper 선례 따르기) |
| 순환 의존 | 없음 |
| 트랜잭션 경계 | OK — 해시 계산은 기존 `upsertAll` 트랜잭션 안(`AttractionRepositoryAdapter.kt:24`) |
| 모듈 깊이 / Deletion Test | 새 모듈 없음. 짝 판정기는 여러 소비자(SSR·sitemap·FE)가 결과를 쓰므로 유지 가치 있음 |

VERDICT: REVISE
