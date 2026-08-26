# Warehouse Service

창고 마스터 — `Warehouse` 생성/조회. inventory 는 `warehouse_id` 로만 참조한다 (ADR-0011 Phase 1 결정,
Phase 2 분리 검토는 미착수). `commerce:app` 에 폴드된 라이브러리 (ADR-0058).

## Modules

| Gradle path | 역할 |
|---|---|
| `:warehouse:domain` | Pure Kotlin 도메인 — `Warehouse`, `WarehouseException` |
| `:warehouse:feature` | 비-bootable 라이브러리 — 전용 datasource `warehouse_db` (`warehouseEntityManagerFactory` / `warehouseTransactionManager`, master/replica 라우팅) |

`warehouse/app/` 디렉토리는 비어 있다 (폴드 전 잔재) — 새 파일을 거기 만들지 않는다.

## Commands

```bash
./gradlew :warehouse:domain:test
./gradlew :warehouse:feature:build
./gradlew :commerce:app:build         # 배포 단위(폴드 앱)
```

## 구조 상태 (ADR-0083)

표준 준수 — UseCase 인터페이스 2(`Create`/`Get`), `WarehouseRepositoryPort`, adapter, 13 파일.
부채: **`feature` 에 테스트 소스셋이 없다** (플랜 P6). `src/main/resources` 도 없어 Flyway 마이그레이션이
없다 — 스키마는 `commerce:app` 의 `ddl-auto=validate` 아래 이미 존재하는 테이블에 기댄다. 컬럼을 바꾸면
`warehousedb/migration` 을 만들고 `ScopedFlywayMigrator` 를 배선한다 (루트 `verifyFlywayWiring` 이 검사).

## Key Rules

- Kafka 발행/소비 없음. 다른 도메인이 창고를 알 필요가 있으면 API 로 묻는다 (DB 조인 금지)
- `@Transactional("warehouseTransactionManager")` 명시
- 응답은 `ApiResponse<T>` (`WarehouseResponse`)

## Docs

- 용어: `warehouse/glossary.md`
- ADR: `docs/adr/ADR-0011-inventory-fulfillment-service.md` §1, `ADR-0058-service-consolidation.md`
