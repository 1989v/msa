import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { getGoogleOAuthUrl, getKakaoOAuthUrl } from '@/api/auth';

export function LoginPage() {
  const { isAuthenticated, isAdmin, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      login(token);
    }
  }, [searchParams, login]);

  useEffect(() => {
    if (isAuthenticated) {
      if (isAdmin) {
        navigate('/admin', { replace: true });
      } else {
        navigate('/admin/unauthorized', { replace: true });
      }
    }
  }, [isAuthenticated, isAdmin, navigate]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Admin Backoffice</h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">소셜 계정으로 로그인하세요</p>
        </div>
        <div className="space-y-3">
          <a href={getGoogleOAuthUrl()} className="block">
            <Button variant="outline" className="w-full gap-2">
              <svg className="h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google로 로그인
            </Button>
          </a>
          <a href={getKakaoOAuthUrl()} className="block">
            <Button
              className="w-full gap-2 bg-yellow-400 text-zinc-900 hover:bg-yellow-500 dark:bg-yellow-400 dark:text-zinc-900 dark:hover:bg-yellow-500"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.72 1.63 5.12 4.1 6.54-.18.66-.64 2.39-.73 2.76-.11.46.17.45.36.33.14-.09 2.29-1.55 3.22-2.18.32.05.65.07.98.07 5.52 0 10-3.34 10-7.32C20 6.34 17.52 3 12 3z" fill="currentColor"/>
              </svg>
              Kakao로 로그인
            </Button>
          </a>
        </div>
      </Card>
    </div>
  );
}
