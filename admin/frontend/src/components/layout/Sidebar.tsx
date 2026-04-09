import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Package,
  ClipboardList,
  BookOpen,
  User,
  Monitor,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
  enabled: boolean;
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
        {navItems.map((item) => {
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
        })}
      </nav>
    </aside>
  );
}
