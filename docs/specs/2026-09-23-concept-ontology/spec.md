# Specification: 개념 온톨로지 (concept ontology)

> 개정 1 (2026-09-23). 브레인스토밍 확정본. 현행 `concept_edge`(플랜 `docs/plans/2026-09-09-search-architecture-graph.md` §3) 위에 얹는다.
> 외부 제안(속성 그래프 기반 지식 그래프 + RDB 저장)과의 대조는 §9. 운영 실측은 §0.

## Goal

검색·백엔드 도메인 개념을 **노드 유형과 관계 어휘가 고정된 방향 그래프**로 적는다.
레포 안 파일 하나가 도메인 하나의 원본이고, 도메인 클래스가 공리를 검사하고, `/tech` 계층 탭과 문서 도식이 같은 파일에서 나온다.
새 저장소·새 파드·새 페이지는 없다. 온톨로지의 **논리 모델**(유형·관계·공리)만 가져오고 기술 스택(RDF·OWL·그래프 DB)은 가져오지 않는다.

## 0. 현재 위치 (운영 DB, 2026-09-23)

| 항목 | 값 |
|---|---|
| 개념 행 | 261 |
| 방향 간선 | 145 (CONTAINS 127 · FLOWS_TO 18 · SAME_AS 0) |
| 간선에 걸린 개념 | 102 (전부 검색 도메인, V22~V24) |
| 어느 간선에도 없는 개념 | 159 (재색인 추출분) |
| 두 부모를 가진 개념 | 26 — 그중 22 는 「장치가 용어를 쓴다」를 CONTAINS 로 적은 것 |
| 코드 참조(`concept_index`) | 0 |
| 관계 탭의 원천 `concept_relation` | 0 — 관계 모드는 운영에서 빈 그래프다 (이 스펙 밖, §8) |

지금 모델이 온톨로지가 아닌 이유 셋: 노드에 **유형이 없고**(층은 깊이로만 유도되어 용어 사전 가지가 장치와 같은 층에 놓인다),
CONTAINS 가 **구성·변종·사전 등재·사용** 네 뜻을 겸하고, 원본이 **불변 마이그레이션**이라 간선 하나를 고치려면 번호가 하나 는다(열흘에 V22→V24).

## User Stories

- 학습자로서, 개념 하나를 열면 그것이 어느 층에 있고, 무엇을 쓰고, 무엇에 영향을 주고, 무엇으로 재는지를 한 화면에서 보고 싶다.
- 저자로서, 도메인 하나를 파일 하나로 적고 PR diff 로 리뷰하며, 잘못된 간선은 테스트가 막아 주길 원한다.
- 독자로서, 블로그·플랜의 계층 도식이 손으로 옮긴 사본이 아니라 파일에서 나온 것이길 원한다.
- 나중의 나로서, 둘째·셋째 도메인(트랜잭션·메시징)을 같은 규칙으로 붙이고 싶다.

## Specific Requirements

### SR-1 노드 유형(kind) 7종

`concept.kind` 한 컬럼. 값은 아래 일곱으로 고정하고 여덟째는 이 스펙 개정으로만 는다.

| kind | 판정 질문 | 예 (현행 id) |
|---|---|---|
| `DOMAIN` | 무엇이 들어오나 — 루트와 진입점 | `search-system` · `search-ingest` · `search-query` · `search-evaluation` |
| `STAGE` | 무엇을 하나 | `candidate-generation` · `rank-fusion` · `judgment-set` · `search-ops-metrics` |
| `MECHANISM` | 무엇으로 하나 | `bm25` · `hnsw` · `rrf` · `alias-swap` · `propensity-logging` · `analyzer-customization-layers` |
| `TERM` | 읽는 데 필요한 말 (용어 묶음 포함) | `viterbi-algorithm` · `context-id` · `cosine-similarity` · `search-glossary` · `glossary-morphology` |
| `TECHNOLOGY` | 이름 붙은 구체물 — 제품·라이브러리·사전·말뭉치 | `mecab-ko-dic` · `sejong-corpus` · (신규) `opensearch` · `nori` |
| `PROBLEM` | 피하려는 상태 | `position-bias` · (신규) `empty-index-live` |
| `METRIC` | 재는 값 | `ndcg` · `recall-precision` · `latency-percentile` · `fallback-rate` · `cache-hit-rate` · `judgment-coverage` |

- `category`(주제 13종)와 `level`(난이도)은 그대로 둔다. kind 는 **역할** 축이라 둘과 직교한다 — `bm25` 는 category ALGORITHM · kind MECHANISM.
- 컬럼은 **NULL 허용**이고 NULL 은 「아직 어느 온톨로지 파일에도 놓이지 않음」이다. 재색인이 추출한 159 개념은 NULL 로 남고, 파일에 들어올 때 명시된다.
  간선의 양 끝은 kind 가 있어야 한다(SR-3 ②). **배치율 = kind 있는 개념 ÷ 전체**가 진척 지표다 — 지금 0/261, S1 뒤 102/261.
- 외부 제안의 `Concept·Technology·Mechanism·Pattern·Problem·Solution·Metric·Example` 여덟에서 `Pattern` 은 MECHANISM 에, `Solution` 은 MECHANISM + `MITIGATES` 간선에,
  `Example` 은 노드가 아니라 증거층(SR-5)에 흡수했다. 「해결책」을 유형으로 두면 재시도가 장치인지 해결책인지 매번 갈린다 — 역할은 간선이 진다.
- **kind 의 소유자는 온톨로지 파일뿐이다.** 재색인 경로(`/api/v1/index/sync` → `Concept.update()` · `ConceptJpaEntity.update()`)는 kind 를 읽지도 쓰지도 않는다.
  전체 동기화가 kind 를 NULL 로 덮으면 다음 부팅까지 층이 사라지는 무동작 사고가 된다.
- TECHNOLOGY 는 그것이 구현하는 **단계 아래에 놓고**(CONTAINS — 이것이 넷째 층 「구현」이다), 장치 단위 구현은 `IMPLEMENTS` 로 잇는다. 부모를 다시 IMPLEMENTS 로 적지 않는다(같은 지식 두 벌).

### SR-2 관계 어휘 10종

현행 셋은 뜻을 좁히고 일곱을 더한다. 관계마다 **허용 (from kind → to kind)** 가 있고 그 밖은 SR-3 이 거부한다.

| 관계 | 방향 | 역방향 라벨 | 허용 범위 | 답하는 질문 | 현행 데이터의 자리 |
|---|---|---|---|---|---|
| `CONTAINS` | 상위 → 하위 | PART_OF | DOMAIN→{DOMAIN, STAGE, TERM} · STAGE→{STAGE, MECHANISM, METRIC, PROBLEM, TECHNOLOGY} · MECHANISM→{MECHANISM, TECHNOLOGY} · TERM→{TERM} | 어디에 속하나 · 무엇으로 이뤄지나 | 127건 유지, 뜻은 **구성·배치**로만 |
| `FLOWS_TO` | 앞 → 뒤 | FOLLOWS | CONTAINS 부모를 하나 이상 공유하는 형제, kind 무관 | 다음 단계는 | 18건 유지 |
| `SAME_AS` | 대칭 | — | 같은 kind | 다른 이름의 같은 것(재색인 중복) | 0건 유지 |
| `USES` | 쓰는 쪽 → 쓰이는 것 | USED_BY | {STAGE, MECHANISM}→{TERM, MECHANISM, TECHNOLOGY} | 무엇을 쓰나 · 어디에 쓰이나 | 용어의 둘째 부모 CONTAINS **22건이 이것으로 바뀐다** |
| `IMPLEMENTS` | 구체물 → 개념 | IMPLEMENTED_BY | TECHNOLOGY→{STAGE, MECHANISM} | 무엇으로 구현했나 | 신규 — 블로그 표의 「이 서비스」 열(`nori` → `lattice-viterbi`·`user-dictionary`) |
| `AFFECTS` | 원인 → 지표 | AFFECTED_BY | {MECHANISM, TERM, TECHNOLOGY}→METRIC | 값을 바꾸면 무엇이 달라지나 | 신규 — `hnsw-parameters`→`recall-precision`, `vector-quantization`→(신규) `resident-memory` |
| `CAUSES` | 원인 → 문제 | CAUSED_BY | {MECHANISM, TERM, TECHNOLOGY, PROBLEM}→PROBLEM | 무슨 문제를 부르나 | 신규 — `index-rebuild`→`empty-index-live` |
| `MITIGATES` | 장치 → 문제 | MITIGATED_BY | MECHANISM→PROBLEM | 그 문제를 무엇이 막나 | 신규 — `alias-swap`→`empty-index-live`, `propensity-logging`→`position-bias` |
| `MEASURED_BY` | 대상 → 지표 | MEASURES | {STAGE, MECHANISM, PROBLEM}→METRIC | 무엇으로 재나 | 신규 — `candidate-generation`→`recall-precision`, `rank-fusion`→`ndcg` |
| `ALTERNATIVE_TO` | 대칭 | — | 같은 kind 의 MECHANISM · TECHNOLOGY | 대신 쓸 수 있는 것 | 신규 — 스파스↔덴스, `interleaving`↔`ab-test` |

- `AFFECTS` 와 `CAUSES` 는 **range 로 가른다**: 지표(값)를 바꾸면 AFFECTS, 문제(상태)를 부르면 CAUSES. 방향(↑↓)은 `reason` 에 적는다 — 「재현율 ↓ · 상주 메모리 32× ↓」.
- 대칭 관계는 **한 방향만 저장**하고 역방향 라벨은 코드(`ConceptEdgeKind.inverseLabel`)가 만든다. `relation_type` 표는 만들지 않는다 — range 검사가 코드에 있어야 하므로 표는 사본이 된다.
- `concept_edge.reason VARCHAR(500) NULL` 을 더한다. 관계의 「왜」 한 줄. `confidence`·`scope` 는 넣지 않는다 — 손으로 큐레이션한 간선은 신뢰도가 상수고, 범위는 도메인 루트가 준다.
- **보류한 관계와 재개 조건**: `REQUIRES`(선수 지식) 는 CONTAINS 깊이 순 + FLOWS_TO + USES 역방향으로 학습 경로가 나오므로 지금 넣지 않는다. 이 셋으로 못 적는 선수 관계가 **세 번째** 나오면 넣는다.
  `IS_A` 는 category + CONTAINS 가 덮는다. `TRADEOFF_WITH` 는 AFFECTS 두 줄 + reason 으로 적는다. `DEPENDS_ON`·`EXECUTED_ON`·`STORED_IN`·`HAS_PARAM` 은 USES 다. `MAY_CAUSE`·`PREVENTS`·`CONTRASTS_WITH` 는 각각 CAUSES·MITIGATES·ALTERNATIVE_TO 의 어조 차이다. `EXAMPLE_OF` 는 증거층이다.

### SR-3 공리 — `ConceptOntology.validate()` (도메인, 프레임워크 의존 없음)

파일 합집합을 받아 아래를 검사하고 위반을 **전부** 모아 던진다(첫 하나에서 멈추지 않는다). 메시지는 `[규칙번호] <concept_id> …` 꼴.

| # | 규칙 | 막는 사고 |
|---|---|---|
| ① | `concept_id` 는 전 파일에 걸쳐 유일. 간선 양 끝은 합집합에 있는 개념 | 오타 간선이 조용히 빠짐 |
| ② | 파일의 모든 개념에 kind 가 있고, 간선 양 끝에 kind 가 있다 | 미배치 개념에 간선이 걸려 range 검사가 빈다 |
| ③ | (from.kind, to.kind) 가 그 관계의 허용 범위 안 | TERM 이 무언가를 CONTAINS, TECHNOLOGY 가 METRIC 을 MITIGATES |
| ④ | CONTAINS 비순환 | 층 계산 무한 루프·깊이 오류 |
| ⑤ | 파일당 루트 하나(DOMAIN, CONTAINS 부모 없음). 그 외 모든 개념은 CONTAINS 부모 ≥ 1 | 고아 — 트리 뷰에서 사라진다 |
| ⑥ | FLOWS_TO 양 끝이 CONTAINS 부모를 하나 이상 공유 | 층을 건너뛰는 화살표 |
| ⑦ | SAME_AS·ALTERNATIVE_TO 는 한 방향만. 자기 자신 간선 금지(현행) | 역방향 유도와 이중 저장 충돌 |
| ⑧ | 같은 (from, to) 에 CONTAINS 와 USES 를 함께 걸지 않는다 | 「두 부모 위장」 재발 |

테스트 수준 규칙 ⑨: 모든 관계 kind 가 파일 합집합에서 **최소 1회** 쓰인다 — 정의만 있는 어휘를 두지 않는다(외부 제안의 20 종을 그대로 못 넣는 이유가 이것이다).

**게이트 증명**: 규칙 ①~⑧ 각각에 위반 입력 하나를 넣어 빨간불을 보는 도메인 테스트가 있어야 「검사한다」고 말한다.

### SR-4 원본 = 레포 파일, 도메인당 하나

경로 `code-dictionary/feature/src/main/resources/ontology/<domain>.yaml`. 첫 파일은 `search.yaml`.
jar 에 실려 부팅 때 읽히므로 이 경로가 원본이고 `docs/` 에 사본을 두지 않는다.

```yaml
domain: search                     # 파일 하나 = 도메인 하나 = 루트 하나
root: search-system
concepts:
  - id: rank-fusion
    kind: STAGE
    name: 융합
    category: ALGORITHM
    level: INTERMEDIATE
    description: 순위로 합친다. 점수 스케일이 달라 점수로는 못 섞는다
    synonyms: [rank fusion]
    contains: [rrf]                # 순서가 ordinal
    flows_to: [post-processing]
    measured_by:
      - to: ndcg
        reason: 융합 결과의 상위 10 을 등급 판정으로 잰다
  - id: vector-quantization
    kind: MECHANISM
    # …
    affects:
      - { to: resident-memory, reason: "상주 32× ↓" }
      - { to: recall-precision, reason: "↓, rescore 로 되찾는다" }
    mitigates: [{ to: page-cache-eviction, reason: "색인 한 벌이 작아져 anon 이 캐시를 밀어내지 못한다" }]
    alternative_to: []
```

- 관계 키는 관계 kind 의 소문자. 값은 `id` 또는 `{to, reason}`. 간선은 **from 노드에만** 적고 대칭 관계는 어느 한쪽에 한 번.
- **소유 규칙**: 파일이 나열한 개념의 `name·kind·category·level·description·synonyms` 와 그 개념에서 **나가는 간선 전부**는 파일이 이긴다.
  나열된 개념에서 나가는 기존 간선 중 파일에 없는 것은 지운다. **개념 행은 로더가 지우지 않는다** — `concept_index`·`service_concept` 가 값으로 참조한다. 행 삭제는 어드민 API 로.
- **로더**: `ApplicationRunner`(feature). 기동마다 도메인 단위 한 트랜잭션으로 멱등 upsert. 실패는 error 로그 + 기동 계속 — 폴드 호스트라 온톨로지 때문에 일곱 도메인을 같이 죽이지 않는다.
  두 번째 부팅의 변경 수는 0 이어야 한다(멱등 증거).
- **파싱은 infrastructure**(`infrastructure/ontology/YamlOntologyReader`, jackson-dataformat-yaml — Boot 가 이미 jackson 을 준다), **검증은 domain**. application 은 infrastructure 를 import 하지 않는다(ADR-0083).
- **CI 게이트**: feature 테스트 `OntologyFilesSpec` 이 resources 의 모든 파일을 읽어 `validate()` + 규칙 ⑨. 실패하면 테스트 게이트가 그 커밋의 이미지를 만들지 않는다 — 잘못된 온톨로지는 main 에 있어도 운영에 못 간다.
- **첫 파일 만드는 법**: 운영 `concept`·`concept_edge`·`concept_synonym` 에서 V22~V24 상태를 내보내 YAML 로 만들고, kind 를 부여하고, 용어의 둘째 부모 22건을 `uses` 로 옮기고,
  `mecab-ko-dic`·`sejong-corpus` 를 형태소 분석 단계 아래로 옮기고, 신규 관계를 각 1건 이상 심는다. 재적재 뒤 **전/후 `concept_edge` 집계표**로 의도한 차이만 있는지 본다.
- **Flyway**: 다음 번호 하나(착수 시 최신 번호를 다시 본다 — 여러 세션이 같은 번호를 잡은 적이 있다). 데이터 이관 SQL 은 없다 — 로더가 부팅 때 한다.

```sql
ALTER TABLE concept ADD COLUMN kind VARCHAR(16) NULL AFTER level;   -- NULL = 미배치
CREATE INDEX idx_concept_kind ON concept (kind);
ALTER TABLE concept_edge ADD COLUMN reason VARCHAR(500) NULL;
```

왜 마이그레이션 시드(현행)가 아닌가 — 불변이라 고칠 때마다 번호가 늘고, 검증이 없고, 리뷰 diff 가 INSERT 문이다. 왜 어드민 CRUD 가 아닌가 — 원본이 DB 가 되어 리뷰·되돌림·백업이 없다.

### SR-5 증거층과 질문 — 2차 슬라이스

외부 제안의 L3(경험·근거)다. 코드 참조(`concept_index`, 재색인 소유)·서비스(`service_concept`)·업무 도메인(`tech_domain_concept`)은 **이미 있는 L3** 라 그대로 두고 문서 근거와 질문만 더한다.

| 표 | 컬럼 | YAML |
|---|---|---|
| `concept_evidence` | `concept_id VARCHAR(100)` · `kind ENUM(ADR, POST, RECORD, MEASUREMENT)` · `ref VARCHAR(300)` · `note VARCHAR(500)` · `ordinal` | `evidence: [{kind: POST, ref: search-system-concept-map, note: …}]` |
| `concept_question` | `concept_id` · `ordinal` · `question VARCHAR(300)` | `questions: [왜 shard 가 필요한가, …]` |

- `ref` 는 ADR 파일명 · 블로그 slug · 볼트 raw 페이지명 · 측정 한 줄. 링크 해석은 화면 몫이고 서버는 문자열로 든다.
- 둘 다 파일이 소유하고 로더가 개념 단위로 전체 교체한다. 질문 시드는 `study/docs/00-INTERVIEW-INDEX.md` 의 꼬리질문.
- 사고 저장소로서의 값: 정의 하나가 아니라 「이 개념에 대해 물을 수 있는 것」이 노드에 붙는다.

### SR-6 조회와 화면

- `GET /api/v1/concepts/graph/hierarchy?root=` — 응답 노드에 `kind` 를 더한다. 간선은 이미 kind 를 실으므로 새 관계가 그대로 흐른다(`ConceptHierarchy.build` 가 비-CONTAINS 를 양 끝이 안에 있을 때 남긴다). 깊이 계산은 CONTAINS 만 — 변경 없음.
- `GET /api/v1/concepts/{conceptId}/relations` — 노드 하나의 이웃. `outgoing[{kind, to, toKind, reason}]` · `incoming[{kind: 역방향 라벨, from, fromKind, reason}]` · `evidence[]` · `questions[]`.
  N-hop 은 FE 가 로드된 DAG 에서 한다 — 서버 재귀 탐색(recursive CTE)은 만들지 않는다.
- `/tech` 계층 탭: kind 별 글리프(모양)와 색은 `DESIGN.md` 토큰. 용어의 둘째 부모 행 22개가 사라지고 장치 행에 「쓰는 용어」 칩이 붙는다. 노드 선택 시 이웃 패널(관계별 묶음 + 근거 + 질문).
  완성 판정은 CDP 로 기기×사이트 4조합 실측(`docs/standards/fe-visual-verification.md`) + 콘솔 오류 0.
- **도식 내보내기**: `scripts/ontology-mermaid.py <domain> [--root id] [--kinds CONTAINS,FLOWS_TO]` — 파일에서 `%% caption:` 을 단 mermaid flowchart 를 낸다.
  플랜 09-09 §1 과 블로그 id 33 의 mermaid 를 이것으로 재생성해 손 사본을 없앤다. 이후 **문서의 온톨로지 도식은 손으로 그리지 않는다.**

### SR-7 확장 규칙 — 둘째 도메인부터

- 파일 하나 = 루트 하나. 다음 후보는 `study/docs/4-db-index-transaction`(트랜잭션·격리·락)과 `6-kafka-internals`(파티션·리밸런스·랙) — 각 `99-concept-catalog.md` 가 재료다.
- 도메인 간 간선은 허용한다(USES·ALTERNATIVE_TO·IMPLEMENTS). 개념 id 는 전역 유일이라 **한 개념은 한 파일에만 산다** — 추천 파일이 `embedding-model` 을 쓰면 검색 파일의 id 를 참조만 한다.
- 최상위 루트(소프트웨어 공학 → 백엔드·데이터·인프라)는 **셋째 도메인 때** 결정한다. 지금은 루트를 나열한다(`hierarchy` 의 root 없음 = 진입점 전부).
- 용어 사전 가지 규칙(플랜 §3.5)은 유지한다 — 도메인마다 `<domain>-glossary` TERM 가지 하나, 용어와 장치의 연결은 USES.

## 8. 하지 않는 것

- 그래프 DB · RDF/OWL · SPARQL — 개념 수백 개에 파드를 늘리지 않는다. 논리 모델만 가져온다
- LLM 자동 간선 추출 (플랜 09-09 §4 그대로 — 틀린 간선은 틀린 지식이 된다)
- `relation_type` 표 · `confidence` · `scope` 컬럼 · `knowledge_node` 로의 일반화 — `concept` 표에 kind 로 충분하고, 사건·측정은 증거층이다
- 노드 유형 여덟째 · 관계 열한째 — 이 스펙 개정으로만
- 어드민 CRUD 화면 · 서버 N-hop 탐색 API
- **관계 탭(`relatedConceptIds`) 개편** — 발견: 운영 `concept_relation` 0행이라 관계 모드는 빈 그래프다. 간선 기반으로 바꾸는 것이 자연스럽지만 이 스펙과 이유가 다르다. 별도 판단.

## 9. 외부 제안 대조

| 제안 | 판정 | 이 스펙의 형태 | 이유 |
|---|---|---|---|
| 속성 그래프(Property Graph)로 시작 | 채택 | RDB `concept` + `concept_edge` + 파일 원본 | 저장소는 RDB 여도 논리 모델이 그래프면 된다 |
| 노드 유형을 8 로 제한 | 채택(7) | SR-1 | Solution·Pattern·Example 은 간선·증거층으로 |
| Concept 와 Technology 분리 | 채택 | `TECHNOLOGY` + `IMPLEMENTS` | OpenSearch 가 바뀌어도 개념 구조가 남는다 |
| 관계 어휘 약 20 | 부분 채택(10) | SR-2 + 보류 조건 | 규칙 ⑨ — 쓰이지 않는 어휘를 두지 않는다 |
| 3계층(도메인·기술·경험) | 채택 | L1 파일 · L2 TECHNOLOGY/IMPLEMENTS · L3 `concept_evidence`+기존 세 표 | |
| 노드 스키마의 `questions` | 채택(2차) | `concept_question` | 사고 저장소 |
| 「왜」 간선(인과) | 채택 | `CAUSES` · `AFFECTS` · `MITIGATES` + `reason` | |
| Git YAML → 그래프 빌더 | 채택 | SR-4 | |
| `relation_type` 표 + inverse | inverse 만 채택 | enum `inverseLabel` | range 검사가 코드에 있어 표는 사본 |
| Statement 의 reason·evidence·confidence | reason 채택 | `concept_edge.reason` · evidence 는 노드 증거층 | confidence 는 상수 |
| `knowledge_node` 일반화 | 기각 | `concept.kind` | 사건·측정은 노드가 아니라 증거 |
| Graph-RAG | 보류 | — | 파일이 이미 LLM 이 읽기 좋은 형태라 별도 설계 없이 가능 |

## 10. 검증 — 완료 판정은 값으로

1. 도메인 테스트: 규칙 ①~⑧ 각각 위반 입력 → 실패 메시지(빨간불 증거). 정상 입력 → 통과
2. `OntologyFilesSpec`: `search.yaml` 로드·검증 통과 + 관계 kind 10 종 전부 ≥ 1 사용
3. 재적재 **전/후 `concept_edge` 집계표**: CONTAINS 127 → 105 · USES 22 · 신규 관계 각 ≥ 1 · 배치율 102/261
4. 부팅 로그의 도메인별 upsert 수. **두 번째 부팅은 변경 0**
5. `/tech` 계층 탭 CDP 4조합 스크린샷 + 콘솔 오류 0. 롤아웃 확인은 새 심볼(응답의 `kind` 필드)로
6. mermaid 스크립트 출력의 노드 집합이 플랜 §1 그림과 일치

## 11. 슬라이스

| 슬라이스 | 내용 | 단독 배포 값 |
|---|---|---|
| S1 | kind 7 + 관계 10 + `validate()` + YAML 로더 + `search.yaml` 이관 + Flyway 한 번호 | 온톨로지가 **검사되는 파일**이 된다 |
| S2 | `concept_evidence`·`concept_question` + `/relations` 엔드포인트 | 노드가 근거와 질문을 갖는다 |
| S3 | `/tech` 계층 탭 개편 + mermaid 스크립트 + 플랜·블로그 도식 재생성 | 화면과 문서가 파일에서 나온다 |

## 열린 질문

0건. 결정한 가정: 1순위 소비자는 **학습·탐색**(`/tech` + 문서 도식), 그 다음이 증거 연결. 이 가정이 바뀌면 SR-2 의 보류 관계(`REQUIRES`)부터 다시 본다.
