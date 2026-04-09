import { ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';

export function UnauthorizedPage() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm p-8 text-center space-y-4">
        <ShieldX className="h-12 w-12 mx-auto text-red-500" />
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">접근 권한 없음</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">ROLE_ADMIN 권한이 필요합니다</p>
        <Button variant="destructive" onClick={logout} className="w-full">
          로그아웃
        </Button>
      </Card>
    </div>
  );
}
