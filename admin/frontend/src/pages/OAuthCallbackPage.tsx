import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { loginWithOAuth } from '@/api/auth';

export function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const code = searchParams.get('code');
    const provider = searchParams.get('state'); // 'google' or 'kakao', set in auth.ts

    if (!code || !provider) {
      setError('인증 코드가 없습니다.');
      return;
    }

    // TODO: OAuth bypass — 실제 연동 시 아래 3줄 제거하고 loginWithOAuth 블록 활성화
    const dummyJwt = `header.${btoa(JSON.stringify({ userId: '1', roles: ['ROLE_ADMIN'], type: 'access', exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000) }))}.signature`;
    login(dummyJwt);
    navigate('/admin', { replace: true }); return;

    loginWithOAuth(provider, code)
      .then((result) => {
        login(result.accessToken);
        navigate('/admin', { replace: true });
      })
      .catch(() => {
        setError('로그인에 실패했습니다. 다시 시도해주세요.');
      });
  }, [searchParams, login, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-400">{error}</p>
          <a href="/admin/login" className="text-sm text-zinc-400 underline">
            로그인 페이지로 돌아가기
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
      <p className="text-zinc-400">로그인 처리 중...</p>
    </div>
  );
}
