# 레이어 구조 정렬 실행 플랜 (ADR-0083)

- 작성: 2026-08-26
- 근거: `docs/adr/ADR-0083-layer-structure-standard-and-gate.md`
- 표준: `docs/conventions/package-structure.md` · 체크리스트: `docs/standards/new-domain-checklist.md`
- 실측 스크립트: 모듈별 `dir≠pkg / Port / Adapter / UseCase-iface / UseCase-class / app→infra / 테스트` 집계
  (ADR-0083 맥락 표가 그 결과). 각 단계 종료 시 같은 집계를 다시 돌려 0 이 됐는지 본다.

## 원칙

- 단계마다 **동작 변화 0** 을 유지한다. 리팩터링과 기능 변경을 한 커밋에 섞지 않는다.
- 한 단계 = 한 커밋 묶음. 단계 끝에 `./gradlew build` 와 allowlist 축소를 같이 커밋한다.
- 여러 세션이 워킹트리를 공유하므로 `git add` 는 경로로 좁힌다.
- `main` 이 곧 배포 브랜치다 — 이미지가 새로 구워지는 모듈을 단계별로 적어 둔다 (images.yml 테스트
  게이트가 한 모듈 실패로 그 커밋의 **모든** 이미지를 막는다).

## P0 — 하네스 정비 (완료 2026-08-26)

ADR-0083 · 신규 도메인 체크리스트 · `package-structure.md`(생략 노트 폐기·규칙 추가) ·
`module-structure.md`(전 모듈 표) · `00.clean-architecture.md` §4.2 · `code-convention.md` §2 ·
루트 `CLAUDE.md` · 서비스 `CLAUDE.md` 6개 신규 + 19개 "구조 상태" · `settings.gradle.kts` 주석.

## P1 — 빌드 게이트 `verifyLayerDependencies`

**파일**: 루트 `build.gradle.kts` (`verifyFlywayWiring` 아래, 같은 패턴). `check` 에 dependsOn.

규칙과 초기 allowlist (항목마다 이유·비우는 단계):

```kotlin
// ① application → infrastructure import 금지
val layerImportExempt = mapOf(
    ":blog:feature" to "변종 C — P2-3 에서 Port 도입 후 제거",
    ":ranking:feature" to "변종 C — P2-1",
    ":deal:feature" to "변종 C — P2-2",
    ":quant:app" to "포트가 JPA 엔티티·metrics 를 import — P4",
    ":code-dictionary:app" to "SyncService → IndexAliasManager 1건 — P4",
    ":recommendation:app" to "변종 B — P4",
    ":search:app" to "2건 — P4",
    ":auth:app" to "1건 — P4 (서브모듈)",
    ":experiment:app" to "1건 — P4",
    ":inventory:feature" to "1건 — P4",
)
// ② domain 모듈 spring/jakarta import 금지
val domainFrameworkExempt = mapOf(":search:domain" to "Page/Pageable — 문서화된 영구 예외")
// ③ 디렉토리 == 패키지
val dirPackageExempt = mapOf(
    ":product:app" to "변종 D 31 — P3", ":auth:app" to "변종 D 29 — P3 (서브모듈)",
    ":order:feature" to "변종 D 26 — P3", ":search:app" to "변종 D 21 — P3",
    ":product:domain" to "P3", ":order:domain" to "P3", ":search:domain" to "P3",
)
// 게이트 밖: gateway, common, agent-viewer:api, game:sim, game:web (ADR-0083 §6)
```

**검증**: `./gradlew check` 통과 + allowlist 한 항목을 임시로 지우면 실패하는지 확인(게이트가 실제로
읽는지). `docs/standards/agent-behavior.md` 의 자동 리뷰 항목에 한 줄.

**이미지 영향**: 없음 (빌드 스크립트만).

## P2 — 변종 C 포트 도입 (ranking → deal → blog)

작은 것부터. 각 모듈에서:

1. `application/{entity}/port/{Entity}RepositoryPort.kt` — 서비스가 실제로 쓰는 메서드만 (YAGNI).
   반환은 도메인 모델, JPA 엔티티 금지.
2. `infrastructure/persistence/{entity}/adapter/{Entity}RepositoryAdapter.kt` — `toDomain()/fromDomain()`.
3. 서비스 생성자에서 `JpaRepository` → Port. `JpaEntity` 를 응답 DTO 로 바로 쓰던 자리는 도메인 모델 경유.
4. 서비스가 `@Service` 클래스뿐이면 `usecase/{Action}{Entity}UseCase` 인터페이스 추출 + `Command/Result`.
5. 테스트: `JpaRepository` MockK → Port MockK. 컨트롤러 테스트는 UseCase MockK.
6. allowlist 에서 모듈 제거.

| 순서 | 모듈 | 위반 파일 | import | 비고 |
|---|---|---|---|---|
| P2-1 | `ranking/feature` | 4 | 20 | 포트 디렉토리 없음. 스냅샷 배치도 서비스 — 배치는 Port 경유로 |
| P2-2 | `deal/feature` | 3 | 12 | `application/port`·`persistence/adapter` 디렉토리가 **이미 있다** — 그 안에 채운다 |
| P2-3 | `blog/feature` | 9 | 41 | 가장 큼. `BlogPostJpaEntity` 를 직접 돌려주는 자리가 많다 — 도메인 모델(`blog/domain`)로 매핑 |

**검증**: 모듈 test + `:code-dictionary:app:test`(컨텍스트 로드) + 게이트. 공개 API 응답 JSON 이 이전과
동일한지 FE 스냅샷 또는 curl diff.
**이미지 영향**: code-dictionary (세 모듈 전부 이 호스트).

## P3 — 변종 D `git mv` (package 무변경)

| 모듈 | 파일 | 주의 |
|---|---|---|
| `product/app` · `product/domain` | 31 + 4 | |
| `order/feature` · `order/domain` | 26 + 5 | 이중 구조 — `order/order/controller` 와 `order/presentation/order/controller` 를 합친다 |
| `search/app` · `search/domain` | 21 + 4 | `search/CLAUDE.md` 의 "디렉터리 ≠ 패키지" 경고 섹션을 삭제 |
| `auth/app` | 29 | **private 서브모듈** — 서브모듈에서 커밋·푸시 후 본체 포인터 갱신 |

방법: 파일의 `package` 선언에서 경로를 유도해 `git mv` 하는 스크립트 1회 실행. 빈 디렉토리 정리.
`git log --follow` 로 이력 유지 확인.

**검증**: `./gradlew build` (컴파일 산출물 동일). 게이트 ③ allowlist 제거.
**이미지 영향**: product · search(app/consumer/batch) · commerce · auth — 코드 변화 0 이지만 태그는 바뀐다.

## P4 — 변종 B 정렬 + 잔여 역참조

| 모듈 | 작업 |
|---|---|
| `analytics` | `domain/port` 4 → `app` 의 `application/{entity}/port`. UseCase 클래스 3 → 인터페이스 추출 |
| `experiment` | `domain/port` 1 → application. UseCase 클래스 5 → 인터페이스 |
| `recommendation` | `com.kgd.recommendation.port` 5 → application. domain 모델 패키지를 `domain/` 아래로. UseCase 클래스 3 → 인터페이스 |
| `quant` | UseCase 클래스 14 → 인터페이스. `PaperAccountRepositoryPort` 의 `PaperAccountEntity` 노출 제거, `QuantMetrics`/`QuantChartsProperties` 를 application 에서 import 하는 7건 → 포트 또는 application 소유 프로퍼티로 |
| `game` | 서비스 10개에 UseCase 인터페이스 도입 (포트는 이미 표준 위치 — `*Ports.kt` 묶음 파일 허용) |
| `code-dictionary` | `SyncService → IndexAliasManager` 1건 → 포트 |
| `chatbot` | 최상위 `config/` → `infrastructure/config` |
| `search/app` 2 · `auth/app` 1 · `inventory/feature` 1 · `experiment/app` 1 | 개별 확인 후 포트 경유 |

**검증**: 각 모듈 test + 게이트 ① allowlist 를 `search:domain` 제외 전부 제거.

## P5 — DRY (Outbox · 멱등 엔티티)

- `inventory/feature` 자체 Outbox(`OutboxPort`/`OutboxAdapter`/`OutboxJpaEntity`/`OutboxPollingPublisher`)
  → common `OutboxRepository` 서브인터페이스(`InventoryOutboxRepository`) 패턴. order/fulfillment 와 동형.
  **주의**: 테이블 스키마가 common `OutboxEntity` 와 같은지 먼저 비교 — 다르면 마이그레이션(새 번호).
- `quant/app` Outbox(`OutboxRelay`, Postgres) — 형태가 달라 별도 검토. 이 플랜에서 결정하지 않는다.
- ProcessedEvent 엔티티 5벌 — ADR-0058 불변식 3(도메인별 EMF)이 요구하는 중복인지, common
  `@MappedSuperclass` + 도메인별 얇은 `@Entity` 로 줄일 수 있는지 판정. 줄일 수 없으면 "설계상 중복" 으로
  `idempotent-consumer.md` 에 적는다.

## P6 — 테스트 소스셋 없는 모듈

`agent-viewer/api`(예외 — 도구) 제외 5개: `chatbot/app` · `gifticon/app` · `gifticon/domain`(서브모듈) ·
`member/feature` · `warehouse/feature`. 최소 domain 단위 테스트 + 서비스 테스트(Port MockK) 1벌씩.
체크리스트 §8 "소스셋 없는 모듈 금지" 가 이후 신규를 막는다.

## 완료 기준

- 게이트 allowlist 에 `search:domain`(②) 만 남는다.
- 실측 집계: `dir≠pkg 0 · app→infra 0 · UseCase-class 0 · 테스트 소스셋 부재 0(도구 제외)`.
- `package-structure.md` 의 "레거시 디렉토리 (이행 중)" 절 삭제.
