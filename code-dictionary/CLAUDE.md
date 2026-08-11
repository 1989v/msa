# Code Dictionary Service

IT 개념 사전 — 코드베이스에서 추출한 개념을 색인하고 OpenSearch 로 검색,
트리맵/그래프로 시각화한다. 포트폴리오 카드(작업 이력 노출)도 이 서비스가 소유.
FE 는 별도 앱이 아니라 **portal-fe 단일 SPA 의 메인 콘텐츠**로 통합돼 있다 (2026-05-05).

## Modules

| Gradle path | 역할 |
|---|---|
| `:code-dictionary:domain` | Pure Kotlin 도메인 (concept, portfolio) |
| `:code-dictionary:app` | Spring Boot 앱 (port 8089) — **game:feature 호스트** (ADR-0059 폴드, `game/CLAUDE.md` 참조) |

> game 도메인은 전용 datasource(`game_db`)/EMF/TM/Flyway(`gamedb/migration`)를 갖는 별도 바운디드
> 컨텍스트다. code-dictionary 리포지토리는 `CodeDictionaryJpaConfig` 가 명시 등록한다
> (game 의 `@EnableJpaRepositories` 로 Boot 자동 구성이 back-off 하기 때문).

## Commands

```bash
./gradlew :code-dictionary:app:build       # 빌드
./gradlew :code-dictionary:domain:test     # 도메인 테스트 (Spring context 없음)
./gradlew :code-dictionary:app:test        # 앱 테스트
```

## Architecture

- Clean Architecture: presentation → application(port) → infrastructure(adapter)
- 영속성: MySQL + Flyway (`db/migration/V1~V5`), Querydsl 조회 (`{Entity}QueryRepository`)
- 검색: OpenSearch 색인 (`infrastructure/opensearch`, ADR-0055)
- 캐시: `infrastructure/cache`

## Domains

| 도메인 | 설명 |
|---|---|
| concept | IT 개념 + 코드 참조 색인. `reindex` 스킬이 추출한 개념을 `/api/v1/index` 로 적재 |
| portfolio | 포트폴리오 카드 (PUBLIC/PRIVATE, impact 1~10). 스펙: `docs/specs/2026-06-10-portfolio-card/` |
| resume | 이력서 사이트(resume.1989v.com) 문서·공유토큰·열람기록. 본문은 마크다운 TEXT. ADR-0064 |
| display | 1989v.com 메인에 전시하는 서비스 (OPEN/PREOPEN/HOLD). ADR-0066 |

## API Endpoints (요약)

| Prefix | 설명 |
|--------|------|
| `GET /api/v1/concepts` (+graph, treemap stats, CRUD) | 개념 조회/관리, 그래프/트리맵 데이터 |
| `GET /api/v1/search`, `/api/v1/search/suggest` | 개념 검색 + 자동완성 |
| `POST /api/v1/index`, `/api/v1/index/sync` | 색인 적재/동기화 (job 상태 조회 포함) |
| `GET /api/v1/services` | 서비스 카탈로그 |
| `GET /api/v1/portfolio/cards`, `/cards/{id}` | 포트폴리오 카드 목록/상세 (PUBLIC 만) |
| `GET /api/v1/portfolio/timeline` | 메인 타임라인 — 재직 기간·직무 + **개인 프로젝트만** (ADR-0066) |
| `GET /api/v1/display/services` | 메인 전시 서비스 (HOLD 제외) |
| `/api/v1/admin/display/services` | 전시 CRUD (ROLE_ADMIN) |
| `GET /api/v1/resume/status` | 이력서 공개 여부 (게이트 없음 — 메인 진입점 판단용) |
| `GET /api/v1/resume/overview`, `/documents/{slug}` | 이력서 본문. 토큰 게이트 통과 실패 시 404 |
| `/api/v1/admin/resume/**` | 문서 CRUD · 공유 토큰 발급/폐기 · 공개 토글 · 열람 기록 (ROLE_ADMIN) |

## Key Rules

- 응답은 공통 `ApiResponse<T>` 포맷
- 포트폴리오 상세에서 PRIVATE 카드는 NOT_FOUND (존재 여부 은닉)
- JpaEntity 가변 컬럼은 `private set` + 엔티티 메서드 변경 (entity-mutation.md)
- 무거운 조회는 Repository interface `@Query` 대신 Querydsl QueryRepository (jpa-persistence.md §5)

## Related

- seed: `docs/portfolio-seed.md`, `docs/portfolio-dummy-seed.sql`
- 시각화 스펙: `docs/specs/2026-05-05-code-dictionary-treemap/` (root docs)
