import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const { status } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  if (status === 'checking') {
    return <FullScreenNotice>세션 확인 중…</FullScreenNotice>;
  }

  if (status === 'error') {
    return <FullScreenNotice>세션을 확인하지 못했습니다. 잠시 뒤 새로고침해 주세요.</FullScreenNotice>;
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace />;
  }

  if (status === 'forbidden') {
    return <Navigate to="/unauthorized" replace />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <Header onToggleSidebar={() => setCollapsed((c) => !c)} />
      <Sidebar collapsed={collapsed} />
      <main
        className={cn(
          'transition-all duration-200 pt-0',
          collapsed ? 'ml-16' : 'ml-60'
        )}
      >
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function FullScreenNotice({ children }: { children: string }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center p-4 text-sm">
      {children}
    </div>
  );
}
