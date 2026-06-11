import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { loginWithProvider, extractErrorMessage } from '../api/shopApi';
import { LOGIN_NEXT_KEY, getOAuthRedirectUri, type OAuthProvider } from '../auth/auth';
import { useAuth } from '../auth/useAuth';
import './Shop.css';

export default function ShopOAuthCallbackPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  // OAuth 인가 코드는 1회용 — StrictMode 의 effect 중복 실행 가드
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');

    const doLogin = async () => {
      if (!code || (state !== 'kakao' && state !== 'google')) {
        setError('로그인 정보가 올바르지 않습니다.');
        return;
      }
      try {
        const res = await loginWithProvider(state as OAuthProvider, code, getOAuthRedirectUri());
        login(res.accessToken, res.refreshToken, res.memberId);
        const next = sessionStorage.getItem(LOGIN_NEXT_KEY);
        sessionStorage.removeItem(LOGIN_NEXT_KEY);
        navigate(next ?? '/shop', { replace: true });
      } catch (e) {
        setError(extractErrorMessage(e, '로그인 처리 중 오류가 발생했습니다.'));
      }
    };

    doLogin();
  }, [searchParams, login, navigate]);

  return (
    <div className="shop-page">
      <main className="shop-container shop-container-narrow">
        {error ? (
          <div className="shop-status" role="alert">
            <p className="shop-status-error" style={{ marginBottom: 'var(--ko-space-4)' }}>
              {error}
            </p>
            <Link to="/shop/login" className="shop-btn-primary">
              다시 로그인하기
            </Link>
          </div>
        ) : (
          <div className="shop-status">로그인 처리 중...</div>
        )}
      </main>
    </div>
  );
}
