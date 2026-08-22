import { buildLoginHref } from '../auth/auth';
import { useAuth } from '../auth/useAuth';
import './AuthButton.css';

/**
 * 우측 상단 로그인/로그아웃.
 *
 * GNB(포털)와 게임 화면 양쪽에 같은 컴포넌트를 둔다 — 게임 페이지는 GNB 를 렌더하지
 * 않으므로 GNB 에만 두면 정작 로그인이 필요한 화면이 빠진다.
 *
 * 로그인은 apex 한 곳이라 서브도메인에서는 **호스트를 넘는 이동**이다. react-router 의
 * Link 로는 표현할 수 없어 `<a>` 를 쓴다 (ADR-0079).
 */
export default function AuthButton({ className = '' }: { className?: string }) {
  const { isLoggedIn, logout } = useAuth();

  if (isLoggedIn) {
    return (
      <button type="button" className={`auth-btn ${className}`} onClick={() => void logout()}>
        로그아웃
      </button>
    );
  }
  return (
    <a className={`auth-btn ${className}`} href={buildLoginHref()}>
      로그인
    </a>
  );
}
