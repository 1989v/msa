# Tasks — 랭킹 리더보드 P1 (주유소)

> spec.md 기준. 순서는 의존 순이다.
> **키가 없어도 TG-6 까지 전부 만들 수 있다** — 샘플 JSONL 로 E2E 를 태운다.

## TG-1 · 도메인 코어 (`ranking:domain`)

- [ ] 모듈 생성 — `ranking/domain/build.gradle.kts` (Spring/JPA 의존 없음, `common` 만)
- [ ] `RankingDomain` / `RankingMetric` / `SortDirection` enum
- [ ] `RankingBoard` · `RankingSnapshot` · `RankingEntry` · `Movement` sealed interface
- [ ] `Ranker` — 점수 목록 + 이전 순위 맵 → 엔트리 목록
- [ ] 테스트 (`./gradlew :ranking:domain:test`, Spring context 없음)
  - 동점은 같은 순위, 다음은 건너뜀 (1,1,3)
  - 이전에 없던 대상 → `prevRank = null` (0 이나 최하위가 아니다)
  - 이번에 없는 대상 → 엔트리 없음 (유령 순위 금지)
  - 첫 스냅샷 → 전부 NEW

## TG-2 · 영속성 + 폴드 배선

- [ ] `ranking/feature/build.gradle.kts`
- [ ] `V20__ranking.sql` — 5개 테이블 (`rank_no` 로 예약어 회피, enum STRING, FK-as-ID)
- [ ] JPA 엔티티 + 리포지토리 (`com.kgd.ranking.infrastructure.persistence`)
- [ ] **폴드 배선 세 군데** — 하나라도 빠지면 조용한 404
  - [ ] `CodeDictionaryApplication.kt` `scanBasePackages` += `com.kgd.ranking`
  - [ ] `CodeDictionaryJpaConfig.kt` `@EnableJpaRepositories` += `com.kgd.ranking`
  - [ ] `DataSourceConfig.kt` EMF `.packages(...)` += `com.kgd.ranking`
- [ ] `settings.gradle.kts` include + `code-dictionary/app` 의존 추가

## TG-3 · 수집기 (`ranking/ingest`)

- [ ] `place/ingest` 구조 복제 (Dockerfile · `src/main.py` · `tests/`)
- [ ] `opinet.py` — 지역코드 조회 · 지역별 주유소 · 상세정보 클라이언트
- [ ] `katec.py` — **KATEC(TM128) → WGS84** (`pyproj`), 원본 좌표 보존
  - [ ] 골든 좌표 테스트 (좌표가 알려진 지점 3~5곳, 허용 오차 수 m)
- [ ] 한도/429 → **즉시 중단** (부분 적재 금지)
- [ ] `stations.sample.jsonl` — 키 없이 E2E 가 돌아가는 샘플
- [ ] 내부 적재 API `POST /internal/ranking/gas/stations/bulk` (전체 동기화)
- [ ] `GasStationDtoRoundTripTest` — 적재 가능 필드 = 조회 가능 필드 (리플렉션 강제)
- [ ] `UPSERT_FIELDS` 와 `GasStationResponse` **양쪽** 정의

## TG-4 · 보드 생성 + 스냅샷

- [ ] 시군구 × 유종 보드 자동 생성/갱신 (slug `gas-{areaCode}-{productCode}`)
- [ ] 스냅샷 배치 — 적재분 → 점수(가격) → `Ranker` → `ranking_entry` 저장
- [ ] `latest_snapshot_id` 갱신은 스냅샷 커밋 후 (조회가 반쪽 스냅샷을 보면 안 된다)
- [ ] 보존 정책 — 오래된 스냅샷 정리 (ADR-0077 원장 정책에 편입)

## TG-5 · 조회 API

- [ ] `GET /api/v1/ranking/boards` · `/boards/{slug}` · `/gas/areas`
- [ ] `ApiResponse<T>` 포맷, 페이징
- [ ] **게이트웨이 `/api/v1/ranking/**` 라우트 추가** (`GatewayRouteConfig.kt`)
      — 빠뜨리면 배포는 성공하고 화면만 404
- [ ] `/internal/**` 은 ingress 미노출 확인

## TG-6 · 경로 탐색

- [ ] `GoogleRoutesClient` — Routes API(legacy Directions 아님) 1콜, encoded polyline
- [ ] 폴리라인 디코더 + 약 3km 간격 샘플링
- [ ] 후보 산출 — 샘플별 반경 조회 → `opinet_id` dedupe → 이탈시간 근사 → 필터 → 정렬
- [ ] 테스트: 근접 중복 미발생 / `detourLimitMin=0` 이면 빈 결과가 정상 / 출발=도착 퇴화 입력
- [ ] 키 없으면 이 기능만 비활성 (리더보드는 정상)

## TG-7 · FE (`rank.1989v.com`)

- [ ] `portal-fe` 호스트 분기 라우트 (`/`, `/boards/:slug`, `/route`)
- [ ] 리더보드 — 순위·가격·등락 배지(NEW/↑n/↓n)·브랜드·셀프
- [ ] 경로 탐색 — 출발·도착 입력 + 결과 카드 + 지도
- [ ] **DESIGN.md 토큰만 사용** (hex 직접 입력 금지)
- [ ] 하단 출처 표기 "출처: 한국석유공사 오피넷"
- [ ] **신규 서브도메인 체크리스트 4단계**
  - [ ] `k8s/overlays/oci-arm/ingresses/` host 블록
  - [ ] `App.tsx` host 분기 + apex 리다이렉트
  - [ ] 프리렌더 `_hosts/$host` 키 (ADR-0062)
  - [ ] `portal-fe/src/shell/serviceHref.ts` `SUBDOMAIN_ORIGIN` 한 줄
- [ ] CDP 실측 검증 (기기×사이트 4조합) — `fe-visual-verification.md`

## TG-8 · 배포 + 문서 동기화

- [ ] `ranking/ingest` CronJob + Secret `ranking-ingest-secrets`
- [ ] `GOOGLE_ROUTES_API_KEY` 앱 Secret 주입
- [ ] `display_service` 행 추가 (메인 런처 타일, ADR-0066)
- [ ] **`docs/architecture/data-sources.md` 대장에 오피넷 · Google Routes 두 줄**
      — 코드에만 있고 대장에 없으면 없는 것으로 친다
- [ ] 루트 `CLAUDE.md` 서비스 표 + FE 진입 구조 표에 `ranking` / `rank.1989v.com` 추가
- [ ] `ranking/CLAUDE.md` 작성

## 사용자 작업 (블로킹)

| # | 작업 | 막히는 것 |
|---|---|---|
| 1 | opinet.co.kr 회원가입 → **무료 API 이용신청** | 실데이터 (샘플로 개발은 진행 가능) |
| 2 | GCP → **Routes API** 사용 설정 + **서버 키(IP 제한)** | 경로 탐색 실동작 |

> ②는 Maps JS 키와 **분리**한다. 한 키에 리퍼러·IP 제한을 같이 걸 수 없어 한쪽이 죽는다.
