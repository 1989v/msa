import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Footer from '../../components/Footer';
import ThemeToggle from '../../components/ThemeToggle';
import { useAuth } from '../../auth/useAuth';
import { fetchCategories } from '../../api/blogApi';
import SpaceSwitcher from './SpaceSwitcher';

/**
 * blog 호스트 공통 머리.
 *
 * 브랜드 링크는 apex 로 나간다 — 서브도메인 서비스에서 본진으로 돌아가는 길이 없으면
 * 방문자가 여기서 끝난다 (ADR-0066 런처와 같은 판단).
 *
 * 공간 전환기(depth-1)는 모든 화면의 머리에 있다 — 글 상세·스튜디오에서도 다른 공간으로
 * 건너가는 길은 머리 하나뿐이다. 카테고리 트리는 화면들이 같은 키로 캐시를 공유한다.
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
  const categories = useQuery({
    queryKey: ['blog', 'categories'],
    queryFn: fetchCategories,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="blog-page">
      <header className="blog-header">
        <div className="blog-header__bar">
          <a className="blog-header__brand kh-display" href="https://1989v.com">
            1989v
          </a>
          <div className="blog-header__actions">
            <Link className="blog-chip kh-press" to="/favorites">
              내 찜
            </Link>
            <Link className="blog-chip kh-press" to="/studio">
              {isLoggedIn ? '내 스튜디오' : '글 쓰기'}
            </Link>
            <ThemeToggle />
          </div>
        </div>
        <SpaceSwitcher spaces={categories.data ?? []} />
        {title && <h1 className="blog-header__title kh-display">{title}</h1>}
        {subtitle && <p className="blog-header__subtitle">{subtitle}</p>}
        {nav}
      </header>
      {children}
      {/* 셸이 모든 블로그 화면을 감싸므로 푸터도 여기 한 번 — 화면마다 빠뜨릴 일이 없다 */}
      <Footer>
        <p>
          <Link to="/studio">스튜디오</Link> 에서 글을 쓰고 발행 상태를 관리합니다.
        </p>
      </Footer>
    </div>
  );
}
