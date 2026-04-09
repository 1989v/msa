# Monitoring Infrastructure Design — Spec 1.5

**Date**: 2026-04-09
**Status**: Approved
**Author**: AI-assisted

---

## 1. Overview

MSA 플랫폼에 메트릭 수집/시각화 인프라를 추가한다. 1차로 Prometheus + Grafana를 구축하고, ELK(Logstash+Kibana) + Zipkin은 Docker Compose에 주석으로 준비해둔다.

### 범위

| 항목 | 1차 (이번 구현) | 2차 (주석 준비) |
|------|----------------|----------------|
| Micrometer + Prometheus | 구현 | - |
| Grafana | 구현 | - |
| ELK (Logstash + Kibana) | - | docker-compose 주석 |
| Zipkin | - | docker-compose 주석 |

---

## 2. Architecture

```
Spring Boot Services
  └── Micrometer → /actuator/prometheus (메트릭 노출)

Prometheus (9090)
  └── scrape → 각 서비스 /actuator/prometheus (15초 간격)

Grafana (3000)
  └── datasource: Prometheus
  └── dashboards: JVM, HTTP, 서비스 현황
```

### 네트워크

- Prometheus, Grafana는 Docker 내부 네트워크에서 각 서비스의 actuator 엔드포인트를 scrape
- Grafana는 `localhost:3000`으로 외부 접근
- Admin FE 시스템 페이지에서 Grafana iframe 임베드

---

## 3. Spring Boot 변경

### 3.1 의존성 추가 (각 서비스 build.gradle.kts)

```kotlin
implementation("io.micrometer:micrometer-registry-prometheus")
```

대상 서비스: product, order, search, auth, gateway, code-dictionary, member, gifticon, wishlist, inventory, fulfillment, warehouse, chatbot, analytics, experiment

### 3.2 Actuator 설정 (각 서비스 application.yml)

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus
  endpoint:
    health:
      show-details: always
  metrics:
    tags:
      application: ${spring.application.name}
```

Docker profile(application-docker.yml)에도 동일 설정 추가.

---

## 4. Docker Compose

### 4.1 신규 파일: docker/docker-compose.monitoring.yml

**1차 구현 (활성):**
- Prometheus (prom/prometheus:latest, 포트 9090)
- Grafana (grafana/grafana:latest, 포트 3000)

**2차 준비 (주석):**
- Logstash (docker.elastic.co/logstash/logstash:8.17.0)
- Kibana (docker.elastic.co/kibana/kibana:8.17.0)
- Zipkin (openzipkin/zipkin:latest, 포트 9411)

### 4.2 Prometheus 설정

`docker/monitoring/prometheus.yml`:
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'spring-boot'
    metrics_path: '/actuator/prometheus'
    eureka_sd_configs:
      - server: 'http://discovery:8080/eureka'
    relabel_configs:
      - source_labels: [__meta_eureka_app_name]
        target_label: application
```

Eureka SD(Service Discovery)로 자동 타겟 등록 — 서비스 추가/제거 시 수동 설정 불필요.

대안 (Eureka SD 미지원 시): static_configs로 서비스 목록 하드코딩.

### 4.3 Grafana 프로비저닝

`docker/monitoring/grafana/provisioning/datasources/prometheus.yml`:
```yaml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    url: http://prometheus:9090
    isDefault: true
```

`docker/monitoring/grafana/provisioning/dashboards/dashboard.yml`:
```yaml
apiVersion: 1
providers:
  - name: default
    folder: ''
    type: file
    options:
      path: /var/lib/grafana/dashboards
```

사전 구성 대시보드 JSON:
- `jvm-dashboard.json` — JVM 메모리, GC, 스레드
- `http-dashboard.json` — HTTP 요청 수, 응답시간, 에러율
- `service-overview.json` — 서비스별 UP/DOWN, 요청량

### 4.4 Grafana 설정

- 익명 접근 허용 (Admin FE iframe 임베드용): `GF_AUTH_ANONYMOUS_ENABLED=true`
- iframe 허용: `GF_SECURITY_ALLOW_EMBEDDING=true`
- 초기 admin 비밀번호: `GF_SECURITY_ADMIN_PASSWORD=admin`

---

## 5. Admin FE 변경

### 5.1 시스템 페이지 확장

기존 Eureka + Health 체크 아래에 Grafana 대시보드 섹션 추가:

```
┌─ 시스템 ────────────────────────────────────────┐
│  서비스 상태 (기존 Eureka + Health)              │
├─────────────────────────────────────────────────┤
│  메트릭 대시보드                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  [Grafana iframe - JVM Dashboard]       │    │
│  └─────────────────────────────────────────┘    │
│  탭: [JVM] [HTTP] [서비스 현황]                  │
└─────────────────────────────────────────────────┘
```

- Grafana URL: `http://localhost:3000/d/{dashboard-uid}?orgId=1&theme=dark&kiosk`
- `kiosk` 모드로 Grafana 네비게이션 숨김
- 탭으로 대시보드 전환

---

## 6. Nginx 변경

`docker/nginx/conf.d/admin.conf`에 Grafana 프록시 추가:

```nginx
location /grafana/ {
    proxy_pass http://grafana:3000/;
    proxy_set_header Host $host;
}
```

---

## 7. File Map

### 신규 파일

| File | Responsibility |
|------|---------------|
| `docker/docker-compose.monitoring.yml` | Prometheus + Grafana + (주석: ELK, Zipkin) |
| `docker/monitoring/prometheus.yml` | Prometheus scrape 설정 |
| `docker/monitoring/grafana/provisioning/datasources/prometheus.yml` | Grafana 데이터소스 |
| `docker/monitoring/grafana/provisioning/dashboards/dashboard.yml` | 대시보드 프로비저닝 |
| `docker/monitoring/grafana/dashboards/jvm-dashboard.json` | JVM 대시보드 |
| `docker/monitoring/grafana/dashboards/http-dashboard.json` | HTTP 대시보드 |
| `docker/monitoring/grafana/dashboards/service-overview.json` | 서비스 현황 대시보드 |
| `admin/frontend/src/components/system/GrafanaEmbed.tsx` | Grafana iframe 컴포넌트 |

### 수정 파일

| File | Changes |
|------|---------|
| 각 서비스 `build.gradle.kts` (15개) | micrometer-registry-prometheus 의존성 추가 |
| 각 서비스 `application.yml` | actuator prometheus 엔드포인트 노출 |
| `docker/nginx/conf.d/admin.conf` | /grafana/ 프록시 추가 |
| `admin/frontend/src/pages/SystemPage.tsx` | Grafana 임베드 섹션 추가 |
