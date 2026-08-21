import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import KhSheet from '../../components/shell/KhSheet';
import type { BlogCategoryNode } from '../../api/blogApi';

/**
 * 현재 경로에서 활성 공간(depth-1) path 를 뽑는다.
 * `/c/{space}/**` 만 공간 문맥이고, 홈(`/`, apex 개발에서는 `/blog`)은 전체다.
 * 글 상세·스튜디오 등은 URL 에 공간이 없다 — null.
 */
export function activeSpacePath(pathname: string): string | null {
  const inSpace = pathname.match(/^\/c(\/[^/]+)/);
  if (inSpace) return inSpace[1];
  if (pathname === '/' || pathname === '/blog') return '/';
  return null;
}

/**
 * 공간 전환기 — depth-1 카테고리는 분류 칩이 아니라 별개의 발행 공간이다 (ADR-0072).
 *
 * 데스크톱은 탭 한 줄, 모바일은 바텀시트다. 칩 줄에 섞으면 "기술과 일상은 같은 블로그의
 * 폴더"로 읽히는데, 실제로는 게시판처럼 서로 다른 종류의 글이 사는 곳이다 — 전환기가
 * 머리에 있어야 공간이 페이지의 정체성이 된다.
 */
export default function SpaceSwitcher({ spaces }: { spaces: BlogCategoryNode[] }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const active = activeSpacePath(pathname);
  const current = spaces.find((space) => space.path === active);
  const triggerName = current?.name ?? (active === '/' ? '전체' : '공간');

  const tab = (to: string, label: string, isActive: boolean) => (
    <Link
      key={to}
      className={`blog-space-tab kh-press${isActive ? ' is-active' : ''}`}
      aria-current={isActive ? 'page' : undefined}
      to={to}
    >
      {label}
    </Link>
  );

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <>
      <nav className="blog-space-tabs" aria-label="공간">
        {tab('/', '전체', active === '/')}
        {spaces.map((space) => tab(`/c${space.path}`, space.name, active === space.path))}
      </nav>

      <button
        type="button"
        className="blog-space-trigger kh-press"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {/* kh-caps 금지 — 한글에 넓은 자간을 걸지 않는다 (DESIGN.md §12 주의) */}
        <span className="blog-space-trigger__label">공간</span>
        <span className="blog-space-trigger__name">{triggerName}</span>
        <span aria-hidden="true">▾</span>
      </button>

      {open && (
        <KhSheet label="공간" onClose={() => setOpen(false)}>
          <ul className="blog-space-sheet">
            <li>
              <button
                type="button"
                className="blog-space-sheet__link kh-press"
                aria-current={active === '/' ? 'page' : undefined}
                onClick={() => go('/')}
              >
                <span className="blog-space-sheet__name">전체</span>
                <span className="blog-space-sheet__desc">모든 공간의 최신 글</span>
              </button>
            </li>
            {spaces.map((space) => (
              <li key={space.id}>
                <button
                  type="button"
                  className="blog-space-sheet__link kh-press"
                  aria-current={active === space.path ? 'page' : undefined}
                  onClick={() => go(`/c${space.path}`)}
                >
                  <span className="blog-space-sheet__name">
                    {space.name}
                    <span className="blog-chip__count kh-mono">{space.postCount}</span>
                  </span>
                  {space.description && (
                    <span className="blog-space-sheet__desc">{space.description}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </KhSheet>
      )}
    </>
  );
}
