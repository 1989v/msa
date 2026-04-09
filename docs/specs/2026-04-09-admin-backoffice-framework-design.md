# Admin Backoffice Framework Design — Spec 1

**Date**: 2026-04-09
**Status**: Approved
**Author**: AI-assisted

---

## 1. Overview

MSA 플랫폼의 통합 백오피스 관리 도구. 운영 대시보드 + 시스템 모니터링 + CRUD 관리 화면의 프레임워크를 구축한다.

### Spec 분할

| Spec | 범위 |
|------|------|
| **Spec 1 (이 문서)** | 프레임워크 (레이아웃, 인증, Nginx) + 대시보드 + 시스템 모니터링 |
| **Spec 1.5** | 모니터링 인프라 (Prometheus, Grafana, ELK, Zipkin) |
| **Spec 2** | 관리 메뉴 (회원/상품/주문/코드사전/프로필 CRUD) |

### Goals
- ROLE_ADMIN 권한을 가진 사용자만 접근 가능한 관리 도구
- 여러 MSA 서비스의 운영 지표를 한 화면에서 조회
- 서비스 헬스 상태를 실시간 모니터링
- 향후 CRUD 관리 메뉴를 손쉽게 추가할 수 있는 프레임워크

---

## 2. Architecture

### 2.1 프로젝트 구조

```
admin/
└── frontend/                   # React + Vite + shadcn/ui + Tailwind
    ├── src/
    │   ├── components/         # 공통 UI (Layout, Sidebar, Header, DataTable 등)
    │   │   ├── layout/         # Layout, Sidebar, Header, ThemeToggle
    │   │   └── ui/             # shadcn/ui 컴포넌트
    │   ├── pages/              # 페이지 컴포넌트
    │   │   ├── LoginPage.tsx
    │   │   ├── DashboardPage.tsx
    │   │   └── SystemPage.tsx
    │   ├── api/                # axios 클라이언트
    │   ├── hooks/              # useAuth, useFetch 등
    │   ├── lib/                # shadcn 유틸, cn()
    │   ├── types/              # 타입 정의
    │   └── App.tsx             # 라우터 설정
    ├── tailwind.config.ts
    ├── vite.config.ts
    └── package.json
```

FE only. BFF 없음. 각 서비스 API를 Nginx → Gateway 경유로 직접 호출.

### 2.2 네트워크 구조

```
Browser
  ├── /admin/**          → Nginx → admin FE (정적 파일 or Vite dev)
  ├── /api/**            → Nginx → Gateway(8080) → 각 서비스
  └── /                  → Nginx → code-dictionary FE
```

개발 환경:
- admin FE: Vite dev server (포트 5175)
- Nginx proxy: `/admin` → `localhost:5175`, `/api` → `localhost:8080`

운영 환경:
- admin FE: `admin/frontend/dist/` 정적 서빙
- Nginx가 직접 서빙

### 2.3 기술 스택

| 기술 | 용도 |
|------|------|
| React 19 + TypeScript | UI 프레임워크 |
| Vite | 빌드 도구 |
| shadcn/ui | UI 컴포넌트 (copy-paste, Tailwind 기반) |
| Tailwind CSS | 스타일링, 다크/라이트 테마 |
| TanStack Table | 데이터 테이블 (향후 CRUD) |
| TanStack Query | 서버 상태 관리, 캐싱, 자동 리페치 |
| Recharts | 차트 (대시보드) |
| React Router | 클라이언트 라우팅 |
| axios | HTTP 클라이언트 |

---

## 3. Authentication

### 3.1 로그인 흐름

1. `/admin` 접속 → JWT 없으면 `/admin/login`으로 리다이렉트
2. 로그인 페이지에서 OAuth 버튼 (Google/Kakao) 클릭
3. 기존 auth 서비스 OAuth 플로우 실행
4. JWT 수령 → roles claim에서 `ROLE_ADMIN` 확인
5. `ROLE_ADMIN` 없으면 "권한이 없습니다" 안내 화면
6. `ROLE_ADMIN` 있으면 대시보드 진입

### 3.2 JWT 관리

- localStorage에 accessToken 저장
- axios interceptor: 모든 요청에 `Authorization: Bearer {token}` 자동 첨부
- 401 응답 시 로그인 페이지로 리다이렉트
- 토큰 만료 체크: JWT decode → exp 필드 확인

### 3.3 Gateway 라우트 보호

Gateway `application.yml`에 admin API 라우트 추가:
- `/api/**` 라우트 중 어드민 전용 엔드포인트는 `ROLE_ADMIN` 메타데이터 설정
- 기존 AuthenticationGatewayFilter가 roles claim 검증 (ADR-0018 기반)

---

## 4. Layout

### 4.1 구조

```
┌─ Header (56px, sticky) ────────────────────────┐
│  ☰ Admin    [검색]           테마토글 · 사용자 · 로그아웃│
├─ Sidebar (240px, 접힘 시 64px) ┬── Content ────┤
│  📊 대시보드                    │               │
│  👥 회원 관리 (비활성)          │  (페이지)      │
│  📦 상품 관리 (비활성)          │               │
│  📋 주문 관리 (비활성)          │               │
│  📖 코드 사전 (비활성)          │               │
│  👤 프로필 (비활성)             │               │
│  🖥 시스템                      │               │
├────────────────────────────────┴───────────────┤
```

- Header: 사이드바 토글, 검색, 다크/라이트 테마 토글, 사용자 정보, 로그아웃
- Sidebar: 접힘/펼침 토글 (아이콘만 / 아이콘+텍스트)
- Spec 1에서 활성 메뉴: 대시보드, 시스템
- 나머지 메뉴는 비활성 상태로 표시 (Spec 2에서 활성화)

### 4.2 테마

- Tailwind CSS `dark:` 클래스 기반 다크/라이트 전환
- 기본: 다크 모드
- localStorage에 테마 설정 저장

### 4.3 반응형

- Desktop (>1024px): Sidebar 펼침 + Content
- Tablet (768~1024px): Sidebar 접힘 (아이콘만)
- Mobile (<768px): Sidebar 숨김, 햄버거 메뉴로 드로어

---

## 5. Dashboard Page

### 5.1 운영 지표 카드 (상단, 4개)

| 카드 | API | 표시 |
|------|-----|------|
| 오늘 주문 | `GET /api/v1/orders?today=true` (order) | 건수 + 전일 대비 증감% |
| 오늘 매출 | `GET /api/v1/orders/revenue?today=true` (order) | 금액 + 전일 대비 증감% |
| 신규 가입 | `GET /api/members/count?today=true` (member) | 명수 + 전일 대비 증감% |
| 총 회원 수 | `GET /api/members/count` (member) | 누적 수 |

- API가 아직 없는 경우: 0 또는 "N/A" 표시 (에러 핸들링)
- TanStack Query로 5분 간격 자동 리페치

### 5.2 차트 (중단)

**주문/매출 추이 (7일):**
- Recharts AreaChart
- X축: 최근 7일, Y축: 주문 건수 + 매출 금액 (dual axis)
- API: `GET /api/v1/orders/stats/daily?days=7` (없으면 빈 차트)

**카테고리별 매출 비중:**
- Recharts PieChart
- API: `GET /api/v1/orders/stats/by-category` (없으면 빈 차트)

### 5.3 서비스 상태 요약 (하단)

- Eureka 인스턴스 수 + UP/DOWN 카운트
- 간단한 서비스 목록 (이름 + 상태 배지)
- "시스템 페이지로 이동" 링크

### 5.4 데이터 로딩 전략

```typescript
// Promise.all로 병렬 호출
const [orders, revenue, members, eureka] = await Promise.all([
  fetchTodayOrders(),
  fetchTodayRevenue(),
  fetchMemberCount(),
  fetchEurekaApps(),
]);
```

API 실패 시 해당 카드만 에러 표시, 나머지는 정상 렌더링 (graceful degradation).

---

## 6. System Page

### 6.1 서비스 인스턴스 현황

- Eureka API: `GET /eureka/apps` (Gateway 경유 or Discovery 직접)
- 서비스별 카드:
  - 서비스 이름
  - 인스턴스 수
  - 포트
  - 상태: UP (녹색) / DOWN (빨간)
  - 마지막 heartbeat 시간
- 상태별 필터: 전체 / UP만 / DOWN만

### 6.2 헬스 체크 상세

- 각 서비스 `/actuator/health` 병렬 호출
- 서비스 클릭 → 확장 패널:
  - DB (MySQL) 상태
  - Redis 상태
  - Kafka 상태
  - OpenSearch/Elasticsearch 상태
  - Disk 상태
- 각 하위 컴포넌트별 상태 배지 (UP/DOWN/UNKNOWN)

### 6.3 자동 새로고침

- 30초 간격 자동 새로고침 (TanStack Query `refetchInterval: 30000`)
- 수동 새로고침 버튼
- 마지막 조회 시간 표시

---

## 7. Nginx Configuration

### 7.1 개발 환경

`docker/nginx/conf.d/default.conf`에 추가:
```nginx
location /admin {
    proxy_pass http://host.docker.internal:5175;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

### 7.2 운영 환경

```nginx
location /admin {
    alias /usr/share/nginx/html/admin/;
    try_files $uri $uri/ /admin/index.html;
}
```

### 7.3 기존 라우트 유지

```nginx
location /api {
    proxy_pass http://gateway:8080;
}
location / {
    # code-dictionary FE 또는 기타 메인 FE
}
```

---

## 8. File Structure (신규 파일)

```
admin/
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.ts
    ├── postcss.config.js
    ├── tsconfig.json
    ├── tsconfig.app.json
    ├── index.html
    ├── src/
    │   ├── App.tsx
    │   ├── main.tsx
    │   ├── index.css                  # Tailwind base
    │   ├── lib/
    │   │   └── utils.ts               # cn() 유틸
    │   ├── api/
    │   │   ├── client.ts              # axios 인스턴스 + interceptor
    │   │   ├── dashboard.ts           # 대시보드 API 함수
    │   │   ├── system.ts              # 시스템/Eureka API 함수
    │   │   └── auth.ts                # 인증 관련 API
    │   ├── hooks/
    │   │   ├── useAuth.ts             # JWT 관리, 로그인 상태
    │   │   └── useTheme.ts            # 다크/라이트 토글
    │   ├── components/
    │   │   ├── layout/
    │   │   │   ├── AppLayout.tsx       # Header + Sidebar + Content 조합
    │   │   │   ├── Header.tsx
    │   │   │   ├── Sidebar.tsx
    │   │   │   └── ThemeToggle.tsx
    │   │   ├── dashboard/
    │   │   │   ├── StatCard.tsx        # 지표 카드
    │   │   │   ├── OrderChart.tsx      # 주문/매출 AreaChart
    │   │   │   ├── CategoryPieChart.tsx
    │   │   │   └── ServiceSummary.tsx  # 서비스 상태 요약
    │   │   └── system/
    │   │       ├── ServiceCard.tsx     # 서비스 인스턴스 카드
    │   │       └── HealthDetail.tsx    # 헬스 체크 상세 패널
    │   ├── pages/
    │   │   ├── LoginPage.tsx
    │   │   ├── UnauthorizedPage.tsx
    │   │   ├── DashboardPage.tsx
    │   │   └── SystemPage.tsx
    │   └── types/
    │       ├── auth.ts
    │       ├── dashboard.ts
    │       └── system.ts
    └── components.json                # shadcn/ui 설정
```

---

## 9. 기존 서비스 변경

### 9.1 Nginx (docker/nginx/)
- `/admin` 라우트 추가

### 9.2 Actuator 확장 (각 서비스 application.yml)
- `management.endpoints.web.exposure.include`에 `health,info,metrics` 추가
- `management.endpoint.health.show-details: always` (상세 헬스)

### 9.3 Gateway (선택)
- Eureka API 프록시 라우트 추가: `/eureka/**` → Discovery 서비스
- 또는 FE에서 Discovery 직접 호출 (CORS 설정 필요)

---

## 10. 향후 확장 (Spec 2, Spec 1.5)

### Spec 1.5: 모니터링 인프라
- Micrometer + Prometheus (메트릭 수집)
- Grafana (시각화, 백오피스에 iframe 임베드)
- ELK stack (Logstash + Kibana, 로그 집약)
- Zipkin (분산 트레이싱)

### Spec 2: 관리 메뉴
- 회원 관리: TanStack Table CRUD
- 상품 관리: TanStack Table CRUD
- 주문 관리: 목록/상세/상태변경
- 코드 사전: 개념/인덱스 CRUD + OpenSearch 동기화
- 프로필: About 섹션 데이터 CRD
