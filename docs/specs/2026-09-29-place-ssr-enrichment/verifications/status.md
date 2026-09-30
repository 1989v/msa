# 그룹 검증 기록

| 그룹 | 명령 | 결과 |
|---|---|---|
| TG1 | `./gradlew :search:domain:test --tests '*AttractionAttributeParserTest' --tests '*ClosedTodayTest' --tests '*RegionAggregatorTest'` | AttractionAttributeParserTest 11/0 · ClosedTodayTest 4/0 · RegionAggregatorTest 8/0 (tests/failures) |
| TG1 | `./gradlew verifyArchitecture` | exit=0 |
| TG1 | 회귀 주입 | 시도 코드 제외 → `expected:<2> but was:<3>` · 해석 못 한 휴무 무시 → `29 assertions failed` · UTC 요일 → ClosedTodayTest FAILED · 복원 후 초록 |
| TG2 | `./gradlew :search:batch:test --tests '*AttractionApiReindexTaskletTest' --tests '*AttractionsIndexMappingTest' --tests '*PlaceApiClientTest' :search:app:test --tests '*AttractionSearchDocumentTest' verifyArchitecture :search:app:compileKotlin` | exit=0 · Tasklet 10/0 · Mapping 3/0 · PlaceApiClient 10/0 · SearchDocument 3/0 |
| TG2 | 회귀 주입 | region→null failures=3 · parking→null `expected YES but was UNKNOWN` · 읽기 문서 sigunguName 삭제 → verifySearchIndexContract FAILED · enabled:false 삭제 → 매핑 테스트 실패 |
| TG2 | 운영 기준선(배포 전) | attractions_20260928193032 docs 59,735 · 283MB |
| TG2+ | 영문 시도 이름 `PlaceApiClientTest` | 12/0 · 회귀 주입(영문 분기 끔) `Values differed at keys 11` |
| TG3 | `./gradlew :search:app:test --tests '*AttractionPage*' --tests '*AttractionShellProviderTest' --tests '*AttractionJsonLdParityTest' verifyArchitecture` | Service 3/0 · Renderer 17/0 · Controller 5/0 · ShellProvider 4/0 · Parity 7/0 |
| TG3 | `npx vitest run src/seo src/pages/place` | 9 files · 146 passed · 골든 재생성 diff 없음 |
| TG3 | 회귀 주입 | escape 제거 · data-seo-multi 제거 · copy.mjs 필드 제거 · findById 2회 · 30초 백오프 제거 → 각각 빨간불 |
| TG3+ | 상세 응답 속성·지역 필드 `SearchAttractionServiceTest` | 21/0 · 회귀 주입(closureState 매핑 삭제) `Expected "WEEKLY" but actual was null` · search:app 전체 21 classes 135/0 |
| TG2 수정 | 운영 재색인이 1차 훑기에서 14분 멈춤 — place 클라이언트 시간 제한 없음 + OFFSET 페이징(OFFSET 59000 = 4,892ms, 키셋 266ms, 버퍼 풀 128MB, 행 평균 6KB) | 키셋 `afterId` + 연결 5초·응답 60초 |
| TG2 수정 | `./gradlew :place:feature:test (Service·Controller·SchemaIntegration) :search:batch:test (Tasklet·PlaceApiClient) verifyArchitecture :content:app:compileKotlin` | Service 5/0 · Controller 2/0 · SchemaIntegration(Testcontainers MySQL) 2/0 · Tasklet 11/0 · PlaceApiClient 15/0 · RoundTrip 1/0 |
| TG2 수정 | 회귀 주입 | afterId→0L SchemaIntegration FAILED · 1차/2차 쪽 번호 전달 Tasklet FAILED · timeout 제거 PlaceApiClient FAILED |
| TG4 | `nginx -t`(템플릿 + env 두 개) · `kubectl kustomize k8s/overlays/{oci-arm,k3s-lite,prod-k8s}` · `verifyArchitecture` | successful · exit 0 ×3 · exit 0 |
| TG4 | 스텁 search + 실제 nginx:1.27-alpine | 숫자 id 만 전달 · Cookie/Authorization 미전달 · upstream 404 통과 · 500/5초 지연/중지 → 셸 200 `proxy-fallback` (3.02초 · 1.01초) · 비숫자 id 404 · /regions 프리렌더 유지 |
| TG4 | 회귀 주입(스크래치 사본) | Cookie 제거 줄 삭제 → cookie 전달됨 · error_page 에 404 추가 → 404 가 200 셸 · netpol 라벨 오타 → verifyPodTopology FAILED |
| TG4 | 운영 파드 전제 | command 덮어쓰기 없음 · root · 쓰기 가능 · /docker-entrypoint.d 에 15-local-resolvers·20-envsubst · nameserver 10.43.0.10 |
| 배포 ① | 04:30 정기 재색인(a0a78ea) | 5분 1초 · 별칭 전환 · 283→296.2MB · 속성 필드 59,735/59,735 · 경복궁 WEEKLY·종로구·고궁 10 · 영문 Seoul/Jongno-gu/Royal Palaces |
| 배포 ② 전 | 클러스터 안 `search:8083/internal/render/attractions/5000` | 200 · X-Render: ssr · 7,631B · title/h1 남원향교 · data-seo-multi 2 · 지역 문구 1 · 없는 id·비숫자 id 404 |
| 배포 ② T19 | 밖에서 Googlebot UA | /attractions/5000 200 ssr 9,141B <p>4 (전 4,623B title 1989v <p>0) · 32748 200 ssr · 999999999 404 ssr · abc 404 nginx · /regions/11110 프리렌더 유지 · rt.1989v.com/internal/… 404 · apex /internal/… 는 SPA 기본 셸(누출 아님) |
| 배포 ② T19 | 응답 내용 | 실제 셸(SPA 번들) · seo:server 1 · JSON-LD 2 · canonical place 경로 · 본문·지역 문구 · resolver 10.43.0.10 |
| 배포 ② T19 | 운영 미확인 | search 중단 폴백·쿠키 미전달은 스텁 nginx 로만 확인(단일 파드 롤링이라 운영에서 끊김 구간이 생기지 않음) |
