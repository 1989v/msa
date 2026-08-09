import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import './AuthButton.css';

/**
 * 우측 상단 로그인/로그아웃.
 *
 * 지금까지 로그인 진입점이 `/shop/login` 하나뿐이라 게임 페이지에서 평점을 남기려 해도
 * 로그인할 방법이 없었다. GNB(포털)와 게임 화면 양쪽에 같은 컴포넌트를 둔다 — 게임 페이지는
 * GNB 를 렌더하지 않으므로 GNB 에만 두면 정작 문제가 된 화면이 빠진다.
 *
 * 로그인 페이지는 `?next=` 로 복귀 경로를 받는다(OAuth 왕복 동안 sessionStorage 보관).
 */
export default function AuthButton({ className = '' }: { className?: string }) {
  const { isLoggedIn, logout } = useAuth();
  const { pathname, search } = useLocation();

  if (isLoggedIn) {
    return (
      <button type="button" className={`auth-btn ${className}`} onClick={() => void logout()}>
        로그아웃
      </button>
    );
  }
  return (
    <Link
      className={`auth-btn ${className}`}
      to={`/shop/login?next=${encodeURIComponent(pathname + search)}`}
    >
      로그인
    </Link>
  );
}
