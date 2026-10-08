# Engineer Review — domain (1라운드)

- 대상: `docs/specs/2026-10-09-place-hreflang-feed-indexnow/spec.md`
- 체크리스트: `hns/0.15.1/.../reviewers/domain/checklist.md` (0.16.1 경로 없음)

## Findings

### D1. 「같은 장소」가 코드의 `SamePlace` 와 다른 뜻으로 쓰인다 (용어 충돌)
- 스펙: `spec.md:7`(「같은 장소일 때만 hreflang」), `spec.md:14`(「같은 장소」로 판정된 쌍)
- 코드: `search/domain/.../SamePlace.kt:3-5,9-13` — `SamePlace` 는 **같은 언어** 안에서 원천이 한 장소를 두 번 올린 「다른 등록」이다. 색인·응답 필드 `samePlace` 로 이미 나간다(`AttractionIndexDocument.kt:146`, `SearchAttractionUseCase.kt:156`).
- 영향: 국·영 짝을 「같은 장소」라 부르면 구현자가 `SamePlaceGrouper` 를 확장하거나 `samePlace` 에 섞을 위험이 있다.
- 수정안: 스펙 전체에서 「언어 대체 짝」(필드 `alternateId`)으로 통일하고, 「`samePlace`(같은 언어의 중복 등록)와 다른 개념」을 SR-1 에 한 줄 적는다.

### D2. 용어집이 없다
- `place/glossary.md` 없음, `search/glossary.md` 에 관광지 용어 없음(Attraction·SamePlace 검색 0건). `docs/context-map.md:18-33` 에 place 행이 없다.
- 새 용어: 언어 대체 짝(`alternateId`), 본문 해시(`content_hash`), 본문 변경 시각(`contentUpdatedAt`) — 원천 수정일(`sourceModifiedAt`)·`attractions.updated_at`(`place/CLAUDE.md:35-36`)과 구분이 필요하다.
- 수정안: 구현 후 `/hns:glossary` 로 place BC 용어집을 만들고 세 시각(원천 수정일 · 행 갱신 시각 · 본문 변경 시각)의 정의를 넣는다. 스펙에는 SR-2 첫 줄에 세 시각의 차이를 한 줄로 둔다.

### D3. 불변식 「본문이 바뀔 때만 시각이 바뀐다」의 범위가 덜 정의됐다
- 스펙: `spec.md:18-19`
- 코드:
  - `syncFrom` 은 보강 필드를 `?:` 로 병합한다(`place/domain/.../Attraction.kt:364-405`). 들어온 레코드(`source`)로 해시를 내면 목록 동기화(개요 없음)와 개요 백필(개요 있음)이 번갈아 다른 해시를 만든다. **병합 뒤의 자기 상태**로 계산한다고 적어야 한다.
  - `syncFrom` 은 「들어온 값으로 전부 덮는」 모양이다(`Attraction.kt:329-407`, `place/CLAUDE.md:84-92`). 새 두 필드는 **source 에서 받지 않는다**(자기 계산값)는 것을 명시해야 bulk DTO 경로가 null 로 덮지 않는다.
  - 새 행은 `syncFrom` 을 지나지 않는다(`AttractionRepositoryAdapter.kt:35-37` → `fromDomain(incoming)`). 새 관광지의 해시·시각 규칙이 없다 — 그대로면 다음 동기화의 「첫 채움」으로 처리돼 새 URL 이 IndexNow·RSS 에 영영 안 나간다.
  - 시각원: 도메인은 `LocalDateTime.now()` 를 직접 쓴다(`Attraction.kt:82`). 불변식을 순수 테스트하려면 `syncFrom(source, now)` 처럼 시각을 받아야 한다(테스트 규칙: 도메인 Mock 금지, `docs/standards/test-rules.md:11`).
- 수정안: SR-2 에 「(a) 해시는 병합 뒤 상태로 (b) 두 필드는 source 에서 복사하지 않음 (c) 생성 시 해시 계산 + `content_updated_at = now`(새 URL 은 변경으로 센다) 또는 `source_modified_at` 중 하나로 결정 (d) 시각은 인자로 받는다(KST)」를 넣는다.

### D4. 「화면에 나가는 본문」 필드 목록이 화면과 다르다
- 스펙: `spec.md:19`(제목·개요·주소·요금·이용시간·휴무·주차·전화·대표 사진)
- 코드/문서: 행사 일정은 상세 본문의 주요 절이다(`ADR-0103-…:86` — 행사 「일정·상태 문구」 절). 상세는 `introRaw` 의 유형별 키도 그린다(`AttractionPageRenderer.kt:756` `IntroKey(...)`). 행사 페이지는 날짜가 가장 자주 바뀌는 값인데 목록에 없다.
- 수정안: `eventStartDate`·`eventEndDate` 를 더하고, `introRaw` 는 「렌더가 쓰는 키만」 또는 원문 정규화 통째 중 하나로 정한다. 목록은 상수 하나로 두고 테스트가 그 상수를 쓴다.

### D5. 경계 — OK
- 짝 판정은 search 읽기 모델에서, 본문 시각은 place SSOT 에서, 송신은 place-ingest 에서 — 서비스 간 DB 공유 없음. `alternateId` 는 같은 색인 안의 문서 id 참조라 집계 경계 위반이 아니다.

## 체크 항목
| 항목 | 결과 |
|---|---|
| BC 경계 | OK (D5) |
| 용어집 존재 | 없음 — D2 (REVISE) |
| 스펙 어휘 ↔ 용어집 | 신규 용어 3 — D2 |
| Avoid 동의어 | 용어집 없음 — 해당 없음 |
| 코드와 어휘 일관 | D1 |
| 집계 불변식 명시·강제 | D3·D4 |
| 도메인 이벤트 | 없음(배치) — 해당 없음 |
| 교차 집계 참조 | OK |
| VO/엔티티 분류 | 해시·시각은 Attraction 속성 — OK |

VERDICT: REVISE
