import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { apexLoginHref, endSession, getSessionUserId } from '@/lib/session';

/**
 * 로그인은 apex `/login` 한 곳에서 한다(ADR-0079) — 어드민은 거기로 보내고 돌아오기만 한다.
 *
 * 보내기 전에 남은 세션을 지운다. apex 는 표시 쿠키(`portal_user_id`)만 보고 곧장 `next` 로
 * 되돌리므로, 토큰이 만료돼 표시 쿠키만 남은 상태로 보내면 어드민과 apex 사이를 끝없이 오간다.
 */
async function goToApexLogin(href: string) {
  if (getSessionUserId()) await endSession();
  window.location.href = href;
}

export function LoginPage() {
  const { status } = useAuth();
  const navigate = useNavigate();
  const loginHref = apexLoginHref();

  useEffect(() => {
    if (status === 'admin') navigate('/', { replace: true });
    else if (status === 'forbidden') navigate('/unauthorized', { replace: true });
  }, [status, navigate]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Admin Backoffice</h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {loginHref
              ? '1989v.com 계정으로 로그인하세요'
              : '로컬에서는 .env.local 의 VITE_DEV_ADMIN_TOKEN 으로 들어옵니다'}
          </p>
        </div>
        {loginHref && (
          <Button
            variant="outline"
            className="w-full"
            disabled={status === 'checking'}
            onClick={() => goToApexLogin(loginHref)}
          >
            로그인하러 가기
          </Button>
        )}
      </Card>
    </div>
  );
}
