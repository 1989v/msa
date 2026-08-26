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
| P2-1 ✅ 2026-08-26 | `ranking/feature` | 4 | 20 | 완료 — UseCase 5 · Port 4 · Adapter 4, allowlist 제거 |
| P2-2 ✅ 2026-08-26 | `deal/feature` | 3 | 12 | 완료 — UseCase 16 · Port 3 · Adapter 3, allowlist 제거 |
| P2-3 ✅ 2026-08-26 | `blog/feature` | 9 | 41 | 완료 — UseCase 31 · Port 6 · Adapter 6, 도메인 Paging/Paged 도입, allowlist 제거 |

**검증**: 모듈 test + `:code-dictionary:app:test`(컨텍스트 로드) + 게이트. 공개 API 응답 JSON 이 이전과
동일한지 FE 스냅샷 또는 curl diff.
**이미지 영향**: code-dictionary (세 모듈 전부 이 호스트).

## P3 — 변종 D `git mv` (package 무변경) ✅ 2026-08-26 완료 (main 120 + test 17 파일, auth 는 서브모듈 별도 커밋)

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
| ✅ `analytics` | 완료 — 포트 `application/{score,event}/port`, UseCase 인터페이스 4 + 서비스 2 |
| ✅ `experiment` | 완료 — 포트 2(AnalyticsMetricsPort 신설), UseCase 인터페이스 6 + 서비스 2 |
| ✅ `recommendation` | 완료 — domain/recommendation/{model,policy}, 포트 9(밴딧·실험·노출 포트 신설), UseCase 인터페이스 3 + 서비스 3 |
| ✅ `quant` | 완료 — 인터페이스 14 + Service 14, `PaperAccount` 도메인 모델, metrics 포트 2, 차트 properties 는 application 소유 |
| ✅ `game` | 완료 — UseCase 인터페이스 31, 컨트롤러 8개 인터페이스 주입 |
| ✅ `code-dictionary` | 완료 — `IndexAliasPort` |
| ✅ `chatbot` | 완료 — Properties 는 application/chat/config, Config 는 infrastructure/config (규칙 11) |
| ✅ `search/app` · `auth/app` · `inventory/feature` | 완료 — `SearchVariantPort` · `SubjectHashPort` · `InventoryMetricsPort` |

**검증**: 각 모듈 test + 게이트 ① allowlist 비움 ✅ 2026-08-26.

## P5 — DRY (Outbox · 멱등 엔티티) ✅ 2026-08-26

- ✅ `inventory/feature` 자체 Outbox 4파일 + `OutboxPollingPublisher` 삭제 → common `InventoryOutboxRepository : OutboxRepository`
  + `InventoryMessagingConfig` 에 `inventoryOutboxPort`/`inventoryOutboxPollingPublisher` 빈. 스키마는 common `OutboxEntity` 와
  컬럼 단위로 같아 마이그레이션 없음(인덱스 선언만 common 쪽에 있고 DDL 은 이미 있었다). 죽은 키 `inventory.outbox.*` 제거.
- ✅ ProcessedEvent 5벌 — **설계상 중복이 아니었다.** ADR-0058 불변식 3 이 요구하는 것은 "도메인별 EMF 바인딩" 이지
  "도메인별 엔티티" 가 아니다. outbox 와 같은 모양으로 common `messaging.idempotency` 에 엔티티·`@NoRepositoryBean` 베이스·어댑터
  한 벌, 도메인은 `{Domain}ProcessedEventRepository` 한 줄 + EMF 패키지 + 어댑터 빈. 단독 앱(product·quant)은 `@EntityScan`
  (Boot 4 는 `org.springframework.boot.persistence.autoconfigure.EntityScan`). 어댑터 테스트 4벌 → common 1벌.
  규칙은 `idempotent-consumer.md` §1.3.
- `quant/app` Outbox(`OutboxRelay`, Postgres) — 형태가 달라 별도 검토. 이 플랜에서 결정하지 않는다.

**검증**: common 81 · inventory 29 · fulfillment 17 · order 20 · product 16 · quant 129 · commerce 3(`CommerceContextLoadSpec` Testcontainers 로
inventory EMF 가 common 엔티티 두 개를 inventory_db 에 매핑하는 것까지) 전부 통과, `verifyLayerDependencies` 통과.

## P6 — 테스트 소스셋 없는 모듈 ✅ 2026-08-26

`agent-viewer/api`(예외 — 도구) 제외 5개 모두 소스셋 생김 — `warehouse/feature` `WarehouseServiceTest`, `member/feature` `MemberServiceTest`,
`gifticon/domain` `GifticonTest`·`ExpiryAlertPolicyTest`, `gifticon/app` `GifticonServiceTest`, `chatbot/app` `PromptBuilderTest`·`ChatServiceTest`.
전부 Port MockK 단위 테스트(Spring 컨텍스트 없음). 체크리스트 §8 "소스셋 없는 모듈 금지" 가 이후 신규를 막는다.

## 완료 기준 — 전부 충족 (2026-08-26)

- ✅ 게이트 allowlist 에 `search:domain`(②) 만 남는다.
- ✅ 실측 집계: `dir≠pkg 0 · app→infra 0 · UseCase-class 0 · 테스트 소스셋 부재 0(도구 제외)`.
- ✅ `package-structure.md` 의 "레거시 디렉토리 (이행 중)" 절 삭제.
