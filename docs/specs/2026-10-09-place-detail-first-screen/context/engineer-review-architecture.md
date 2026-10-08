# Engineer Review — architecture (1라운드)

스펙: `docs/specs/2026-10-09-place-detail-first-screen/spec.md`
기준: `docs/conventions/package-structure.md`, ADR-0083, CLAUDE.md 외부 데이터 3규칙, 체크리스트 `reviewers/architecture/checklist.md`

## Seed Discovery
- 스펙 · `context/open-questions.yml`(Q1·Q2 모두 post-impl, 아키텍처와 무관)
- 코드: `AttractionAttributeParser.kt`, `AttractionSeoText.kt`, `AttractionApiReindexTasklet.kt:221-229`, `PlaceApiClient.kt:32-80,177-218`, `place/.../AttractionDtos.kt:136-188`, `AttractionController.kt:58-74`, `AttractionPageRenderer.kt:610-619,738-740`, `placeAttributes.ts:186-197`, `build.gradle.kts:552`

## 체크리스트 판정

| 항목 | 판정 | 근거 |
|---|---|---|
| 레이어 책임 분리 | 통과 | 파서 규칙은 `search:domain`(`AttractionAttributeParser.kt:24`), 렌더는 `search:app` infrastructure/render, 수집은 batch infrastructure — 스펙이 새 계층을 만들지 않는다 |
| 상향 의존 금지 | 통과 | 새 의존 방향 없음 |
| 외부 연동은 Port 경유 | 통과 | place 호출은 기존 `PlaceApiClient` 경로 그대로(SR-4) |
| 모듈 경계 변경 근거 | **REVISE (A1)** | SR-4 의 place 변경이 근거와 사실이 다르다 |
| 패턴 일관성 | **REVISE (A2)** | 요금 출처 규칙의 소유자가 정해지지 않았다 |
| 순환 의존 | 통과 | 없음 |
| 트랜잭션 경계 | 해당 없음 | 쓰기 경로 변경 없음 |
| 인터페이스 최소 · 패스스루 · 시임 | 통과 | 새 모듈·인터페이스 없음 → Deletion Test 대상 없음 |
| 필드 전달 경로 완결성 | **REVISE (A3)** | 전달 목록에 빠진 고리가 있다 |

## Findings

### A1. place API 변경은 불필요 — 이미 응답에 있다 (SR-4.1, SR-4.2)
- 스펙: SR-4.1 「place API(관광지 응답 DTO)에 `source`·`copyrightDivCd` 를 싣는다」, SR-4.2 배포 순서 「place(API 필드) → search:batch …」.
- 코드: 재색인이 부르는 `/api/places/attractions?afterId=` 는 `AttractionResponse.from` 으로 응답한다(`place/feature/.../AttractionController.kt:58-62`). `AttractionResponse` 는 이미 `source`(`AttractionDtos.kt:140`)·`copyrightDivCd`(`AttractionDtos.kt:159`)를 담는다. 빠져 있는 곳은 search 쪽 `PlaceApiClient.AttractionDto`(`PlaceApiClient.kt:35-80`)와 손 매핑(`PlaceApiClient.kt:177-218`)이다.
- 수정안: SR-4.1 을 「place 는 변경 없음. search:batch `PlaceApiClient.AttractionDto` 필드와 `fetchPageAfter` 의 수동 매핑 두 곳에 추가(`PlaceApiClient.kt:32-33` 경고 — 데이터 클래스에만 넣으면 null 로 색인)」로 고치고, SR-4.2 배포 순서에서 place 단계를 뺀다. Minimal Diff 와 배포 단위가 하나 줄어든다.

### A2. 요금 출처 규칙(반복정보 행 이름 3종)이 세 곳에 복제될 구조 (SR-2.2, SR-2.3)
- 스펙: SR-2.2 는 표시 규칙(useFee → infoRaw 「입장료·관람료·이용요금」 행), SR-2.3 은 같은 행을 파서 입력으로 쓴다. 표시는 SSR(`AttractionPageRenderer.kt:448-452`)과 FE(`placeAttributes.ts`) 양쪽에 있어야 한다. 결과적으로 행 이름 표와 공백 무시 규칙이 `search:domain` 파서 · `search:app` 렌더러 · portal-fe 세 벌이 된다. JSON-LD 와 달리 이 규칙에는 패리티 게이트가 없다(SR-3.6 은 JSON-LD 만 대상).
- 기존 경계: `AttractionAttributeParser.kt:6-9` 주석은 「요금·주차·휴무를 여기서 다시 찾으면 place 의 접기 규칙과 두 벌이 된다」며 요금 접기를 place 쪽 일로 정해 두었다. 스펙은 이 경계를 바꾸면서 근거를 적지 않았다.
- 수정안(택1, 스펙에 명시):
  1. **권장** — `search:domain` 에 요금 텍스트 함수 하나(useFee 우선, 반복정보 요금 행 폴백, `AttractionSeoText.sourceText` 1회)를 두고, batch 가 이 값을 **파생 필드**(예: `feeText`, keyword 아님 text/미색인)로 색인한다. 파서는 이 값을 입력으로 받고, SSR·FE 는 필드만 읽는다. 원천 `useFee`·`infoRaw` 는 그대로 남으므로 외부 데이터 3규칙 ②(파생 컬럼)와 맞고, 규칙이 한 곳에만 있다.
  2. place 에서 접기 — `useFee` 를 덮지 않는 별도 파생 컬럼으로. 이 경우 수집기·전체 동기화 필드 목록까지 손대야 해 범위가 커진다.
  어느 쪽이든 `AttractionAttributeParser.kt:6-9` 주석을 새 경계로 갱신한다고 적는다.

### A3. 색인 필드 전달 목록에 빠진 고리 (SR-4.1)
- 스펙은 `attractions-index.json` · `AttractionSearchDocument` · domain 모델 · FE `placeApi.ts` 만 적었다.
- 같은 필드가 실제로 지나는 곳(`parkingFee` 로 추적): `PlaceApiClient.kt`(A1), batch `AttractionIndexDocument.kt:57-63,220-226`, `AttractionApiReindexTasklet.kt:296-302`(문서 조립), `search:domain AttractionDocument.kt:49-56`, `AttractionSearchDocument.kt:189-195`, application `SearchAttractionUseCase.kt:93-99` 결과 · `SearchAttractionService.kt:238-244` 매핑. `verifySearchIndexContract`(`build.gradle.kts:552`)는 매핑 ↔ 문서 클래스 일치만 보므로 application 결과 · 서비스 매핑 누락은 게이트를 통과한 채 API 에서 null 로 나간다.
- 수정안: SR-4.1 에 위 경로를 열거하고, SR-5.1 에 「search API 응답에 `source`·`copyrightDivCd` 가 실린다」 단언(서비스 매핑 단위 테스트)을 추가, SR-5.5 회귀 주입에 「서비스 매핑 한 줄 삭제 → 빨강」을 넣는다.

## 참고(비차단, 판정 미반영)
- SR-2.5 의 `source` 표시명 매핑(TOURAPI/GOCAMPING → 문구)도 SSR(`AttractionPageRenderer.kt:738-740`)·FE(`placeAttributes.ts:191`) 두 벌이다. 기존 `sourceLine` 이 이미 두 벌 + 「같은 문구」 주석 관행이라 이번 범위에선 허용 가능하나, GOCAMPING 문서에서 `sourceLine` 의 「· 고캠핑」(`AttractionPageRenderer.kt:615`)과 겹치지 않게 「확인 상태」 칸과 바닥 출처 줄 중 어느 것을 바꾸는지 SR-2.5 에서 구분해 두면 구현이 덜 갈린다.

VERDICT: REVISE
