# Spec — tech 드릴다운 (`/tech/search` 재설계)

- ADR: `docs/adr/ADR-0108-tech-concept-drilldown.md`
- 화면 승인본: 아티팩트 「검색 아키텍처 드릴다운」 v4 — 구조 · 문구 · 탭 · 상세보기 동작의 기준
- 결정(사용자, 2026-10-12): 상태는 온톨로지 필드 · 온톨로지 재구성 · 메인은 아틀라스 첫 화면 카드 · 이력서는 검색 프로젝트 항목에 링크

## 목표

`/tech/search` 를 온톨로지 데이터에서 규칙으로 그린 드릴다운 다이어그램으로 바꾼다. 첫 그림은 검색 일반 파이프라인이고,
노드를 누르면 아래에 그 단계의 상세 다이어그램과 [개념] [현재 적용 상태] [코드] 탭이 열린다. 같은 장치를 다른 도메인이
화면 코드 없이 쓸 수 있어야 한다.

## SR-1 온톨로지 스키마 확장 (code-dictionary)

1. 개념 선택 키 `applied`: `{ status: LIVE|PARTIAL|DISABLED|NONE, summary?: string, facts?: [{ label, value, key? }] }`.
   모르는 키 · 상태값은 리더가 거부한다(기존 규칙과 같다).
2. 관계 맵 형식에 선택 키 `label`(짧은 간선 글자). `flows_to` 에만 의미가 있다.
3. 도메인 모델 `OntologyConcept.applied`, `OntologyRelation.label`. DB 적재(로더)는 두 필드를 쓰지 않는다 — 스키마 변경 없음.
4. `manifest.yaml` revision 올림(내용 해시 규칙).

## SR-2 검색 도메인 재구성 (`search.yaml`)

`search-query` 의 직속 자식은 흐름에 오르는 단계만 둔다.

| 순서 | 개념 | 비고 |
|---|---|---|
| 1 | `srch-query-input` 사용자 검색 (신규 STAGE) | `srch-autocomplete` 를 옮겨 담는다 |
| 2 | `srch-query-reformulation` 쿼리 리포뮬레이션 (신규 STAGE) | QU 에서 `srch-spell-correction` · `srch-query-rewriting` · `srch-query-expansion` 이동 |
| 3 | `query-understanding` | `search-lexicon` 을 담는다. 자식 장치에 표준 순서 흐름 |
| 4 | `candidate-generation` | 신규 STAGE `srch-sparse-retrieval`(bm25 · tf-idf · 불리언 · 학습형 스파스 · 질의 작성 · 점수 조정) · `srch-dense-retrieval`(쿼리 임베딩 · ann · 늦은 상호작용) |
| 5 | `rank-fusion` | 그대로 |
| 6 | `post-ranking` | 그대로(리랭킹 · 후처리) |
| 7 | `srch-zero-result-handling` 0건 대응 (신규 STAGE) | QU 에서 `srch-zero-result-recovery` · `srch-zero-result` · `srch-zero-result-rate` 이동 + 새 장치(사유 안내 · 어휘 일치 검증 · 필터 해제 제안 · 쿼리 완화) + `srch-bm25-fallback` 공동 부모 |
| 8 | `srch-result-presentation` | `srch-aggregation` 을 담는다 |

- 흐름: 1→2→3→4→5→6→7→8. `query-embedding → candidate-generation` 흐름은 `query-embedding → ann-search` 로 바꾼다(공유 부모 규칙 ⑥).
  `srch-relevance-tuning → post-ranking` 흐름은 지운다(점수 조정은 스파스 검색 안).
- 기존 개념의 `kind` 는 바꾸지 않는다 — 들어오는 USES · ALTERNATIVE_TO 가 kind 에 묶여 있다.
- 드릴다운에 그려지는 모든 개념(SR-3 규칙으로 깊이 3까지)에 `applied.status`. LIVE · PARTIAL · DISABLED 는 `summary`, 코드가 있으면 `code`.
- 값은 코드에서 읽는다. 기존 `/tech/search` 문서 §4 의 12개 대조 값은 `facts[].key` 로 옮긴다.

## SR-3 그리는 규칙 (ADR-0108 R1~R5)

- R1 개념 X 의 그림 노드 = 자식 중 `STAGE` 이거나 형제와 `flows_to` 로 이어진 것. 나머지 자식은 「관련 개념」 목록(상태가 있으면 함께).
- R2 간선 = 그림 안 노드끼리의 `flows_to`, 글자는 `label`.
- R3 노드의 자식 중 `STAGE` 가 둘 이상이고 자식 사이에 흐름이 하나도 없으면 그 노드를 묶음 틀로 그리고 `STAGE` 자식을 나란히 펼친다. 묶음 틀 머리를 누르면 묶음 개념의 상세.
- R4 자식이 있는 노드에 [상세보기]. 깊이 3단계.
- R5 좌표 없음 — `flows_to` 위상 순서로 열, 같은 열은 위아래. 좁은 화면(< 640px)은 행·열을 바꾼다.

## SR-4 내보내기 (`DrillExportSpec`)

1. 대상 도메인 목록(이번엔 `search` 하나, 루트 `search-query`)을 스펙 안 상수로 둔다.
2. 출력 `portal-fe/src/content/drill/search.json` — 루트에서 깊이 3까지 개념: `id · name · kind · description · applied · code[] · children[] · flows[{to,label}]`.
   `code[]` 는 `{ path, symbol, note?, start, end, snippet }` — 파일에서 `symbol` 이 처음 나오는 줄부터 최대 12줄, 빈 줄에서 끊고 들여쓰기 제거.
   `evidence` 는 싣지 않는다(ADR-0108 결정 6).
3. 실패 조건: 커밋된 파일과 다름 · 그려지는 개념에 `applied.status` 없음 · 코드 파일 없음 · `symbol` 없음 · `facts[].key` 가 아는 키가 아님.
4. 다시 내보내기: `DRILL_EXPORT=write ./gradlew :code-dictionary:feature:test --tests '*DrillExportSpec' --rerun`.
5. 아틀라스 그래프(`AtlasGraphExportSpec`)도 다시 내보낸다.

## SR-5 화면 (portal-fe)

1. `render-content.mjs` 의 tech 단계: 마크다운 렌더 대신 `src/content/drill/search.json` 을 읽어 모양을 검사하고 `gitSha` 를 붙여
   `src/pages/tech/generated/search-drill.json`(gitignore)으로 쓴다. 배선 4곳(package.json · Dockerfile · CI · 훅)은 그대로.
2. `SearchArchitecturePage` 재작성 — 승인본의 구조와 문구: 1단계 그림 + 「관련 개념」, 펼친 단계(머리 → 상세 다이어그램 → 탭 3개), 접기,
   같은 노드 재클릭 접힘, 해시(`#<개념 id>`)로 펼친 경로 복원, 상태 범례(운영 중 · 일부 구현 · 비활성 · 미구현), k-heritage 토큰(hex 금지).
3. 코드 탭: GitHub 링크 `https://github.com/1989v/msa/blob/<gitSha|main>/<path>#L<start>-L<end>` + 줄 번호 스니펫.
4. 프리렌더(`renderTechSearchHtml`): 정적 HTML 에 루트 설명과 1단계 노드 이름 · 개념 설명 · 상태를 목록으로 — 크롤러가 본문을 읽는다.
5. 마크다운 원본 `src/content/search-architecture.md` 와 마크다운 렌더 테스트 중 tech 전용 부분, 드리프트 테스트의 표 파싱을 걷어낸다.
   드리프트 테스트는 같은 12개 값을 `search-drill.json` 의 `facts[key]` 와 대조한다.

## SR-6 게시

1. 메인: `/tech` 아틀라스 첫 화면 본문에 「검색 아키텍처」 진입 카드(제목 · 한 줄 설명 · `/tech/search`).
2. 이력서: 운영 DB 검색 프로젝트 항목 본문에 `https://1989v.com/tech/search` 링크 한 줄. **현재 본문과 바꿀 문안을 사용자에게 보여 승인받은 뒤** 어드민 API 로 반영.

## 검증

- Kotlin: `:code-dictionary:feature:test --tests '*DrillExportSpec' --tests '*AtlasGraphExportSpec' --tests '*Ontology*'`
- FE: 범위 vitest(드릴 렌더 · 드리프트 · 프리렌더 · 페이지 · 라우트), `tsc -b`, `vite build`
- 회귀 주입: 그려지는 개념 하나의 `applied` 삭제 → 내보내기 실패 / `facts` 값 변경 → 드리프트 빨강 / `symbol` 오타 → 내보내기 실패
- 화면: CDP 기기 × 사이트 4조합 — 펼침 3단계 · 탭 · 가로 넘침 0 · 콘솔 0(`docs/standards/fe-visual-verification.md`)
