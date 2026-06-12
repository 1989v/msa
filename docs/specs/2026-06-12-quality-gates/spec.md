# Spec — 품질 게이트: CI test-gate + Swagger UI 집계

> Status: Implemented (2026-06-12)
> Origin: 플랫폼 전반 갭 감사 (Track D — 엔터프라이즈 운영 갭).

## 1. CI test-gate (PR 단계 회귀 차단)

기존: PR CI 는 compile/yaml/kustomize 만 — 테스트는 main push 후 images.yml 에서야 실행되어
**회귀가 머지 후에 발견**되는 구조.

- `.github/workflows/ci.yml` 에 `test-gate` job 추가 (PR 전용).
- "PR 단계엔 빠른 게이트만" 원칙 유지: **변경된 JVM 서비스만** 테스트
  (merge-base diff → 서비스 매핑, images.yml 의 매핑과 동일하게 유지할 것).
- 공유 의존성 (common/, buildSrc/, gradle/) 변경 시에만 전체 JVM 테스트.
- JVM 변경 없으면 즉시 스킵.

## 2. Swagger UI 집계 (/api/docs)

기존: 16개 서비스가 springdoc 의존성을 갖고 있으나 **접근 경로가 없음** (gateway 라우팅 부재).

- gateway 에 `springdoc-openapi-starter-webflux-ui` 추가 (toml: `springdoc-openapi-starter-webflux-ui`).
- `GET /api/docs` — 서비스별 OpenAPI spec 드롭다운 Swagger UI.
- `GET /api/docs/specs/{service}` — 각 서비스 `/v3/api-docs` 프록시 (11개:
  product/order/search/inventory/gifticon/auth/fulfillment/warehouse/recommendation/member/wishlist).
- 모든 경로가 `/api/*` prefix → 기존 ingress 의 gateway 라우팅 그대로 동작
  (`springdoc.webjars.prefix=/api/webjars` 로 정적 자산도 prefix 내 정렬).

## 3. 분산 추적 (OTel + Tempo) — 미구현, 후속 최우선

ADR-0028 (Accepted, 2026-05-02) 이 OpenTelemetry + Tempo 도입을 이미 결정했으나 **코드에 미반영**
(tracing 의존성 grep 0건). ADR-0025 Latency Budget 의 P99 측정도 이것 없이는 불가.

19개 서비스 + collector 인프라 + Kafka 헤더 전파를 일괄 적용해야 하는 대규모 작업이라
본 트랙에서 절반 구현하지 않고 후속으로 분리한다. 구현 시 ADR-0028 의 Phase 계획을 따를 것.
중앙 로깅 (Loki) 부재도 동일 묶음.

## Verification

- `./gradlew :gateway:build` → BUILD SUCCESSFUL (test 포함, 2026-06-12)
- ci.yml: Psych YAML 파싱 OK (CI yaml-validate 와 동일 검증기)
- Swagger UI 렌더는 클러스터 기동 후 `/api/docs` 수동 확인 필요 (코드 레벨 검증 한계)
