# Specification: 개념 아틀라스 — 도메인별 그래프 학습 (`/tech`)

> 2026-09-24. 선행: `docs/specs/2026-09-23-concept-ontology/spec.md`(개정 4, 운영 적용 완료) · ADR-0100.
> 사용자 요청: 「노드 단위 개념·계층 구조 / 개념에 블로그 글·코드 스니펫이 매핑돼 그래프에서 보인다 / 1차 노드부터 좁혀 가며 탐색」을
> 전부 완성하고, `/tech` 를 k-heritage 톤의 그래프 탐색 중심 학습 화면으로 다시 짠다.

## Goal

`/tech` 에서 도메인 하나를 골라 **노드 → 계층 → 그래프** 순으로 좁혀 가며 개념을 배운다. 개념 하나를 열면
그것이 어디에 속하고 무엇과 이어지는지, 이 레포의 어느 코드가 그것이고, 어떤 글이 그것을 설명하는지가 한 자리에 있다.

## 0. 현재 (2026-09-24 운영)

| 항목 | 값 |
|---|---|
| 온톨로지에 놓인 개념 | 108 / 269 (검색 한 도메인) |
| 글↔개념 연결 | 근거 POST 1건, 글 쪽에서 고르는 길 없음 |
| 코드 참조 | `concept_index` 0행 |
| `/tech` | dark-trading 고정, 탭 7개(도메인 맵·계층·트리맵·3D·개념 트리맵·히트맵·통계) |

## Specific Requirements

### SR-1 도메인 열 개 — 놓이지 않은 161개를 전부 놓는다

온톨로지 파일을 도메인당 하나씩 더한다. 재료는 운영에 이미 있는 개념 행(재색인 추출분)이고, 빈자리는 `study/docs/*/99-concept-catalog.md` 로 채운다.

| 파일 | 루트 | 담는 개념 (현행 category) |
|---|---|---|
| `search.yaml` | 검색 시스템 | (기존) |
| `architecture.yaml` | 소프트웨어 아키텍처 | ARCHITECTURE 12 · DESIGN_PATTERN 14 |
| `distributed.yaml` | 분산 시스템 | DISTRIBUTED_SYSTEM 14 · consistent-hashing · sharding · replication · cap-theorem · base · distributed-lock |
| `data.yaml` | 데이터 저장 | acid · write-ahead-log · connection-pool · orm · n-plus-one · caching · b-tree · 락 둘 |
| `concurrency.yaml` | 동시성 | CONCURRENCY 중 락·분산락 제외 |
| `network.yaml` | 네트워크 | NETWORK 10 |
| `security.yaml` | 보안 | SECURITY 10 |
| `infrastructure.yaml` | 인프라·배포 | INFRASTRUCTURE 14 (git-submodule 포함) |
| `testing.yaml` | 테스트 | TESTING 9 |
| `cs-fundamentals.yaml` | CS 기초 | ALGORITHM 9 · DATA_STRUCTURE 13 |
| `language.yaml` | 언어 · Kotlin | BASICS 20 · LANGUAGE_FEATURE 8 |

- 규칙은 온톨로지 스펙 그대로다(유형 7 · 관계 9 · 공리 8+1). 도메인마다 `<domain>-glossary` TERM 가지 하나.
- 이 레포가 쓰는 기술은 TECHNOLOGY 노드로 둔다(Kafka · Redis · MySQL · OpenSearch · Spring Boot · Kotlin · k3s · Argo CD · Resilience4j …)
  — 개념과 구현체를 분리해야 기술이 바뀌어도 개념 구조가 남는다.
- 전역 최상위 노드는 두지 않는다. **도메인 열한 개가 1차 노드**이고 화면이 그것을 아틀라스로 나열한다(온톨로지 스펙의 「셋째 도메인 때 결정」 — 파일당 루트 하나 규칙을 깨지 않는다).
- 옛 `search-ops-metrics`·`offline-metrics` 행은 파일에 들이지 않고 삭제한다(참조 0건).
- 목표 배치율: 269 중 267 이상 + 신규.

### SR-2 코드 참조 — 줄 번호가 아니라 심볼로

```yaml
code:
  - { path: code-dictionary/feature/src/main/kotlin/.../IndexAliasManager.kt, symbol: "override fun swapAlias", note: 별칭을 원자적으로 옮긴다 }
```

- 줄 번호를 적지 않는다 — 코드가 움직이면 썩는다. 화면이 GitHub 원본(`raw.githubusercontent.com/1989v/msa/main/<path>`, 공개 레포 · CORS `*` 확인)을 받아 **심볼이 처음 나오는 줄부터** 보여 준다.
- 게이트: `OntologyFilesSpec` 이 레포 안에서 path 가 있고 그 파일에 symbol 문자열이 있는지 본다. 심볼을 지우거나 파일을 옮기면 code-dictionary 테스트가 깨진다.
- 저장: V27 `concept_code_ref(concept_id, ordinal, path, symbol, note)` — 로더가 개념 단위로 전체 교체. `concept_index`(재색인 소유, 운영 0행)는 건드리지 않는다.
- `/relations` 응답에 `code[]` 를 더한다.

### SR-3 글 ↔ 개념 — 글을 쓰는 쪽에서 고른다

- blog_db V2 `blog_post_concept(post_id, concept_id, ordinal)` — PK(post_id, concept_id), `concept_id` 인덱스. 값으로 든다(서비스 간 FK 없음).
- `BlogPostRequest.conceptIds: List<String>?`(최대 12, `^[a-z0-9-]{1,100}$`) — 작성·수정이 매핑을 전체 교체한다. null 이면 그대로 둔다.
- `BlogPostDetail.conceptIds` · 공개 목록 `GET /api/v1/blog/posts?concept=<id>` — 발행 글만.
- 편집기: 개념 고르기(개념 검색 자동완성 → 칩). 글 화면: 개념 칩 → `https://1989v.com/tech/c/<id>`.
- `/tech` 개념 패널이 블로그 API 를 직접 부른다 — atlas 가 content 를 부르지 않는다(서비스 간 호출 추가 없음).
- 기존 발행 글의 매핑은 blog_db V3 시드로 넣는다(글 slug 기준, 사람이 고른 목록).
- 온톨로지 근거의 `POST` 는 남기되 새 글 연결은 블로그 쪽 매핑이 원본이다.

### SR-4 `/tech` — 개념 아틀라스 (k-heritage)

- **아키타입 전환**: `/tech` 를 dark-trading 에서 k-heritage(라이트 전통 · 다크 Heritage Tech)로 옮긴다. DESIGN.md §12 적용 범위와 k-heritage 견본의 `/tech` 항목을 같이 고친다.
- **세 단계 탐색**이 화면의 중심이다.
  1. **아틀라스** — 도메인 열한 개(1차 노드)를 판으로. 개념 수·배치된 글 수·코드 참조 수.
  2. **도메인 그래프** — 고른 도메인의 계층(CONTAINS)을 그래프로. 층을 한 단계씩 펼치며 좁힌다. 가로지르는 관계(USES·IMPLEMENTS·AFFECTS …)는 선택한 노드 주변에서만 그린다.
  3. **개념** — 선택한 노드의 경로(브레드크럼), 관계 묶음, 코드 스니펫, 글, 물을 수 있는 것.
- URL 이 상태를 든다: `/tech` · `/tech/d/<domain>` · `/tech/c/<conceptId>` — 글에서 넘어오고 공유할 수 있게.
- 검색창은 남긴다(개념으로 바로 이동). 트리맵·3D·히트맵·통계 탭은 걷어낸다 — 학습 동선과 무관하고 dark 전제로 짜여 있다.
- **디자인은 코드보다 먼저 목표 시안**을 만들어 확인받는다. 확인 전에는 FE 를 짜지 않는다.
- 모바일이 1순위 — 세로 390px 에서 그래프가 쓸 만해야 한다(탭하면 좁혀지고, 패널은 바텀시트).

## 구현 상태 (2026-09-24)

| 항목 | 상태 |
|---|---|
| SR-1 | 완료 — revision 2, 도메인 11 · 개념 531 · 관계 1022. 관리 밖은 옛 지표 묶음 둘뿐(이관 테스트가 고정). 에이전트 병렬 작성 중 생긴 중복 넷(API 게이트웨이 · 리버스 프록시 · 교착 · 캐시 적중률)은 기존 id 로 합쳤다 |
| SR-2 | 완료 — V27, 코드 참조 187 |
| SR-3 | 완료 — blog_db V2 매핑 · V3 시드(발행글 여덟 편, 운영 SELECT 로 36행 확인) · 편집기 고르기 · 글 끝 칩 · `?concept=` · 개념별 글 수 `GET /api/v1/blog/concepts` |
| SR-4 | 백엔드 `GET /api/v1/concepts/atlas` 완료. 화면은 목표 시안(https://claude.ai/artifact/TgHFjPBy3QWN1FdKw5efFf) 확인 대기 |

## 8. 하지 않는 것

- 그래프 DB · 서버 N-hop 탐색 · 전역 최상위 노드
- LLM 이 레포 밖 지식으로 간선을 자동 생성하는 파이프라인 — 간선은 파일에 사람이 읽을 수 있게 적고 리뷰한다
- 코드 스니펫 사본 저장 — 원본은 레포
- 트리맵·3D·히트맵 뷰의 k-heritage 포팅

## 9. 검증

1. `OntologyFilesSpec` — 파일 열한 개 공리 + 규칙 ⑨ + 코드 참조 path·symbol 존재
2. 재적재 통합 테스트 — 실제 파일이 운영과 같은 시드 위에 적용되고 배치율 목표를 넘는다
3. 블로그 — 매핑 저장·교체·목록 필터 단위 테스트, 발행 안 된 글은 필터에 안 나온다
4. `/tech` — CDP 기기×사이트 4조합 + 390px, 글자 대비 4.5, 가로 넘침 0, 콘솔 오류 0, 스크린샷 검토
5. 운영 — 적용 revision · 배치율 · 도메인별 계층 API · 글 필터 API · 운영 번들의 새 심볼
