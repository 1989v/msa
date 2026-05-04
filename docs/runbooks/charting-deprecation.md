# Runbook — charting 서비스 폐기 절차

ADR-0033 / ADR-0034 / charting/docs/adr/ADR-001 Errata.

## 단계

### 1. 트래픽 검증 (Phase 1 종료 ~ Phase 2 진입)
- `/quant/charts` 메뉴와 `/api/v1/charts/**` 가 모든 charting 기능 (OHLCV / 패턴 유사도 / 미래 수익률 예측) 을
  동등 이상으로 제공하는지 1주 모니터링.
- ingress 로그에서 `/charting/`, `/charting-api/` 경로의 트래픽이 0 에 수렴하는지 확인.

### 2. Soft scale 0 (롤백 가능)
```bash
# k3s-lite overlay kustomization.yaml 의 patches 에 추가:
- path: patches/charting-replicas-zero.yaml
  target:
    kind: Deployment
    name: charting
- path: patches/charting-replicas-zero.yaml
  target:
    kind: Deployment
    name: charting-fe

kubectl apply -k k8s/overlays/k3s-lite
```
이 시점에 charting deployment 는 replicas=0. 매니페스트 자체는 보존 — 롤백 시 패치 제거 후 재적용.

### 3. Hard remove (Phase 2 진입 확정 시)
1. `k8s/base/kustomization.yaml` 에서 `charting`, `charting-fe` 제거
2. `k8s/base/frontend-ingress.yaml` 에서 `/charting/`, `/charting-api/` 경로 제거
3. `k8s/base/charting/` 및 `k8s/base/charting-fe/` 디렉토리 삭제
4. `charting/` 서브모듈 자체 또한 별도 archive 브랜치로 보존 후 main 에서 분리
5. ADR-001 (charting) Status: `Accepted (Superseded in part)` → `Superseded`
6. 루트 CLAUDE.md 의 `charting` 행 삭제 또는 archive 표기

### 4. pgvector 데이터 마이그레이션
- charting 의 `pattern` 테이블 → quant_postgres 의 `quant_pattern` 으로 INSERT SELECT
- 임베딩 골든 테스트 (PatternEmbedderSpec) 통과 확인
- (선택) charting 의 PostgreSQL StatefulSet 폐기

## 롤백

| 단계 | 롤백 |
|---|---|
| 2. Soft scale 0 | `patches/charting-replicas-zero.yaml` 제거 + apply |
| 3. Hard remove | git revert 후 apply |
| 4. 데이터 마이그 후 | charting PostgreSQL 백업본 복원 (오래 지나면 stale) |

## 모니터링 키

- ingress-nginx access log: `/charting/`, `/charting-api/` 트래픽 추이
- `quant_indicator_calc_latency_seconds` (Phase 1 후반) — quant 측 처리 지연
- charting 측 health check 는 Phase 2 진입 후 비활성
