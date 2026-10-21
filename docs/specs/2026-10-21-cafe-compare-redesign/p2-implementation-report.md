# Cafe P2 구현 보고서 — 2026-10-21

작업 위치: `/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/3fb13e69-6cda-425a-8052-5640a70eb768/scratchpad/wt-cafe`.
이 보고서는 기존 P1/2nd UI 보고서와 별개다. 코드 구현·로컬 검증이 끝났으며 운영 출시는 하지 않았다.
`ranking.cafe.nearby-verified=false` 기본, CronJob `suspend:true`를 유지한다. 커밋·푸시·배포·UI 도구 실행 없음.

## 구현과 API

- 전국 SOHO 카페/베이커리 분류별 전체 페이지 수집, 원천 전체 필드 보존과 별도 매핑, 브랜드9종.
- V5 `cafe_store`, `cafe_store_snapshot`, `cafe_store_area`; ranking 전용 트랜잭션 전체 동기화.
  실패/빈/부분/개수 급변 시 교체 취소, 동일 버전 재시도 멱등, 완전 대조2회 누락 뒤 비활성화.
- `POST /internal/ranking/cafe/stores/bulk`: 배치 전체 스냅샷만 수신. ingress/gateway 미노출.
- `GET /api/v1/ranking/cafe/capability`: 소스·지역 준비 + 검수 스위치 +90일 신선도 게이트.
- `GET /api/v1/ranking/cafe/areas?parent=`: 현재 원천과 일치하는 실제 지역/공식 대표 중심점.
- `POST /api/v1/ranking/cafe/nearby-search`: CURRENT 좌표 또는 AREA 코드, 반경0.5/1/3km(기본1),
  모든 비교 조건/선택 변형/총량·농도/정렬/페이지. bbox→haversine, 후보5,000 초과 LIMITED/총수null.
  응답의 좌표는 공개 매장 위치뿐이다. 브랜드 영양 부재 매장 수는 `nearbyStoresWithoutNutrition`으로 구분.
- 1회 명시 위치 버튼, 거절·취소·실패 지역 대체, 늦은 콜백/응답 취소, 이탈/pagehide 폐기.
  좌표 URL/storage/query cache 없음. C03 상세→C04에 정확한 변형과 상세의 유효 기준을 메모리로 전달.
- 기존 Google Maps 키/로더·markerclusterer 지연 재사용. 공개 매장 위치만 전달한다.
  매장별 브랜드/당류 요약·Google 목적지만 길찾기·Naver 정확한 지점명 검색 링크.
  메뉴 판매 미확인·원천과 수집일·영양 출처/확인일·지역 중심점 출처/공공누리 링크 표시.
- gateway 고정 경로 로그/no-store, 좌표 요청 DTO toString redaction, 전용 generic error/no-store,
  동시16요청 초과429. 원천 호출은 배치뿐이고 서버 검색은 외부 API를 호출하지 않는다.

## 수용 기준

| 항목 | 구현/증거 | 운영 검증 |
|---|---|---|
| P2-1 | 자동 위치 요청0, 버튼1회, 거절→지역/다른 시도·시군구, 취소/late 응답 테스트 | 실기기 권한 UX 미확인 |
| P2-2 | 9브랜드 별칭/경계/충돌, 혼합 브랜드·유사 상호 REVIEW, 원문 보존 | 실표본 최대30건/브랜드·정밀도98% 검수 필요. 게이트 OFF |
| P2-3 | 전국 배치 원천/완전성 검사, 지원 지역 실제 코드 교집합 | 독립 매장 표본 포함률 검증 필요. 전국 전량 주장 없음 |
| P2-4 | DB만 조회, 상시 파드/새지도 SDK/타일서버/검색클러스터 추가0 | 지도 요구가 기존 타일0 제안을 대체(ADR-0113). Google 지도 선택 시 네트워크 발생 |
| P2-5 | POST본문·redacted DTO·generic error/no-store, gateway 로그 표식·FE 비저장/abort 회귀 | 실제 ingress/gateway/app/APM/analytics/error 전체 표식 비검출 검증 필요 |
| P2-6 | 매장 기준일/수집일/CONFIRMED/판매미확인, 영양 null·variant 선택/자동선택 안내 | 실제 데이터 표시/매핑 검수 필요 |
| P2-7 | bbox+후보상한+페이지 이전 전체 영양 정렬+동시처리 상한 | 동시5요청10분 P95≤800ms/오류<1%/기존지연≤10% 실측 필요 |
| P2-8 | 불완전/빈/한도/급변/실패 유지, 재시도·2회누락·45/90일 테스트 | 실제 스냅샷/DB 트랜잭션/소스 새배포 운영 검증 필요 |
| P2-9 | Naver 검색 링크/Google 목적지 링크, 사용자 출발좌표 없음 테스트 | 실제 외부 지도 표시/지점 일치 확인 필요 |

## 원천/키와 다음 운영 작업

공식 SOHO 안내/활용신청: https://www.data.go.kr/data/15012005/openapi.do . CLI로 공식 페이지의
내장 Swagger와 이용허락범위 제한 없음을 읽었다. `storeListInUpjong`의 필수 divId/key,
smallUpjongList, 최대1,000행 계약을 확인했다. 키를 써서 live 원천을 호출하지 않았다.

환경 `SOHO_API_KEY`, `DATA_GO_KR_KEY`, `SANGGA_API_KEY` 모두 미설정이었다.
기존 참조 `tools/seed/place/normalize_pois.py`는 DATA_GO_KR_KEY와 샘플 fallback을 쓰지만 재사용하지 않는다.
기존 place CronJob Secret은 TOUR_API_KEY/tour-api-key 등이므로 SOHO 활용승인 증거가 아니다.
새 canonical 키는 **SOHO_API_KEY**, Secret **ranking-ingest-secrets/soho-api-key**다.
로컬 DATA_GO_KR_KEY 대체는 지원한다. Secret 실값을 출력하거나 파일에 저장하지 않았다.

공식 지역 중심점은 https://www.data.go.kr/data/15084084/openapi.do 현재 가이드
FILE_000000007732424/1의 2610.zip(XLSX)에서 가져왔다. 위경도 N/O열이며 격자 F/G가 아니다.
272개 유효 시도/시군구 중심점, 원문 상위행/파일SHA256/출처를 번들한다. 0,0 이어도 예보행 제외.
시군구의 5자리 상위코드+00000만 사용, 읍면동 행정동/GeoNames 혼용 없음. 원천 개편 시점이 다르면
SOHO 실제 signguCd 교집합만 공개한다. source publication date와 수집일은 서로 덮지 않는다.
CLI 기본(--areas 미지정)에서 번들 지역이 실제 포함되는 회귀 테스트가 있다.

운영자가 키 활용승인/Secret 배선 후 수집을 먼저 검증하고 브랜드별 표본·포함률·운영 로그/APM·부하
증거를 남긴 뒤 CronJob 해제와 공개 스위치를 설정해야 한다. 그 전에는 FE 주변 진입점이 숨겨진다.
가짜 fixture를 live 데이터로 게시한 적이 없다.

## 최종 검증

| 명령 | 실제 결과 | 원문 로그 |
|---|---|---|
| `./gradlew :ranking:domain:test :ranking:feature:test --no-daemon --console=plain` | **BUILD SUCCESSFUL in 37s**. XML: domain132/feature49, 실패0 | `/tmp/cafe-gradle-final3.log` |
| `cd ranking/ingest && python3 -m unittest discover -s tests` | **Ran 14 tests in 0.009s / OK** | `/tmp/cafe-python-final.log` |
| `cd portal-fe && npx vitest run src/pages/rank src/seo` | **338 passed / 2 failed**, 32파일 통과·1실패. Cafe 전부 통과 | `/tmp/cafe-vitest-final.log` |
| `cd portal-fe && node scripts/render-content.mjs && npx tsc -b` (before) | exit0, 오류0 | `/tmp/cafe-tsc-before.log` |
| `cd portal-fe && npx tsc -b` (after) | exit0, 오류0. 기존/신규 오류 목록 모두 비어 있음 | `/tmp/cafe-tsc-after.log` |
| `./gradlew verifyArchitecture :gateway:test --no-daemon --console=plain` | **BUILD SUCCESSFUL in 37s**, gateway145 실패0, 좌표 로그/no-store 회귀 포함 | `/tmp/cafe-architecture-gateway-final.log` |
| `./gradlew verifyArchitecture --no-daemon --console=plain` (최종) | **BUILD SUCCESSFUL in 10s** | `/tmp/cafe-architecture-final.log` |
| `git diff --check` | exit0 | 현 작업트리 |

SEO 두 실패는 `gameCatalogGuides.test.tsx`의 ko/en 추천 게임 slug 기대값 불일치다.
HEAD 버전 테스트를 같은 위치의 임시 baseline 파일로 실행해 동일 **2 failed /3 passed**를 재현했다
(`/tmp/cafe-seo-baseline.log`); 임시 파일은 제거했고 관련 게임 소스/테스트는 변경하지 않았다.
따라서 전체 FE suite가 녹색이라고 주장하지 않는다. 실제 Google 지도·권한 팝업·배포된 로그/APM·부하는
컴퓨터 사용/배포를 하지 않았으므로 검증하지 않았다. Docker 필요 MySQL 운영동등 스키마 검증은
별도 수행하지 않았다(로컬 단위/Querydsl H2 suite 결과와 구분).

문서 스캔 `python3 ai/plugins/hns/scripts/doc_scan.py --base HEAD`는 submodule 스크립트가 없어
`[Errno 2] No such file or directory`로 실행 불가(`/tmp/cafe-doc-scan.log`). 관련 문서는 수동 동기화했다.
lockfile·공유 design token·기존 UI 보고서 변경 없음.

## 검토 수정

- CLI 기본 빈 areas 전달 수정 및 main([]) 번들 중심점 회귀.
- 혼합 브랜드/스타벅스풍카페 등 prefix 오인 확정 방지, REVIEW 원문 유지.
- C03 정확한 변형 + 유효 detailBasis를 memoized 조건으로 주변에 전달.
- SOHO 출처와 AREA KMA 중심점 provenance/라이선스 표시.
- 위치 폐기 때 pending/error·fetch를 즉시 정리하고 late 응답 무시.
- 물리 매장 부재와 비교 영양 자료 부재를 구분.

## 변경 파일 (추적/미추적 모두)

- `docs/architecture/data-sources.md`
- `gateway/src/main/kotlin/com/kgd/gateway/filter/RequestLoggingFilter.kt`
- `k8s/base/ranking-ingest/kustomization.yaml`
- `portal-fe/src/api/rankingApi.ts`
- `portal-fe/src/pages/rank/CafePage.css`
- `portal-fe/src/pages/rank/CafePage.tsx`
- `portal-fe/src/pages/rank/__tests__/CafePage.test.tsx`
- `ranking/CLAUDE.md`
- `ranking/ingest/README.md`
- `docs/adr/ADR-0113-cafe-nearby-store-projection.md`
- `gateway/src/test/kotlin/com/kgd/gateway/filter/CafeNearbyLoggingTest.kt`
- `k8s/base/ranking-ingest/cronjob-cafe.yaml`
- `portal-fe/src/pages/rank/CafeNearby.tsx`
- `portal-fe/src/pages/rank/CafeNearbyMap.tsx`
- `portal-fe/src/pages/rank/__tests__/CafeNearby.test.tsx`
- `ranking/domain/src/main/kotlin/com/kgd/ranking/domain/cafe/model/CafeGeo.kt`
- `ranking/domain/src/test/kotlin/com/kgd/ranking/domain/cafe/model/CafeGeoTest.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/application/cafe/dto/CafeNearbyDtos.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/application/cafe/port/CafeStoreRepositoryPort.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/application/cafe/service/CafeNearbyService.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/application/cafe/usecase/CafeNearbyUseCases.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/infrastructure/persistence/adapter/CafeStoreRepositoryAdapter.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/infrastructure/persistence/entity/CafeStoreJpaEntities.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/infrastructure/persistence/repository/CafeStoreJpaRepositories.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/presentation/controller/CafeNearbyController.kt`
- `ranking/feature/src/main/resources/rankingdb/migration/V5__cafe_store_snapshot.sql`
- `ranking/feature/src/test/kotlin/com/kgd/ranking/CafeNearbyPrivacyTest.kt`
- `ranking/feature/src/test/kotlin/com/kgd/ranking/CafeNearbyServiceTest.kt`
- `ranking/feature/src/test/kotlin/com/kgd/ranking/CafeStoreRepositoryAdapterTest.kt`
- `ranking/ingest/src/cafe_stores.py`
- `ranking/ingest/src/data/cafe_areas.json`
- `ranking/ingest/src/data/cafe_areas.provenance.json`
- `ranking/ingest/tests/test_cafe_stores.py`
- `docs/specs/2026-10-21-cafe-compare-redesign/p2-implementation-report.md`
- `docs/specs/2026-10-21-cafe-compare-redesign/context/p2-progress.md`
