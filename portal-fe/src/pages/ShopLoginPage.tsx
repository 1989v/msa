import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ShopHeader from '../components/ShopHeader';
import {
  LOGIN_NEXT_KEY,
  buildGoogleAuthUrl,
  buildKakaoAuthUrl,
  isLoggedIn,
} from '../auth/auth';
import './Shop.css';

/** OAuth redirect 왕복 동안 복귀 경로 보관 후 인가 페이지로 이동 */
function startOAuth(authUrl: string, next: string | null) {
  if (next) {
    sessionStorage.setItem(LOGIN_NEXT_KEY, next);
  } else {
    sessionStorage.removeItem(LOGIN_NEXT_KEY);
  }
  window.location.href = authUrl;
}

export default function ShopLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next');

  // 이미 로그인 상태면 복귀 경로로
  useEffect(() => {
    if (isLoggedIn()) {
      navigate(next ?? '/shop', { replace: true });
    }
  }, [navigate, next]);

  return (
    <div className="shop-page">
      <ShopHeader />
      <main className="shop-container shop-container-narrow">
        <section className="shop-login-card">
          <div>
            <h1 className="shop-login-title">로그인</h1>
            <p className="shop-login-desc">주문하려면 소셜 계정으로 로그인해주세요.</p>
          </div>
          <div className="shop-login-buttons">
            <button
              type="button"
              className="shop-login-btn"
              onClick={() => startOAuth(buildKakaoAuthUrl(), next)}
            >
              카카오로 시작하기
            </button>
            <button
              type="button"
              className="shop-login-btn"
              onClick={() => startOAuth(buildGoogleAuthUrl(), next)}
            >
              구글로 시작하기
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
