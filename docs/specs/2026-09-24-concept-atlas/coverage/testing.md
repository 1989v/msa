# 테스트 — 커버리지 체크리스트

원천:
- 지난 라운드 testing.yaml 의 개념 29개
- docs/standards/test-rules.md (Kotest BehaviorSpec · MockK · 레이어별 목 규칙)
- 하네스 규칙(전역 CLAUDE.md): 회귀 주입 · 「검사는 대상의 산출물을 본다」 · 건너뜀이 초록불이 되지 않게
- 레포 테스트 코드: product · seller · ads · quant(속성 기반 · 포트 계약 스펙 · 태그) · commerce(통합 · E2E · 건너뜀 차단) · gateway(WebTestClient · StepVerifier) · portal-fe(Vitest) · .github/workflows/images.yml · scripts/network-policy-smoke-test.sh
- 분야 표준: Fowler 「Test Pyramid」 · Kent C. Dodds 「Testing Trophy」 · Meszaros 「xUnit Test Patterns」(더블 5종 · 테스트 스멜) · Khorikov 「Unit Testing Principles」(고전파/런던파 · 상태/상호작용 검증) · 「Software Engineering at Google」(플래키 · 밀폐 테스트 · 테스트 규모) · Pact(소비자 주도 계약) · PIT(뮤테이션)
- study/ 카탈로그에는 테스트 주제가 없다 — 재료는 위 목록이 전부다

| id | 개념 | 출처 | 배치 |
|---|---|---|---|
| test-verification | 테스트 | 기존 파일 | placed |
| test-design | 테스트 설계 | 기존 파일 | placed |
| tdd | TDD | 기존 파일 | placed |
| bdd | BDD | 기존 파일 | placed |
| test-atdd | ATDD | 분야 표준 | placed |
| test-classical-school | 고전파 테스트 | test-rules.md(레이어별 목 규칙) | placed |
| test-london-school | 런던파 테스트 | test-rules.md(레이어별 목 규칙) | placed |
| test-state-verification | 상태 검증 | 코드(product · seller 테스트) | placed |
| test-behavior-verification | 상호작용 검증 | 코드(quant 테스트) | placed |
| test-equivalence-partitioning | 동치 분할 | 분야 표준 | placed |
| test-boundary-value-analysis | 경계값 분석 | 코드(ads 테스트) | placed |
| test-parameterized | 파라미터화 테스트 | 코드(ads 테스트) | placed |
| test-property-based | 속성 기반 테스트 | 코드(quant 테스트) | placed |
| test-arbitrary-generator | 임의값 생성기 | 코드(quant 테스트) | placed |
| test-shrinking | 축소 | 분야 표준 | placed |
| test-fuzzing | 퍼징 | 분야 표준 | placed |
| test-snapshot-testing | 스냅샷 테스트 | 분야 표준 | placed |
| test-black-box-testing | 블랙박스 테스트 | 분야 표준 | placed |
| test-white-box-testing | 화이트박스 테스트 | 분야 표준 | placed |
| test-implementation-coupling | 구현 결합 테스트 | 분야 표준(Meszaros xUnit Patterns) | placed |
| kotest | Kotest | 기존 파일 | placed |
| vitest | Vitest | 코드(CI · 스크립트 · portal-fe) | placed |
| test-scope | 검증 범위 선택 | 기존 파일 | placed |
| test-pyramid | 테스트 피라미드 | 분야 표준(Fowler · Dodds) | placed |
| test-trophy | 테스팅 트로피 | 분야 표준(Fowler · Dodds) | placed |
| unit-test | 단위 테스트 | 기존 파일 | placed |
| test-component-test | 컴포넌트 테스트 | 코드(commerce · gateway 테스트) | placed |
| integration-test | 통합 테스트 | 기존 파일 | placed |
| test-contract-test | 계약 테스트 | 분야 표준 | placed |
| test-consumer-driven-contract | 소비자 주도 계약 | 분야 표준 | placed |
| test-port-contract-spec | 포트 계약 스펙 | 코드(quant 테스트) | placed |
| e2e-test | E2E 테스트 | 기존 파일 | placed |
| test-smoke-test | 스모크 테스트 | 코드(CI · 스크립트 · portal-fe) | placed |
| test-regression-test | 회귀 테스트 | 분야 표준 | placed |
| test-exploratory-testing | 탐색적 테스트 | 분야 표준 | placed |
| test-ice-cream-cone | 아이스크림 콘 | 분야 표준(Fowler · Dodds) | placed |
| test-coverage | 테스트 커버리지 | 기존 파일 | placed |
| test-branch-coverage | 분기 커버리지 | 분야 표준 | placed |
| test-isolation | 의존 격리 | 기존 파일 | placed |
| test-double-substitution | 테스트 더블 치환 | 기존 파일 | placed |
| test-disposable-dependency | 일회용 실물 의존 | 기존 파일 | placed |
| test-shared-container | 컨테이너 공유 | 코드(ads 테스트) | placed |
| test-service-virtualization | HTTP 스텁 서버 | 분야 표준 | placed |
| test-transaction-rollback | 트랜잭션 롤백 격리 | 분야 표준 | placed |
| mockk | MockK | 기존 파일 | placed |
| testcontainers | Testcontainers | 기존 파일 | placed |
| test-overmocking | 목 남용 | 기존 파일 | placed |
| test-data-setup | 테스트 데이터 준비 | 구조 노드 | placed |
| test-data-builder | 테스트 데이터 빌더 | 코드(product · seller 테스트) | placed |
| test-object-mother | 오브젝트 마더 | 코드(quant 테스트) | placed |
| test-setup-teardown | 준비 · 정리 훅 | 분야 표준(Meszaros xUnit Patterns) | placed |
| test-mystery-guest | 미스터리 게스트 | 분야 표준(Meszaros xUnit Patterns) | placed |
| test-shared-mutable-fixture | 공유 가변 픽스처 | 분야 표준(Meszaros xUnit Patterns) | placed |
| test-reliability | 테스트 안정성 | 구조 노드 | placed |
| test-determinism | 결정성 확보 | 분야 표준 | placed |
| test-fixed-clock | 시각 고정 | 코드(product · seller 테스트) | placed |
| test-seeded-random | 시드 고정 난수 | 코드(quant 테스트) | placed |
| test-async-testing | 비동기 코드 테스트 | 분야 표준 | placed |
| test-async-await-polling | 조건 대기 폴링 | 코드(commerce · gateway 테스트) | placed |
| test-reactive-stream-verification | 리액티브 스트림 검증 | 코드(commerce · gateway 테스트) | placed |
| test-order-independence | 순서 독립 · 병렬 실행 | 분야 표준 | placed |
| test-quarantine | 불안정 테스트 격리 | 분야 표준(Google SWE) | placed |
| test-rerun-on-failure | 실패 재실행 | 분야 표준 | placed |
| test-flaky | 플래키 테스트 | 분야 표준(Google SWE) | placed |
| test-order-dependency | 순서 의존 | 분야 표준 | placed |
| test-fixed-sleep | 고정 sleep 대기 | 분야 표준 | placed |
| test-slow-suite | 느린 스위트 | 분야 표준 | placed |
| test-flaky-rate | 플래키 비율 | 분야 표준(Google SWE) | placed |
| test-suite-duration | 스위트 실행 시간 | 분야 표준 | placed |
| test-gating | 게이트 증명 | 기존 파일 | placed |
| test-changed-module-gate | 변경 모듈 테스트 게이트 | 기존 파일 | placed |
| test-impact-analysis | 영향 분석 테스트 선택 | 코드(CI · 스크립트 · portal-fe) | placed |
| test-coverage-gate | 커버리지 게이트 | 분야 표준 | placed |
| regression-injection | 회귀 주입 | 기존 파일 | placed |
| test-mutation-testing | 뮤테이션 테스트 | 하네스 규칙 | placed |
| test-fail-on-skip | 건너뜀 차단 | 기존 파일 | placed |
| test-false-green | 거짓 초록불 | 기존 파일 | placed |
| test-coverage-gaming | 커버리지 채우기 | 하네스 규칙 | placed |
| test-mutation-score | 뮤테이션 점수 | 분야 표준 | placed |
| test-glossary | 테스트 용어 사전 | 기존 파일 | placed |
| test-glossary-doubles | 테스트 더블 | 기존 파일 | placed |
| test-dummy | 더미 | 분야 표준(Meszaros xUnit Patterns) | placed |
| mock | 목 | 기존 파일 | placed |
| stub | 스텁 | 기존 파일 | placed |
| test-spy | 스파이 | 코드(product · seller 테스트) | placed |
| test-fake | 페이크 | 기존 파일 | placed |
| test-sut | 테스트 대상(SUT) | 분야 표준(Meszaros xUnit Patterns) | placed |
| fixture | 픽스처 | 기존 파일 | placed |
| test-given-when-then | given · when · then | 기존 파일 | placed |
| test-assertion | 단언 | 기존 파일 | placed |
| test-oracle | 테스트 오라클 | 하네스 규칙 | placed |
| test-suite | 테스트 스위트 | 분야 표준 | placed |
| test-tag | 테스트 태그 | 코드(quant 테스트) | placed |
| test-seam | 심(Seam) | 분야 표준 | placed |
| test-hermetic | 밀폐 테스트 | 분야 표준(Google SWE) | placed |
| test-invariant | 불변식 | 분야 표준 | placed |
| test-mutant | 뮤턴트 | 분야 표준 | placed |
| obs-load-testing | 부하 테스트 | 분야 표준 | excluded — owned by observability — test-scope 가 k6 로 USES 한다 |
| obs-stress-test | 스트레스 테스트 | 분야 표준 | excluded — owned by observability |
| obs-soak-test | 소크 테스트 | 분야 표준 | excluded — owned by observability |
| obs-spike-test | 스파이크 테스트 | 분야 표준 | excluded — owned by observability |
| obs-microbenchmark | 마이크로벤치마크 | 분야 표준 | excluded — owned by observability |
| k6 | k6 | scripts/perf/sse-load.k6.js | excluded — owned by observability — test-scope 가 USES 로 잇는다 |
| jmh | JMH | 분야 표준 | excluded — owned by observability |
| dist-chaos-engineering | 카오스 엔지니어링 | 분야 표준 | excluded — owned by distributed — test-scope 가 USES 로 잇는다 |
| dist-jepsen-testing | Jepsen 테스트 | 분야 표준 | excluded — owned by distributed |
| conc-concurrency-stress-test | 동시성 스트레스 테스트(jcstress) | 분야 표준 | excluded — owned by concurrency — test-reliability 가 USES 로 잇는다 |
| spring-test-context | 스프링 테스트 컨텍스트 · 캐시 | 코드(ConceptServiceCacheEvictTest @DirtiesContext) | excluded — owned by spring |
| spring-test-slice | 스프링 테스트 슬라이스 | 분야 표준 | excluded — owned by spring — test-component-test 가 USES 로 잇는다 |
| spring-webtestclient | WebTestClient | 코드(GatewayRoutingSpec) | excluded — owned by spring — test-component-test 가 USES 로 잇는다 |
| spring-mockmvc | MockMvc | 분야 표준 | excluded — owned by spring |
| spring-test-bean-override | 테스트 빈 교체(@MockkBean) | 분야 표준 | excluded — owned by spring — test-isolation 이 USES 로 잇는다 |
| arch-layer-dependency-gate | 아키텍처 테스트(레이어 의존 게이트) | CLAUDE.md(ADR-0083) | excluded — owned by architecture — test-gating 이 USES 로 잇는다 |
| arch-pod-topology-gate | 파드 배분 게이트 | CLAUDE.md(ADR-0093) | excluded — owned by architecture — test-gating 이 USES 로 잇는다 |
| arch-testability | 테스트 용이성 | 분야 표준 | excluded — owned by architecture |
| sec-sast | 정적 보안 분석 | 분야 표준 | excluded — owned by security |
| sec-dast | 동적 보안 분석 | 분야 표준 | excluded — owned by security |
| sec-penetration-testing | 모의 해킹 | 분야 표준 | excluded — owned by security |
| ab-test | A/B 테스트 | 분야 표준 | excluded — owned by search — 이름만 테스트이고 온라인 실험이다 |
| ord-saga-e2e-test | 주문 사가 E2E 테스트 | 코드(OrderSagaE2ETest) | excluded — owned by commerce-order — 도메인 구체형이다 |
