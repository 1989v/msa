import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import LoginShell from '../components/chrome/LoginShell';
import LoginProviderButtons from '../components/chrome/LoginProviderButtons';
import { portalTitle, portalUrl } from '../seo/copy.mjs';
import { useSeo } from '../seo/useSeo';
import { LOGIN_NEXT_KEY, isLoggedIn } from '../auth/auth';

/** OAuth redirect 왕복 동안 복귀 경로 보관 후 인가 페이지로 이동 */
function startOAuth(authUrl: string, next: string | null) {
  if (next) {
    sessionStorage.setItem(LOGIN_NEXT_KEY, next);
  } else {
    sessionStorage.removeItem(LOGIN_NEXT_KEY);
  }
  window.location.href = authUrl;
}

/**
 * apex 계열 공통 로그인 진입점 (`/shop/login?next=…`).
 *
 * 경로에 shop 이 남아 있지만 게임·테크·쇼핑 어디서 와도 이 화면 하나다 — 화면은
 * 계정이라는 하나의 일이라 서비스 브랜드 대신 중립 LoginShell 을 입는다.
 */
export default function ShopLoginPage() {
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
    <LoginShell>
      <div>
        <span className="kh-section-label">Account</span>
        <h1 className="login-shell-title">로그인</h1>
        <p className="login-shell-desc">
          소셜 계정으로 로그인하면 찜·주문·평점 등 회원 기능을 쓸 수 있습니다.
        </p>
      </div>
      <LoginProviderButtons onStart={(url) => startOAuth(url, next)} />
    </LoginShell>
  );
}
