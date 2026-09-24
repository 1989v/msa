# Task Breakdown: 개념 온톨로지

## Overview
Total Task Groups: 6

스펙 `spec.md`(개정 4) · ADR-0100. 표준: `docs/conventions/package-structure.md`(ADR-0083) · `docs/standards/test-rules.md` · `docs/conventions/transactional-usage.md` · `docs/conventions/logging.md` · `docs/standards/fe-visual-verification.md` · `DESIGN.md`.

릴리스 경계: **R1** = 그룹 1~5 를 한 번에 올리되 `ontology.loader.enabled=false`(S1 효과만 운영에 나감) · **R2** = 그룹 6(로더 켜기). R2 는 R1 이 운영에서 확인된 뒤.

검증 명령은 **바꾼 테스트만** 지정한다.

### Task Group 1: 도메인 — 유형·관계·공리 (S1)
- [x] 1.1 `ConceptKind` 7종 · `ConceptEdgeKind` 9종(SAME_AS 제거) + 허용 범위 · `inverseLabel`
- [x] 1.2 `ConceptEdge` 에 `reason`·`evidenceRef`
- [x] 1.3 `ConceptOntology` 모델(manifest + 도메인 문서) + `validate()` 규칙 ①~⑧, 위반 전부 수집
- [x] 1.4 `Concept` 에 `kind`·`managedBy`, 관리 개념 수정·삭제 거부
- [x] 1.5 테스트: 규칙마다 위반 입력 → 빨간불, 정상 입력 → 통과. 관리 개념 수정 거부
- [x] 1.6 Verify: `./gradlew :code-dictionary:domain:test --tests '*ConceptOntologyTest*' --tests '*ConceptTest*' --tests '*ConceptHierarchyTest*'`
  → domain 65/0 (ConceptOntologyTest 17 · ConceptTest 7 · ConceptHierarchyTest 8). 회귀 주입(범위 검사·TERM 부모 수 무력화) → 4 failed 확인 후 원복

### Task Group 2: 영속 — 스키마·읽기 관대화·쓰기 잠금 (S1)
- [x] 2.1 Flyway V25 — kind·managed_by·reason·evidence_ref·`ontology_state` 행(sync 리스 칼럼 포함)
- [x] 2.2 `ConceptEdgeJpaEntity.kind` 문자열, 모르는 값은 경고 후 제외
- [x] 2.3 `ConceptJpaEntity` 에 kind·managed_by 읽기 전용 매핑
- [x] 2.4 409 처리기(code-dictionary 전용)
- [x] 2.5 테스트: 모르는 kind 행 제외 · 엄격 enum 매핑이 USES 에서 실패함을 재현 · 관리 개념 PUT/DELETE 409
- [x] 2.6 Verify: 해당 테스트 클래스만
  → ConceptEdgeJpaEntityTest 2 · ConceptServiceManagedTest 3 · ManagedConceptControllerTest 2 통과. 회귀 주입(409→400, 관대화 제거) → 3 failed 후 원복. 「엄격 enum 재현」 fixture 는 두지 않았다 — 옛 엔티티(`@Enumerated`, 3값 enum)가 곧 재현이라 자기 사본 검사가 된다

### Task Group 3: 로더 — manifest 적용 계약 (S2 코드)
- [x] 3.1 `YamlOntologyReader`(infrastructure) — manifest·도메인 파일 파싱, `content_hash`(경로순 정렬, 경로·길이·바이트 SHA-256)
- [x] 3.2 `OntologyStorePort` + JDBC 어댑터 — 상태 행 `FOR UPDATE`, 개념 upsert, 동의어·간선 교체, 관리 해제
- [x] 3.3 `OntologyApplyService` — revision 가드(작으면 건너뜀·같고 해시 다르면 오류·크면 적용), 단일 트랜잭션, 실패 시 롤백·기동 계속
- [x] 3.4 `ApplicationRunner` — `ontology.loader.enabled`(기본 false)
- [x] 3.5 테스트(Testcontainers MySQL + 실제 Flyway): 적용 · 두 번째 적용 변경 0 · 낮은 revision 무시 · 같은 revision 다른 해시 오류 · 관리 해제 · 둘째 파일 실패 주입 시 전체 롤백 · 두 로더 동시 → 한 번만 적용
- [x] 3.6 Verify: 해당 테스트 클래스만
  → OntologyApplyIntegrationSpec 13 (Testcontainers MySQL 8.0.33 + Flyway V1~V26) · YamlOntologyReaderTest 6. 회귀 주입(옛 revision 가드·간선 표 교체 제거) → 실패 확인 후 원복

### Task Group 4: 파생물 — sync 리스·대상 해시·재시도 (S2 코드)
- [x] 4.1 상태 행 리스(획득·해제·만료 탈취), `IndexAliasPort.deleteIndex`
- [x] 4.2 `SyncService` — 수동 경로 포함 리스 경유, 시작 때 대상 해시 고정, 교체 직전 재확인(다르면 색인 폐기·재실행), 성공 시 고정 해시만 `derived_hash`
- [x] 4.3 로더 뒤 캐시 evict + sync, backoff 3회, 부팅 때 `content_hash ≠ derived_hash` 면 재실행
- [x] 4.4 테스트: 리스를 못 잡으면 안 돈다 · 교체 직전 해시가 바뀌면 색인 폐기 후 최신으로 수렴 · 성공 시 고정 해시만 기록
- [x] 4.5 Verify: 해당 테스트 클래스만
  → SyncServiceLeaseTest 3 · OntologyDerivedRefresherTest 3. 회귀 주입(교체 직전 재확인 제거) → 1 failed 후 원복

### Task Group 5: 첫 파일 · 조회 · 화면 (S2 데이터 · S3 · S4)
- [x] 5.1 `manifest.yaml` + `search.yaml` — 운영 V22~V24 상태에서 생성, 경계 규칙 적용, 이관 diff 목록(`context/migration-diff.md`)
- [x] 5.2 `OntologyFilesSpec` — 실제 파일 검증 + 규칙 ⑨ + manifest 목록 = 파일 집합
- [x] 5.3 Flyway V26 — `concept_evidence`·`concept_question`, 로더가 소유
- [x] 5.4 hierarchy 응답에 `kind` · `GET /api/v1/concepts/{conceptId}/relations`
- [x] 5.5 `/tech` 계층 탭 — kind 글리프, 둘째 부모 행 대신 「쓰는 것」 칩, 이웃은 별도 패널이 아니라 **기존 상세 서랍의 「관계」 절**(첫 구현의 오른쪽 패널이 서랍에 가려진 것을 스크린샷으로 발견)
- [x] 5.6 도식 도구 — 파이썬 대신 `./gradlew :code-dictionary:feature:ontologyMermaid`(로더와 같은 리더, 파서 사본 없음). 플랜·블로그 도식 교체는 발행물 수정이라 승인 뒤
- [x] 5.7 Verify: 해당 테스트 · `pnpm tsc` · FE 단위 테스트
  → OntologyFilesSpec 3 · SearchOntologyMigrationSpec 3(적용 전 간선 = 운영 145 · 적용 후 = 파일 163) · ConceptRelationsServiceTest 3 · GraphServiceHierarchyTest 6 · AtlasContextLoadSpec 4 · feature 전체 84/0 · portal-fe tsc(주입으로 검사 범위 확인) · vitest 41/0 · CDP 4조합+390px(대비 최저 4.52, 가로 넘침 0). 파일 게이트 회귀 주입(범위 위반·CAUSES 삭제) → 2 failed 후 원복

### Task Group 6: 로더 켜기 (R2, 별도 배포)
- [ ] 6.1 R1 운영 확인(계층 API 200 · 새 칼럼 존재 · 409 동작)
- [ ] 6.2 `ontology.loader.enabled=true` 커밋 → 배포 → 상태 행 revision 1 · 이관 diff 대조 · 두 번째 부팅 변경 0 · `derived_hash = content_hash`
