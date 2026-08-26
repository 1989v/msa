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

## 구조 상태 (ADR-0083)

표준 준수 (2026-08-26, P7 완료) — UseCase 인터페이스 18(`application/{entity}/usecase`, P7 신설) · Port 12(`application/*/port`, 인덱스 alias 교체도 `IndexAliasPort`) · Adapter 9 · application → infrastructure import 0. P4 까지는 아웃바운드만 맞춰져 있었고 컨트롤러가 `*Service` 를 직접 주입했다 — 게이트 규칙 ④가 이걸 막는다. **폴드 호스트**로서 game·deal·blog·ranking 의 레이어 상태는 각자의 `CLAUDE.md` 에 있다 — 호스트가 준수해도 폴드된 모듈이 어기면 게이트가 호스트 빌드를 막는다.

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

### ★ 도메인을 폴드할 때 고치는 곳은 **세 군데**다

하나라도 빠지면 증상이 전부 다르고, **그중 하나는 배포가 성공한 것처럼 보인다.**

| 파일 | 무엇 | 빠뜨렸을 때 |
|---|---|---|
| `CodeDictionaryApplication.kt` | `@SpringBootApplication(scanBasePackages)` | **조용한 404** — 컨텍스트도 뜨고 Flyway 도 도는데 그 도메인 컨트롤러만 매핑 안 됨 |
| `DataSourceConfig.kt` | `entityManagerFactory().packages(...)` | 기동 실패 `not a managed type` |
| `CodeDictionaryJpaConfig.kt` | `@EnableJpaRepositories` basePackages | 리포지토리 빈 없음 |

- **`@EntityScan` 은 아무 효과가 없다.** EMF 가 `DataSourceConfig` 에 명시 정의돼 Boot 자동
  구성이 back-off 한 상태다. 붙여두면 다음 사람이 스캔되는 줄 믿는다
- **game 은 예외** — 전용 datasource/EMF 를 `GameDataSourceConfig` 가 따로 갖는다
- 실측: deal(ADR-0069) 때 EMF 를, blog(ADR-0072) 때 scanBasePackages 를 빠뜨렸다.
  **스캔 누락은 파드가 Ready 로 뜨고 다른 도메인도 멀쩡해서 배포 성공으로 보이는데 그 도메인 API 만
  전부 404 다. 기존 컨텍스트 로드 테스트도 통과한다**(엔티티·리포지토리만 봤으므로)
- **막는 유일한 자동 장치**: `CodeDictionaryContextLoadSpec` 의 "폴드된 도메인의 컨트롤러가
  전부 빈으로 등록된다" 케이스에 새 컨트롤러를 한 줄 추가한다

### ★ 적용된 Flyway 마이그레이션은 편집하지 않는다

main 이 곧 배포 브랜치라 커밋 몇 분 뒤 **이미 운영 DB 에 적용된 상태**일 수 있다.
편집하면 `validate` 가 EMF 생성 단계에서 실패해 서비스가 통째로 기동하지 못하고,
**이 앱은 폴드 호스트라 개념사전·게임·전시·이력서·딜·블로그·랭킹이 전부 함께 죽는다**
(2026-08-21 약 1시간). **이미지 태그 롤백이 안 듣는 것**이 이 사고의 특징이다 —
이미지가 아니라 파일과 DB 의 불일치라 옛 이미지도 같은 체크섬 오류로 죽는다.

- 바꿔야 하면 **언제나 다음 번호**로 뺀다 (CHECK 제약이면 `DROP CHECK` → `ADD CONSTRAINT`)
- 사고 시: `SELECT version, checksum, success FROM flyway_schema_history` 로 적용본을 확인하고
  로컬 파일의 Flyway CRC32 와 비교해 **어느 내용이 적용됐는지 특정한 뒤** 그 내용으로 되돌린다.
  추측으로 repair 하지 않는다. 운영 DB 조회는 `~/.local/bin/oci-mysql code_dictionary_db "..."`
- **새 마이그레이션을 붙이기 전에 최신 번호를 확인한다** — 여러 세션이 한 워킹트리를 써서
  같은 번호를 동시에 잡은 적이 실제로 있다. 겹치면 Flyway 가 기동을 거부하고,
  그러면 테스트 게이트가 죽어 **그 커밋의 모든 서비스 이미지가 안 만들어진다**

## Related

- seed: `docs/portfolio-seed.md`, `docs/portfolio-dummy-seed.sql`
- 이력서 작성 절차: `docs/resume-admin-guide.md` (어드민에서 콘텐츠 채우는 순서·필드·검증)
- 시각화 스펙: `docs/specs/2026-05-05-code-dictionary-treemap/` (root docs)
