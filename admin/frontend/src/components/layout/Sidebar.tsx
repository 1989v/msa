import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Package,
  ClipboardList,
  BookOpen,
  User,
  Monitor,
  ExternalLink,
  TrendingUp,
  Gift,
  Eye,
  BookMarked,
  Coins,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
  enabled: boolean;
  /** true 면 외부 SPA 로 라우팅 (NavLink 대신 anchor 사용). admin SPA 외부 경로용. */
  external?: boolean;
}

const navItems: NavItem[] = [
  { label: '대시보드', icon: LayoutDashboard, to: '/admin', enabled: true },
  { label: '회원 관리', icon: Users, to: '/admin/members', enabled: true },
  { label: '상품 관리', icon: Package, to: '/admin/products', enabled: true },
  { label: '주문 관리', icon: ClipboardList, to: '/admin/orders', enabled: true },
  { label: '코드 사전', icon: BookOpen, to: '/admin/code-dictionary', enabled: true },
  { label: '프로필', icon: User, to: '/admin/profile', enabled: true },
  { label: '시스템', icon: Monitor, to: '/admin/system', enabled: true },
];

// 외부 SPA / 서비스 진입점 — ingress 가 path-prefix 로 라우팅 (frontend-ingress.yaml).
// 운영 도메인 분리 시 to 를 절대 URL 로 교체.
// 차팅은 ADR-0036 P2-T20 (2026-05-02) 에서 quant 로 흡수 완료 → /quant/charts 로 대체.
const externalServices: NavItem[] = [
  { label: '분할매매', icon: Coins, to: '/quant/', enabled: true, external: true },
  { label: '차트 분석', icon: TrendingUp, to: '/quant/charts', enabled: true, external: true },
  { label: '기프티콘', icon: Gift, to: '/gifticon/', enabled: true, external: true },
  { label: '에이전트 뷰어', icon: Eye, to: '/agent-viewer/', enabled: true, external: true },
  // 2026-05-05: code-dictionary FE 가 portal-fe 단일 SPA 의 메인 콘텐츠로 통합되어 root / 진입.
  { label: '코드 딕셔너리', icon: BookMarked, to: '/', enabled: true, external: true },
];

interface SidebarProps {
  collapsed: boolean;
}

export function Sidebar({ collapsed }: SidebarProps) {
  return (
    <aside
      className={cn(
        'fixed top-14 left-0 h-[calc(100vh-3.5rem)] flex flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 transition-all duration-200 z-40',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      <nav className="flex flex-col gap-1 p-2 flex-1 overflow-y-auto">
        {navItems.map((item) => renderNavItem(item, collapsed))}

        <div className={cn('mt-4 mb-1', collapsed ? 'mx-2' : 'mx-3')}>
          <div className="border-t border-zinc-200 dark:border-zinc-800" />
          {!collapsed && (
            <div className="mt-2 px-1 text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
              외부 서비스
            </div>
          )}
        </div>

        {externalServices.map((item) => renderNavItem(item, collapsed))}
      </nav>
    </aside>
  );
}

function renderNavItem(item: NavItem, collapsed: boolean) {
  const Icon = item.icon;
  if (!item.enabled) {
    return (
      <div
        key={item.to}
        className={cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm opacity-40 cursor-not-allowed',
          'text-zinc-700 dark:text-zinc-300',
          collapsed && 'justify-center px-0'
        )}
        title={collapsed ? item.label : undefined}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span>{item.label}</span>}
      </div>
    );
  }

  if (item.external) {
    return (
      <a
        key={item.to}
        href={item.to}
        className={cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
          'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
          collapsed && 'justify-center px-0'
        )}
        title={collapsed ? item.label : undefined}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1">{item.label}</span>
            <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
          </>
        )}
      </a>
    );
  }

  return (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.to === '/admin'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
          'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
          isActive && 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100',
          collapsed && 'justify-center px-0'
        )
      }
      title={collapsed ? item.label : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </NavLink>
  );
}
