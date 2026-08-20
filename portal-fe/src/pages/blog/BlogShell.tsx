import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import ThemeToggle from '../../components/ThemeToggle';
import { useAuth } from '../../auth/useAuth';

/**
 * blog 호스트 공통 머리.
 *
 * 브랜드 링크는 apex 로 나간다 — 서브도메인 서비스에서 본진으로 돌아가는 길이 없으면
 * 방문자가 여기서 끝난다 (ADR-0066 런처와 같은 판단).
 */
export default function BlogShell({
  title,
  subtitle,
  children,
  nav,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  nav?: ReactNode;
}) {
  const { isLoggedIn } = useAuth();

  return (
    <div className="blog-page">
      <header className="blog-header">
        <div className="blog-header__bar">
          <a className="blog-header__brand kh-display" href="https://1989v.com">
            1989v
          </a>
          <div className="blog-header__actions">
            <Link className="blog-chip" to="/">
              블로그 홈
            </Link>
            <Link className="blog-chip" to="/studio">
              {isLoggedIn ? '내 스튜디오' : '글 쓰기'}
            </Link>
            <ThemeToggle />
          </div>
        </div>
        {title && <h1 className="blog-header__title kh-display">{title}</h1>}
        {subtitle && <p className="blog-header__subtitle">{subtitle}</p>}
        {nav}
      </header>
      {children}
    </div>
  );
}
