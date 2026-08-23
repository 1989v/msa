# Tasks — 랭킹 리더보드 P1 (주유소)

> spec.md 기준. 순서는 의존 순이다.
> **키가 없어도 TG-6 까지 전부 만들 수 있다** — 샘플 JSONL 로 E2E 를 태운다.

## TG-1 · 도메인 코어 (`ranking:domain`)

- [x] 모듈 생성 — `ranking/domain/build.gradle.kts` (Spring/JPA 의존 없음, `common` 만)
- [x] `RankingDomain` / `RankingMetric` / `SortDirection` enum
- [x] `RankingBoard` · `RankingSnapshot` · `RankingEntry` · `Movement` sealed interface
- [x] `Ranker` — 점수 목록 + 이전 순위 맵 → 엔트리 목록
- [x] 테스트 (`./gradlew :ranking:domain:test`, Spring context 없음)
  - 동점은 같은 순위, 다음은 건너뜀 (1,1,3)
  - 이전에 없던 대상 → `prevRank = null` (0 이나 최하위가 아니다)
  - 이번에 없는 대상 → 엔트리 없음 (유령 순위 금지)
  - 첫 스냅샷 → 전부 NEW

## TG-2 · 영속성 + 폴드 배선

- [x] `ranking/feature/build.gradle.kts`
- [x] `V20__ranking.sql` — 5개 테이블 (`rank_no` 로 예약어 회피, enum STRING, FK-as-ID)
- [x] JPA 엔티티 + 리포지토리 (`com.kgd.ranking.infrastructure.persistence`)
- [x] **폴드 배선 세 군데** — 하나라도 빠지면 조용한 404
  - [x] `CodeDictionaryApplication.kt` `scanBasePackages` += `com.kgd.ranking`
  - [x] `CodeDictionaryJpaConfig.kt` `@EnableJpaRepositories` += `com.kgd.ranking`
  - [x] `DataSourceConfig.kt` EMF `.packages(...)` += `com.kgd.ranking`
- [x] `settings.gradle.kts` include + `code-dictionary/app` 의존 추가

## TG-3 · 수집기 (`ranking/ingest`)

- [x] `place/ingest` 구조 복제 (Dockerfile · `src/main.py` · `tests/`)
- [x] `opinet.py` — 지역코드 조회 · 지역별 주유소 · 상세정보 클라이언트
- [x] `katec.py` — **KATEC(TM128) → WGS84** (`pyproj`), 원본 좌표 보존
  - [x] 골든 좌표 테스트 (좌표가 알려진 지점 3~5곳, 허용 오차 수 m)
- [x] 한도/429 → **즉시 중단** (부분 적재 금지)
- [x] `stations.sample.jsonl` — 키 없이 E2E 가 돌아가는 샘플
- [x] 내부 적재 API `POST /internal/ranking/gas/stations/bulk` (전체 동기화)
- [x] `GasStationDtoRoundTripTest` — 적재 가능 필드 = 조회 가능 필드 (리플렉션 강제)
- [x] `UPSERT_FIELDS` 와 `GasStationResponse` **양쪽** 정의

## TG-4 · 보드 생성 + 스냅샷

- [x] 시군구 × 유종 보드 자동 생성/갱신 (slug `gas-{areaCode}-{productCode}`)
- [x] 스냅샷 배치 — 적재분 → 점수(가격) → `Ranker` → `ranking_entry` 저장
- [x] `latest_snapshot_id` 갱신은 스냅샷 커밋 후 (조회가 반쪽 스냅샷을 보면 안 된다)
- [x] 보존 정책 — 오래된 스냅샷 정리 (ADR-0077 원장 정책에 편입)

## TG-5 · 조회 API

- [x] `GET /api/v1/ranking/boards` · `/boards/{slug}` · `/gas/areas`
- [x] `ApiResponse<T>` 포맷, 페이징
- [x] **게이트웨이 `/api/v1/ranking/**` 라우트 추가** (`GatewayRouteConfig.kt`)
      — 빠뜨리면 배포는 성공하고 화면만 404
- [x] `/internal/**` 은 ingress 미노출 확인

## TG-6 · 길안내 (개정 — 구글맵 링크로 대체)

- [x] ~~Routes API 어댑터·폴리라인·이탈 근사~~ → **제거**. 출발지가 전국에 흩어져 캐시가 듣지
      않고 호출 수가 사용자 수를 따라간다 (ADR-0081 §6 개정)
- [x] 리더보드 각 줄에 **구글맵 길찾기 링크** (Maps URLs — 키·쿼터 없음)
- [x] 좌표 우선, 없으면 이름+주소 폴백
- [x] 상시 파드의 외부 `:443` egress 원복

## TG-7 · FE (`rank.1989v.com`)

- [x] `portal-fe` 호스트 분기 라우트 (`/`, `/boards/:slug`, `/route`)
- [x] 리더보드 — 순위·가격·등락 배지(NEW/↑n/↓n)·브랜드·셀프
- [x] 각 줄 길찾기 버튼 (모바일에서도 잘리지 않게 그리드 재배치)
- [x] **DESIGN.md 토큰만 사용** (hex 직접 입력 금지)
- [x] 하단 출처 표기 "출처: 한국석유공사 오피넷"
- [x] **신규 서브도메인 체크리스트 4단계**
  - [x] `k8s/overlays/oci-arm/ingresses/` host 블록
  - [x] `App.tsx` host 분기 + apex 리다이렉트
  - [x] 프리렌더 `_hosts/$host` 키 (ADR-0062)
  - [x] `portal-fe/src/shell/serviceHref.ts` `SUBDOMAIN_ORIGIN` 한 줄
- [ ] CDP 실측 검증 (기기×사이트 4조합) — `fe-visual-verification.md`

## TG-8 · 배포 + 문서 동기화

- [x] `ranking/ingest` CronJob + Secret `ranking-ingest-secrets`
- [x] `display_service` 행 추가 (메인 런처 타일, ADR-0066) — V20 에서 PREOPEN 으로. 실데이터 붙으면 OPEN 으로
- [x] **`docs/architecture/data-sources.md` 대장에 오피넷 · Google Routes 두 줄**
      — 코드에만 있고 대장에 없으면 없는 것으로 친다
- [x] 루트 `CLAUDE.md` 서비스 표 + FE 진입 구조 표에 `ranking` / `rank.1989v.com` 추가
- [x] `ranking/CLAUDE.md` 작성

## 사용자 작업 (블로킹)

| # | 작업 | 막히는 것 |
|---|---|---|
| 1 | 공공데이터포털에서 한국석유공사 5종 **활용신청** (기존 `DATA_GO_KR_KEY` 재사용) | 실데이터 (샘플로 개발은 진행 가능) |

> 길안내는 링크라 키가 필요 없다 — 사용자 작업이 하나로 줄었다.
