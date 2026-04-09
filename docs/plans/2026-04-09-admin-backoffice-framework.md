# Admin Backoffice Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MSA 플랫폼의 통합 백오피스 관리 도구 프레임워크(레이아웃, 인증, 대시보드, 시스템 모니터링)를 구축한다.

**Architecture:** FE-only SPA (React + shadcn/ui + Tailwind). BFF 없이 Nginx → Gateway → 각 서비스 API 직접 호출. admin.kgd.com 도메인 기반 라우팅. 기존 OAuth + JWT + ROLE_ADMIN RBAC 활용.

**Tech Stack:** React 19, TypeScript, Vite, shadcn/ui, Tailwind CSS, TanStack Query, TanStack Table, Recharts, React Router, axios

**Spec:** `docs/specs/2026-04-09-admin-backoffice-framework-design.md`

---

## File Map

### New Files — Project Scaffolding

| File | Responsibility |
|------|---------------|
| `admin/frontend/package.json` | 의존성 정의 |
| `admin/frontend/vite.config.ts` | Vite 설정 (proxy, base path) |
| `admin/frontend/tailwind.config.ts` | Tailwind 테마 설정 |
| `admin/frontend/postcss.config.js` | PostCSS + Tailwind |
| `admin/frontend/tsconfig.json` | TypeScript 설정 |
| `admin/frontend/tsconfig.app.json` | App 전용 TS 설정 |
| `admin/frontend/index.html` | 엔트리 HTML |
| `admin/frontend/components.json` | shadcn/ui 설정 |
| `admin/frontend/src/main.tsx` | React 엔트리 |
| `admin/frontend/src/index.css` | Tailwind base + 테마 변수 |
| `admin/frontend/src/lib/utils.ts` | cn() 유틸 |

### New Files — Core

| File | Responsibility |
|------|---------------|
| `admin/frontend/src/App.tsx` | React Router 설정 |
| `admin/frontend/src/api/client.ts` | axios 인스턴스 + JWT interceptor |
| `admin/frontend/src/api/auth.ts` | OAuth URL 생성, 토큰 관리 |
| `admin/frontend/src/api/dashboard.ts` | 대시보드 API 함수 |
| `admin/frontend/src/api/system.ts` | Eureka, Actuator API 함수 |
| `admin/frontend/src/hooks/useAuth.ts` | JWT 상태 관리, 로그인/로그아웃 |
| `admin/frontend/src/hooks/useTheme.ts` | 다크/라이트 테마 토글 |
| `admin/frontend/src/types/auth.ts` | 인증 타입 |
| `admin/frontend/src/types/dashboard.ts` | 대시보드 타입 |
| `admin/frontend/src/types/system.ts` | 시스템 모니터링 타입 |

### New Files — Layout

| File | Responsibility |
|------|---------------|
| `admin/frontend/src/components/layout/AppLayout.tsx` | Header + Sidebar + Content 조합 |
| `admin/frontend/src/components/layout/Header.tsx` | 상단 바 |
| `admin/frontend/src/components/layout/Sidebar.tsx` | 사이드 네비게이션 |
| `admin/frontend/src/components/layout/ThemeToggle.tsx` | 다크/라이트 토글 버튼 |

### New Files — Pages

| File | Responsibility |
|------|---------------|
| `admin/frontend/src/pages/LoginPage.tsx` | OAuth 로그인 |
| `admin/frontend/src/pages/UnauthorizedPage.tsx` | 권한 없음 안내 |
| `admin/frontend/src/pages/DashboardPage.tsx` | 운영 대시보드 |
| `admin/frontend/src/pages/SystemPage.tsx` | 시스템 모니터링 |

### New Files — Dashboard Components

| File | Responsibility |
|------|---------------|
| `admin/frontend/src/components/dashboard/StatCard.tsx` | 지표 카드 |
| `admin/frontend/src/components/dashboard/OrderChart.tsx` | 주문/매출 AreaChart |
| `admin/frontend/src/components/dashboard/CategoryPieChart.tsx` | 카테고리별 PieChart |
| `admin/frontend/src/components/dashboard/ServiceSummary.tsx` | 서비스 상태 요약 |

### New Files — System Components

| File | Responsibility |
|------|---------------|
| `admin/frontend/src/components/system/ServiceCard.tsx` | 서비스 인스턴스 카드 |
| `admin/frontend/src/components/system/HealthDetail.tsx` | 헬스 체크 상세 |

### Modified Files — Infrastructure

| File | Changes |
|------|---------|
| `docker/nginx/conf.d/admin.conf` | admin.kgd.com 서버 블록 추가 |
| 각 서비스 `application.yml` | Actuator 엔드포인트 확장 (health details) |

---

## Task 1: 프로젝트 스캐폴딩

**Files:**
- Create: `admin/frontend/package.json`, `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `tsconfig.json`, `tsconfig.app.json`, `index.html`, `components.json`
- Create: `admin/frontend/src/main.tsx`, `src/index.css`, `src/lib/utils.ts`, `src/App.tsx`

- [ ] **Step 1: 프로젝트 디렉토리 생성 및 Vite 초기화**

```bash
mkdir -p /Users/gideok-kwon/IdeaProjects/msa/admin/frontend
cd /Users/gideok-kwon/IdeaProjects/msa/admin/frontend
npm create vite@latest . -- --template react-ts
```

프롬프트에서 현재 디렉토리 사용 확인.

- [ ] **Step 2: 의존성 설치**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa/admin/frontend
npm install
npm install tailwindcss @tailwindcss/vite
npm install react-router-dom axios recharts @tanstack/react-query @tanstack/react-table
npm install class-variance-authority clsx tailwind-merge lucide-react
```

- [ ] **Step 3: Tailwind CSS 설정**

`admin/frontend/src/index.css`:
```css
@import "tailwindcss";
```

`admin/frontend/vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5175,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/eureka': {
        target: 'http://localhost:8761',
        changeOrigin: true,
      },
    },
  },
})
```

- [ ] **Step 4: shadcn/ui 초기화**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa/admin/frontend
npx shadcn@latest init
```

설정: TypeScript, default style, CSS variables, `@/` alias.

shadcn이 생성하는 `components.json`, `lib/utils.ts` 확인.

필요한 컴포넌트 추가:
```bash
npx shadcn@latest add button card badge separator dropdown-menu avatar sheet
```

- [ ] **Step 5: 엔트리 파일 설정**

`admin/frontend/src/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
```

`admin/frontend/src/App.tsx` (임시, 나중에 교체):
```tsx
export default function App() {
  return <div className="min-h-screen bg-background text-foreground p-8">
    <h1 className="text-2xl font-bold">Admin Backoffice</h1>
    <p className="text-muted-foreground">Setup complete</p>
  </div>
}
```

- [ ] **Step 6: 빌드 확인**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa/admin/frontend
npx tsc --noEmit && npm run build
```

Expected: dist/ 생성, 에러 없음

- [ ] **Step 7: Commit**

```bash
git add admin/frontend/
git commit -m "chore(admin): scaffold React + Vite + shadcn/ui + Tailwind project"
```

---

## Task 2: 타입 정의

**Files:**
- Create: `admin/frontend/src/types/auth.ts`
- Create: `admin/frontend/src/types/dashboard.ts`
- Create: `admin/frontend/src/types/system.ts`

- [ ] **Step 1: auth.ts**

```typescript
export interface JwtPayload {
  userId: string;
  roles: string[];
  type: string;
  exp: number;
  iat: number;
}

export interface AuthState {
  token: string | null;
  user: JwtPayload | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
}
```

- [ ] **Step 2: dashboard.ts**

```typescript
export interface StatCardData {
  label: string;
  value: number | string;
  change?: number; // 전일 대비 증감%
  trend?: 'up' | 'down' | 'neutral';
}

export interface DailyOrderStat {
  date: string;
  orderCount: number;
  revenue: number;
}

export interface CategoryRevenue {
  category: string;
  revenue: number;
}
```

- [ ] **Step 3: system.ts**

```typescript
export interface EurekaApp {
  name: string;
  instances: EurekaInstance[];
}

export interface EurekaInstance {
  instanceId: string;
  hostName: string;
  port: number;
  status: 'UP' | 'DOWN' | 'STARTING' | 'OUT_OF_SERVICE' | 'UNKNOWN';
  lastUpdatedTimestamp: number;
}

export interface HealthResponse {
  status: 'UP' | 'DOWN' | 'UNKNOWN';
  components?: Record<string, HealthComponent>;
}

export interface HealthComponent {
  status: 'UP' | 'DOWN' | 'UNKNOWN';
  details?: Record<string, any>;
}

export interface ServiceHealth {
  name: string;
  port: number;
  status: 'UP' | 'DOWN' | 'UNKNOWN';
  health?: HealthResponse;
  lastChecked: number;
}
```

- [ ] **Step 4: Commit**

```bash
git add admin/frontend/src/types/
git commit -m "feat(admin): add type definitions for auth, dashboard, system"
```

---

## Task 3: API 클라이언트 + 인증 훅

**Files:**
- Create: `admin/frontend/src/api/client.ts`
- Create: `admin/frontend/src/api/auth.ts`
- Create: `admin/frontend/src/hooks/useAuth.ts`

- [ ] **Step 1: axios 클라이언트**

`admin/frontend/src/api/client.ts`:
```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token');
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

- [ ] **Step 2: auth API**

`admin/frontend/src/api/auth.ts`:
```typescript
const AUTH_BASE = '/api/auth';

export function getGoogleOAuthUrl(): string {
  const redirectUri = encodeURIComponent(window.location.origin + '/admin/oauth/callback');
  return `${AUTH_BASE}/oauth2/google?redirect_uri=${redirectUri}`;
}

export function getKakaoOAuthUrl(): string {
  const redirectUri = encodeURIComponent(window.location.origin + '/admin/oauth/callback');
  return `${AUTH_BASE}/oauth2/kakao?redirect_uri=${redirectUri}`;
}
```

- [ ] **Step 3: useAuth 훅**

`admin/frontend/src/hooks/useAuth.ts`:
```typescript
import { useState, useCallback, useMemo } from 'react';
import type { AuthState, JwtPayload } from '../types/auth';

function decodeJwt(token: string): JwtPayload | null {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

function isTokenExpired(payload: JwtPayload): boolean {
  return payload.exp * 1000 < Date.now();
}

export function useAuth(): AuthState & {
  login: (token: string) => boolean;
  logout: () => void;
} {
  const [token, setToken] = useState<string | null>(() => {
    const stored = localStorage.getItem('admin_token');
    if (!stored) return null;
    const payload = decodeJwt(stored);
    if (!payload || isTokenExpired(payload)) {
      localStorage.removeItem('admin_token');
      return null;
    }
    return stored;
  });

  const user = useMemo(() => (token ? decodeJwt(token) : null), [token]);
  const isAdmin = useMemo(() => user?.roles?.includes('ROLE_ADMIN') ?? false, [user]);
  const isAuthenticated = useMemo(() => !!user && !isTokenExpired(user), [user]);

  const login = useCallback((newToken: string): boolean => {
    const payload = decodeJwt(newToken);
    if (!payload || isTokenExpired(payload)) return false;
    if (!payload.roles?.includes('ROLE_ADMIN')) return false;
    localStorage.setItem('admin_token', newToken);
    setToken(newToken);
    return true;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('admin_token');
    setToken(null);
  }, []);

  return { token, user, isAdmin, isAuthenticated, login, logout };
}
```

- [ ] **Step 4: 타입 체크**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa/admin/frontend
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add admin/frontend/src/api/ admin/frontend/src/hooks/useAuth.ts
git commit -m "feat(admin): add API client with JWT interceptor and useAuth hook"
```

---

## Task 4: 테마 훅 + 레이아웃 컴포넌트

**Files:**
- Create: `admin/frontend/src/hooks/useTheme.ts`
- Create: `admin/frontend/src/components/layout/ThemeToggle.tsx`
- Create: `admin/frontend/src/components/layout/Header.tsx`
- Create: `admin/frontend/src/components/layout/Sidebar.tsx`
- Create: `admin/frontend/src/components/layout/AppLayout.tsx`

- [ ] **Step 1: useTheme 훅**

`admin/frontend/src/hooks/useTheme.ts`:
```typescript
import { useState, useEffect, useCallback } from 'react';

type Theme = 'dark' | 'light';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('admin_theme') as Theme) || 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('admin_theme', theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggle };
}
```

- [ ] **Step 2: ThemeToggle**

`admin/frontend/src/components/layout/ThemeToggle.tsx`:
```tsx
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <Button variant="ghost" size="icon" onClick={toggle}>
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
```

- [ ] **Step 3: Header**

`admin/frontend/src/components/layout/Header.tsx`:
```tsx
import { Menu, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ThemeToggle from './ThemeToggle';

interface HeaderProps {
  onToggleSidebar: () => void;
  userName: string | null;
  onLogout: () => void;
}

export default function Header({ onToggleSidebar, userName, onLogout }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full items-center gap-4 px-4">
        <Button variant="ghost" size="icon" onClick={onToggleSidebar}>
          <Menu className="h-5 w-5" />
        </Button>
        <span className="font-semibold text-lg">Admin</span>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {userName && (
            <span className="text-sm text-muted-foreground">{userName}</span>
          )}
          <Button variant="ghost" size="icon" onClick={onLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Sidebar**

`admin/frontend/src/components/layout/Sidebar.tsx`:
```tsx
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Package, ClipboardList,
  BookOpen, User, Monitor,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  collapsed: boolean;
}

const menuItems = [
  { to: '/admin', icon: LayoutDashboard, label: '대시보드', enabled: true },
  { to: '/admin/members', icon: Users, label: '회원 관리', enabled: false },
  { to: '/admin/products', icon: Package, label: '상품 관리', enabled: false },
  { to: '/admin/orders', icon: ClipboardList, label: '주문 관리', enabled: false },
  { to: '/admin/code-dictionary', icon: BookOpen, label: '코드 사전', enabled: false },
  { to: '/admin/profile', icon: User, label: '프로필', enabled: false },
  { to: '/admin/system', icon: Monitor, label: '시스템', enabled: true },
];

export default function Sidebar({ collapsed }: SidebarProps) {
  return (
    <aside
      className={cn(
        'fixed left-0 top-14 bottom-0 z-40 border-r bg-background transition-all duration-200',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      <nav className="flex flex-col gap-1 p-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/admin'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                !item.enabled && 'opacity-40 pointer-events-none'
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 5: AppLayout**

`admin/frontend/src/components/layout/AppLayout.tsx`:
```tsx
import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Header from './Header';
import Sidebar from './Sidebar';
import { cn } from '@/lib/utils';

export default function AppLayout() {
  const { isAuthenticated, isAdmin, user, logout } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/admin/unauthorized" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
        userName={user?.userId ?? null}
        onLogout={logout}
      />
      <Sidebar collapsed={sidebarCollapsed} />
      <main
        className={cn(
          'pt-4 px-6 pb-8 transition-all duration-200',
          sidebarCollapsed ? 'ml-16' : 'ml-60'
        )}
      >
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 6: 타입 체크 + Commit**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa/admin/frontend && npx tsc --noEmit
git add admin/frontend/src/hooks/useTheme.ts admin/frontend/src/components/layout/
git commit -m "feat(admin): add layout components (Header, Sidebar, AppLayout, ThemeToggle)"
```

---

## Task 5: 페이지 + 라우팅

**Files:**
- Create: `admin/frontend/src/pages/LoginPage.tsx`
- Create: `admin/frontend/src/pages/UnauthorizedPage.tsx`
- Create: `admin/frontend/src/pages/DashboardPage.tsx` (placeholder)
- Create: `admin/frontend/src/pages/SystemPage.tsx` (placeholder)
- Modify: `admin/frontend/src/App.tsx`

- [ ] **Step 1: LoginPage**

```tsx
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getGoogleOAuthUrl, getKakaoOAuthUrl } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function LoginPage() {
  const { isAuthenticated, isAdmin, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      const success = login(token);
      if (success) {
        navigate('/admin', { replace: true });
      } else {
        navigate('/admin/unauthorized', { replace: true });
      }
    }
  }, [searchParams, login, navigate]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      navigate('/admin', { replace: true });
    }
  }, [isAuthenticated, isAdmin, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-[400px] p-8">
        <h1 className="text-2xl font-bold text-center mb-2">Admin Backoffice</h1>
        <p className="text-muted-foreground text-center mb-8">관리자 계정으로 로그인하세요</p>
        <div className="flex flex-col gap-3">
          <Button variant="outline" className="w-full" asChild>
            <a href={getGoogleOAuthUrl()}>Google로 로그인</a>
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <a href={getKakaoOAuthUrl()}>Kakao로 로그인</a>
          </Button>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: UnauthorizedPage**

```tsx
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export default function UnauthorizedPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      <h1 className="text-3xl font-bold">접근 권한 없음</h1>
      <p className="text-muted-foreground">ROLE_ADMIN 권한이 필요합니다.</p>
      <Button onClick={handleLogout}>다른 계정으로 로그인</Button>
    </div>
  );
}
```

- [ ] **Step 3: DashboardPage (placeholder)**

```tsx
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">대시보드</h1>
      <p className="text-muted-foreground">운영 지표가 여기에 표시됩니다.</p>
    </div>
  );
}
```

- [ ] **Step 4: SystemPage (placeholder)**

```tsx
export default function SystemPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">시스템</h1>
      <p className="text-muted-foreground">서비스 상태가 여기에 표시됩니다.</p>
    </div>
  );
}
```

- [ ] **Step 5: App.tsx 라우팅**

```tsx
import { Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import DashboardPage from './pages/DashboardPage';
import SystemPage from './pages/SystemPage';

export default function App() {
  return (
    <Routes>
      <Route path="/admin/login" element={<LoginPage />} />
      <Route path="/admin/unauthorized" element={<UnauthorizedPage />} />
      <Route path="/admin" element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="system" element={<SystemPage />} />
      </Route>
    </Routes>
  );
}
```

- [ ] **Step 6: 빌드 확인 + Commit**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa/admin/frontend && npx tsc --noEmit
git add admin/frontend/src/pages/ admin/frontend/src/App.tsx
git commit -m "feat(admin): add pages (Login, Unauthorized, Dashboard, System) and routing"
```

---

## Task 6: 대시보드 API + 컴포넌트

**Files:**
- Create: `admin/frontend/src/api/dashboard.ts`
- Create: `admin/frontend/src/components/dashboard/StatCard.tsx`
- Create: `admin/frontend/src/components/dashboard/OrderChart.tsx`
- Create: `admin/frontend/src/components/dashboard/CategoryPieChart.tsx`
- Create: `admin/frontend/src/components/dashboard/ServiceSummary.tsx`
- Modify: `admin/frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 1: dashboard API**

```typescript
import api from './client';
import type { DailyOrderStat, CategoryRevenue } from '@/types/dashboard';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
}

export async function fetchTodayOrders(): Promise<{ count: number; change: number }> {
  try {
    const res = await api.get<ApiResponse<{ totalCount: number }>>('/api/v1/orders/stats/today');
    return { count: res.data.data.totalCount, change: 0 };
  } catch {
    return { count: 0, change: 0 };
  }
}

export async function fetchTodayRevenue(): Promise<{ amount: number; change: number }> {
  try {
    const res = await api.get<ApiResponse<{ totalRevenue: number }>>('/api/v1/orders/stats/revenue/today');
    return { amount: res.data.data.totalRevenue, change: 0 };
  } catch {
    return { amount: 0, change: 0 };
  }
}

export async function fetchMemberCount(): Promise<{ total: number; today: number }> {
  try {
    const res = await api.get<ApiResponse<{ total: number; today: number }>>('/api/members/stats/count');
    return res.data.data;
  } catch {
    return { total: 0, today: 0 };
  }
}

export async function fetchDailyOrderStats(days = 7): Promise<DailyOrderStat[]> {
  try {
    const res = await api.get<ApiResponse<DailyOrderStat[]>>(`/api/v1/orders/stats/daily?days=${days}`);
    return res.data.data;
  } catch {
    return [];
  }
}

export async function fetchCategoryRevenue(): Promise<CategoryRevenue[]> {
  try {
    const res = await api.get<ApiResponse<CategoryRevenue[]>>('/api/v1/orders/stats/by-category');
    return res.data.data;
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: StatCard**

```tsx
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { StatCardData } from '@/types/dashboard';
import { cn } from '@/lib/utils';

interface StatCardProps extends StatCardData {
  icon: React.ReactNode;
}

export default function StatCard({ label, value, change, trend, icon }: StatCardProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <div className="text-3xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</div>
      {change !== undefined && (
        <div className={cn(
          'flex items-center gap-1 mt-1 text-sm',
          trend === 'up' && 'text-green-500',
          trend === 'down' && 'text-red-500',
          trend === 'neutral' && 'text-muted-foreground'
        )}>
          {trend === 'up' && <TrendingUp className="h-3 w-3" />}
          {trend === 'down' && <TrendingDown className="h-3 w-3" />}
          {trend === 'neutral' && <Minus className="h-3 w-3" />}
          {change > 0 ? '+' : ''}{change}% 전일 대비
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 3: OrderChart**

```tsx
import { Card } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { DailyOrderStat } from '@/types/dashboard';

interface OrderChartProps {
  data: DailyOrderStat[];
}

export default function OrderChart({ data }: OrderChartProps) {
  return (
    <Card className="p-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">주문/매출 추이 (7일)</h3>
      {data.length === 0 ? (
        <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">데이터 없음</div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="orderGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
            <Area type="monotone" dataKey="orderCount" stroke="hsl(var(--chart-1))" fill="url(#orderGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
```

- [ ] **Step 4: CategoryPieChart**

```tsx
import { Card } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { CategoryRevenue } from '@/types/dashboard';

const COLORS = ['#6c63ff', '#4ecdc4', '#ff6b6b', '#ffd93d', '#a29bfe', '#fd79a8', '#00b894', '#e17055'];

interface CategoryPieChartProps {
  data: CategoryRevenue[];
}

export default function CategoryPieChart({ data }: CategoryPieChartProps) {
  return (
    <Card className="p-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">카테고리별 매출</h3>
      {data.length === 0 ? (
        <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">데이터 없음</div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="revenue" nameKey="category" label={({ category }) => category}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
```

- [ ] **Step 5: ServiceSummary**

```tsx
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import type { ServiceHealth } from '@/types/system';

interface ServiceSummaryProps {
  services: ServiceHealth[];
}

export default function ServiceSummary({ services }: ServiceSummaryProps) {
  const upCount = services.filter((s) => s.status === 'UP').length;
  const downCount = services.filter((s) => s.status === 'DOWN').length;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">서비스 상태</h3>
        <Link to="/admin/system" className="text-xs text-primary hover:underline">상세 보기</Link>
      </div>
      <div className="flex gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-500">{upCount}</div>
          <div className="text-xs text-muted-foreground">UP</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-500">{downCount}</div>
          <div className="text-xs text-muted-foreground">DOWN</div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {services.slice(0, 6).map((svc) => (
          <div key={svc.name} className="flex items-center justify-between text-sm">
            <span>{svc.name}</span>
            <Badge variant={svc.status === 'UP' ? 'default' : 'destructive'} className="text-xs">
              {svc.status}
            </Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}
```

- [ ] **Step 6: DashboardPage 완성**

```tsx
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart, DollarSign, UserPlus, Users } from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import OrderChart from '@/components/dashboard/OrderChart';
import CategoryPieChart from '@/components/dashboard/CategoryPieChart';
import ServiceSummary from '@/components/dashboard/ServiceSummary';
import { fetchTodayOrders, fetchTodayRevenue, fetchMemberCount, fetchDailyOrderStats, fetchCategoryRevenue } from '@/api/dashboard';
import { fetchServiceHealthList } from '@/api/system';

export default function DashboardPage() {
  const orders = useQuery({ queryKey: ['dashboard', 'orders'], queryFn: fetchTodayOrders, refetchInterval: 300000 });
  const revenue = useQuery({ queryKey: ['dashboard', 'revenue'], queryFn: fetchTodayRevenue, refetchInterval: 300000 });
  const members = useQuery({ queryKey: ['dashboard', 'members'], queryFn: fetchMemberCount, refetchInterval: 300000 });
  const dailyStats = useQuery({ queryKey: ['dashboard', 'daily'], queryFn: () => fetchDailyOrderStats(7), refetchInterval: 300000 });
  const categoryStats = useQuery({ queryKey: ['dashboard', 'category'], queryFn: fetchCategoryRevenue, refetchInterval: 300000 });
  const services = useQuery({ queryKey: ['system', 'health'], queryFn: fetchServiceHealthList, refetchInterval: 30000 });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">대시보드</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="오늘 주문" value={orders.data?.count ?? 0} change={orders.data?.change ?? 0} trend="neutral" icon={<ShoppingCart className="h-4 w-4" />} />
        <StatCard label="오늘 매출" value={`₩${(revenue.data?.amount ?? 0).toLocaleString()}`} change={revenue.data?.change ?? 0} trend="neutral" icon={<DollarSign className="h-4 w-4" />} />
        <StatCard label="신규 가입" value={members.data?.today ?? 0} trend="neutral" icon={<UserPlus className="h-4 w-4" />} />
        <StatCard label="총 회원" value={members.data?.total ?? 0} icon={<Users className="h-4 w-4" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <OrderChart data={dailyStats.data ?? []} />
        </div>
        <CategoryPieChart data={categoryStats.data ?? []} />
      </div>

      <ServiceSummary services={services.data ?? []} />
    </div>
  );
}
```

- [ ] **Step 7: 타입 체크 + Commit**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa/admin/frontend && npx tsc --noEmit
git add admin/frontend/src/api/dashboard.ts admin/frontend/src/components/dashboard/ admin/frontend/src/pages/DashboardPage.tsx
git commit -m "feat(admin): add dashboard page with stat cards, charts, service summary"
```

---

## Task 7: 시스템 모니터링 API + 컴포넌트

**Files:**
- Create: `admin/frontend/src/api/system.ts`
- Create: `admin/frontend/src/components/system/ServiceCard.tsx`
- Create: `admin/frontend/src/components/system/HealthDetail.tsx`
- Modify: `admin/frontend/src/pages/SystemPage.tsx`

- [ ] **Step 1: system API**

```typescript
import api from './client';
import type { EurekaApp, ServiceHealth, HealthResponse } from '@/types/system';

const SERVICES = [
  { name: 'product-service', port: 8081 },
  { name: 'order-service', port: 8082 },
  { name: 'search-service', port: 8083 },
  { name: 'auth-service', port: 8087 },
  { name: 'gateway-service', port: 8080 },
  { name: 'code-dictionary-service', port: 8089 },
  { name: 'member-service', port: 8093 },
  { name: 'gifticon-service', port: 8086 },
  { name: 'wishlist-service', port: 8095 },
];

export async function fetchEurekaApps(): Promise<EurekaApp[]> {
  try {
    const res = await api.get('/eureka/apps', {
      headers: { Accept: 'application/json' },
    });
    const apps = res.data?.applications?.application ?? [];
    return apps.map((app: any) => ({
      name: app.name,
      instances: (app.instance ?? []).map((inst: any) => ({
        instanceId: inst.instanceId,
        hostName: inst.hostName,
        port: inst.port?.['$'] ?? 0,
        status: inst.status,
        lastUpdatedTimestamp: inst.lastUpdatedTimestamp,
      })),
    }));
  } catch {
    return [];
  }
}

async function fetchHealth(port: number): Promise<HealthResponse> {
  try {
    const res = await api.get<HealthResponse>(`/api/actuator/health/${port}`, { timeout: 5000 });
    return res.data;
  } catch {
    // If the admin can't reach actuator via gateway, try Eureka status as fallback
    return { status: 'UNKNOWN' };
  }
}

export async function fetchServiceHealthList(): Promise<ServiceHealth[]> {
  const eurekaApps = await fetchEurekaApps();
  const eurekaMap = new Map<string, string>();
  eurekaApps.forEach((app) => {
    const status = app.instances.some((i) => i.status === 'UP') ? 'UP' : 'DOWN';
    eurekaMap.set(app.name.toLowerCase(), status);
  });

  return SERVICES.map((svc) => {
    const eurekaStatus = eurekaMap.get(svc.name.replace('-service', '')) ?? eurekaMap.get(svc.name) ?? 'UNKNOWN';
    return {
      name: svc.name,
      port: svc.port,
      status: eurekaStatus as 'UP' | 'DOWN' | 'UNKNOWN',
      lastChecked: Date.now(),
    };
  });
}
```

- [ ] **Step 2: ServiceCard**

```tsx
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { ServiceHealth } from '@/types/system';
import HealthDetail from './HealthDetail';
import { cn } from '@/lib/utils';

interface ServiceCardProps {
  service: ServiceHealth;
}

export default function ServiceCard({ service }: ServiceCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="p-4">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-2 h-2 rounded-full',
            service.status === 'UP' && 'bg-green-500',
            service.status === 'DOWN' && 'bg-red-500',
            service.status === 'UNKNOWN' && 'bg-yellow-500'
          )} />
          <span className="font-medium">{service.name}</span>
          <Badge variant="outline" className="text-xs">:{service.port}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={service.status === 'UP' ? 'default' : 'destructive'}>
            {service.status}
          </Badge>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>
      {expanded && service.health && (
        <div className="mt-4 border-t pt-4">
          <HealthDetail health={service.health} />
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 3: HealthDetail**

```tsx
import { Badge } from '@/components/ui/badge';
import type { HealthResponse } from '@/types/system';

interface HealthDetailProps {
  health: HealthResponse;
}

export default function HealthDetail({ health }: HealthDetailProps) {
  if (!health.components) {
    return <p className="text-sm text-muted-foreground">상세 정보 없음</p>;
  }

  return (
    <div className="space-y-2">
      {Object.entries(health.components).map(([name, component]) => (
        <div key={name} className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{name}</span>
          <Badge variant={component.status === 'UP' ? 'outline' : 'destructive'} className="text-xs">
            {component.status}
          </Badge>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: SystemPage 완성**

```tsx
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ServiceCard from '@/components/system/ServiceCard';
import { fetchServiceHealthList } from '@/api/system';

export default function SystemPage() {
  const { data: services, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['system', 'health'],
    queryFn: fetchServiceHealthList,
    refetchInterval: 30000,
  });

  const upCount = services?.filter((s) => s.status === 'UP').length ?? 0;
  const totalCount = services?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">시스템</h1>
          <p className="text-sm text-muted-foreground">
            마지막 조회: {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '-'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline">{upCount}/{totalCount} UP</Badge>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" /> 새로고침
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(services ?? []).map((svc) => (
          <ServiceCard key={svc.name} service={svc} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 타입 체크 + Commit**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa/admin/frontend && npx tsc --noEmit
git add admin/frontend/src/api/system.ts admin/frontend/src/components/system/ admin/frontend/src/pages/SystemPage.tsx
git commit -m "feat(admin): add system monitoring page with Eureka status and health checks"
```

---

## Task 8: Nginx 설정 + Actuator 확장

**Files:**
- Create: `docker/nginx/conf.d/admin.conf`
- Modify: 각 서비스 `application.yml` (Actuator 확장)

- [ ] **Step 1: Nginx admin.conf**

`docker/nginx/conf.d/admin.conf`:
```nginx
server {
    listen 80;
    server_name admin.kgd.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name admin.kgd.com;

    ssl_certificate /etc/nginx/ssl/kgd.com.pem;
    ssl_certificate_key /etc/nginx/ssl/kgd.com-key.pem;

    # Admin SPA
    root /srv/admin/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        set $backend gateway:8080;
        proxy_pass http://$backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Eureka proxy
    location /eureka/ {
        set $backend discovery:8080;
        proxy_pass http://$backend;
        proxy_set_header Accept application/json;
    }
}
```

- [ ] **Step 2: Actuator 확장 (주요 서비스)**

각 서비스의 `application.yml`에 추가 (product, order, member, auth, code-dictionary, gateway):

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics
  endpoint:
    health:
      show-details: always
```

이미 `health,info`가 있는 경우 `metrics`만 추가하고 `show-details: always` 추가.

- [ ] **Step 3: Commit**

```bash
git add docker/nginx/conf.d/admin.conf
git commit -m "feat(admin): add Nginx config for admin.kgd.com and expand Actuator endpoints"
```

---

## Task 9: 빌드 + 통합 확인

- [ ] **Step 1: 프론트엔드 빌드**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa/admin/frontend
npm run build
```

Expected: `dist/` 생성, 에러 없음

- [ ] **Step 2: Dev 서버 확인**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa/admin/frontend
npm run dev
```

브라우저에서 `http://localhost:5175/admin` 접속:
- 로그인 페이지 표시 확인
- (JWT가 있으면) 대시보드 레이아웃 확인
- 사이드바 토글 확인
- 시스템 페이지 이동 확인
- 다크/라이트 테마 전환 확인

- [ ] **Step 3: 최종 Commit**

```bash
git add -A
git commit -m "feat(admin): complete backoffice framework with dashboard and system monitoring"
```

---

## Task Summary

| # | Task | Area | Dependencies |
|---|------|------|-------------|
| 1 | 프로젝트 스캐폴딩 | FE | - |
| 2 | 타입 정의 | FE | 1 |
| 3 | API 클라이언트 + 인증 훅 | FE | 2 |
| 4 | 테마 + 레이아웃 컴포넌트 | FE | 1 |
| 5 | 페이지 + 라우팅 | FE | 3, 4 |
| 6 | 대시보드 API + 컴포넌트 | FE | 2, 5 |
| 7 | 시스템 모니터링 | FE | 2, 5 |
| 8 | Nginx + Actuator | Infra | - |
| 9 | 빌드 + 통합 확인 | Both | 1-8 |

**Parallel tracks:** Task 6과 7은 독립적으로 병렬 진행 가능. Task 8은 FE와 독립.
