# ADR-0100 — 개념 온톨로지: 노드 유형·관계 어휘 고정, 레포 파일이 원본

- 상태: 채택 (2026-09-24)
- 관련: ADR-0083(레이어 표준), ADR-0093(atlas 호스트), ADR-0055(개념 검색 색인)
- 스펙: `docs/specs/2026-09-23-concept-ontology/spec.md` (개정 4, 외부 리뷰 3회)

## 맥락

개념 사전의 검색 계층은 `concept_edge`(CONTAINS·FLOWS_TO·SAME_AS)로 DAG 가 되어 있지만 온톨로지는 아니다.
노드에 유형이 없어 층을 깊이로만 유도하고, CONTAINS 가 구성·변종·사전 등재·사용을 겸하며,
원본이 불변 Flyway 마이그레이션이라 간선 하나를 고치려면 번호가 하나 는다(V22→V24).

## 결정

1. **스키마 변경** — `concept.kind`(7종)·`concept.managed_by`, `concept_edge.reason`·`evidence_ref`, 단일 행 `ontology_state`(최신 적용 상태·잠금·파생물 기록·sync 리스), 증거층 `concept_evidence`·`concept_question`.
2. **원본은 레포 파일** — `code-dictionary/feature/src/main/resources/ontology/` 의 `manifest.yaml` + 도메인당 YAML. 부팅 로더가 manifest 단위 revision 가드·단일 트랜잭션으로 적용하고, CI 테스트가 파일을 검증한다.
3. **`concept_edge` 전체를 파일이 소유한다** — 간선을 쓰는 곳은 V22~V24 시드와 로더뿐이라 로더가 표 전체를 교체한다. 파일에서 빠진 개념의 나가는 간선이 남아 유령 루트가 되는 길을 없앤다.
4. **관리 개념의 쓰기 잠금** — `managed_by` 가 있는 개념의 어드민 PUT·DELETE 는 409.
5. **배포 두 번** — 관계 kind 를 문자열로 읽는 코드가 먼저 운영에 나가고(롤백 하한), 로더는 `ontology.loader.enabled` 를 켜는 다음 배포에서 동작한다.

## 기각

- 그래프 DB·RDF/OWL — 개념 수백 개에 파드를 늘리지 않는다
- 어드민 CRUD 원본 — 리뷰·되돌림·백업이 없다
- `common` 에 CONFLICT 에러 코드 추가 — 전 JVM 이미지가 다시 구워진다. code-dictionary 전용 예외 처리기로 409 를 낸다

## 결과

온톨로지 변경은 PR diff 로 리뷰되고 잘못된 간선은 이미지가 나가기 전에 막힌다. 개념 사전의 검색 계층 간선을
마이그레이션으로 더 심지 않는다 — V22~V24 는 역사로 남고 첫 적용이 그 위를 덮는다.
