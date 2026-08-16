import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ShopHeader from '../components/ShopHeader';
import { portalTitle, portalUrl } from '../seo/copy.mjs';
import { useSeo } from '../seo/useSeo';
import {
  LOGIN_NEXT_KEY,
  buildGoogleAuthUrl,
  buildKakaoAuthUrl,
  isLoggedIn,
} from '../auth/auth';
import './Shop.css';
import { useHeritageSurface } from '../hooks/useHeritageSurface';

/**
 * 제공사 심볼. 각 사가 로그인 버튼에 요구하는 형태라 우리 아이콘 세트로 대체하지 않는다 —
 * 사용자가 어느 계정으로 들어가는지 글자보다 마크로 먼저 알아본다.
 */
function KakaoMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
      <path d="M9 1C4.58 1 1 3.82 1 7.29c0 2.25 1.5 4.22 3.75 5.33-.17.6-.6 2.17-.69 2.5-.11.42.15.41.32.3.13-.09 2.11-1.43 2.97-2.02.54.08 1.09.12 1.65.12 4.42 0 8-2.82 8-6.23S13.42 1 9 1z" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

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
  useHeritageSurface();
  useSeo({ title: portalTitle('로그인'), canonical: portalUrl('/shop/login'), noindex: true });
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
            <span className="kh-section-label">Account</span>
            <h1 className="shop-login-title">로그인</h1>
            <p className="shop-login-desc">
              소셜 계정으로 로그인하면 주문·평점 등 회원 기능을 쓸 수 있습니다.
            </p>
          </div>
          <div className="shop-login-buttons">
            <button
              type="button"
              className="shop-login-btn shop-login-btn-kakao"
              onClick={() => startOAuth(buildKakaoAuthUrl(), next)}
            >
              <KakaoMark />
              카카오로 시작하기
            </button>
            <button
              type="button"
              className="shop-login-btn shop-login-btn-google"
              onClick={() => startOAuth(buildGoogleAuthUrl(), next)}
            >
              <GoogleMark />
              구글로 시작하기
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
