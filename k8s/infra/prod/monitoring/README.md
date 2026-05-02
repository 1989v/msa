# kube-prometheus-stack

Prometheus + Alertmanager + Grafana + exporters + ServiceMonitor CRDs
via the community Helm chart (ADR-0019 Phase 4). Replaces the
compose-based Prometheus/Grafana stack from `docker/monitoring/`.

## Install

```bash
helm repo add prometheus-community \
  https://prometheus-community.github.io/helm-charts
helm upgrade --install kube-prometheus-stack \
    prometheus-community/kube-prometheus-stack \
    --namespace monitoring --create-namespace \
    --values values.yaml
```

## values.yaml highlights

- **prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues:
  false** — lets ServiceMonitors from other namespaces register
  without Helm label gymnastics.
- **grafana.sidecar.dashboards.enabled: true** — picks up any
  ConfigMap labelled `grafana_dashboard: "1"` automatically. This is
  the target location for the dashboards migrating from
  `docker/monitoring/grafana/provisioning/dashboards/` during
  Phase 6's docker-compose teardown.
- **grafana.sidecar.datasources.enabled: true** — same mechanism for
  datasource provisioning.
- **grafana.ingress** disabled by default; the overlay's gateway
  Ingress handles the public entrypoint. For a dedicated Grafana
  URL, re-enable and add a hostname.

## ServiceMonitor for app services

Every Spring Boot app exposes Prometheus metrics via the Actuator
at `/actuator/prometheus`. Create one ServiceMonitor per service (or
a global one that targets the shared `part-of=commerce-platform`
label) so kube-prometheus-stack starts scraping automatically.

A starter ServiceMonitor is in `servicemonitor-apps.yaml`.

## PrometheusRule (alerts)

Alert rule 은 `*-alerts.yaml` 파일로 분리해서 관리한다 (kube-prometheus-stack 의
`PrometheusRule` CRD). chart default selector 는 `release: kube-prometheus-stack`
라벨을 사용하므로 본 파일들도 동일 라벨을 명시한다.

```bash
# 현재 적용 가능한 rule 파일
kubectl apply -f order-cancellation-alerts.yaml      # ADR-0032 PR-4
kubectl apply -f idempotent-alerts.yaml              # ADR-0029 PR-9
```

Runbook 링크 anchor 는 `docs/runbooks/` 의 파일과 매칭. 알람 추가 시 runbook 동시 갱신.

## Dashboard migration

The existing Grafana dashboards under
`docker/monitoring/grafana/provisioning/dashboards/` are JSON files.
To move them here:

1. Create one ConfigMap per dashboard, labelled
   `grafana_dashboard: "1"`, in the `monitoring` namespace.
2. Mount the JSON content under `data.<dashboard>.json`.
3. Grafana's sidecar detects the label and imports the dashboard on
   the fly — no Grafana restart needed.

The migration script and the exported dashboards land in the Phase 6
commit that tears down `docker/monitoring/`.
