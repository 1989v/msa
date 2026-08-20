import { Link } from 'react-router-dom';
import type { BlogCategoryNode } from '../../api/blogApi';

/**
 * 계층 카테고리 네비 (기술 > 서버 > 검색).
 *
 * 1단은 한 줄, 선택된 1단의 하위만 아래 줄에 편다. 3단을 한 번에 다 펼치면 글보다 네비가
 * 길어진다 — 상위를 고르면 하위 글까지 함께 나오므로(서브트리 조회) 안 펼쳐도 막다른 길이 없다.
 */
export default function CategoryNav({
  categories,
  activePath,
}: {
  categories: BlogCategoryNode[];
  activePath?: string;
}) {
  const activeRoot = activePath
    ? categories.find((c) => activePath === c.path || activePath.startsWith(`${c.path}/`))
    : undefined;
  const activeChild = activeRoot?.children.find(
    (c) => activePath === c.path || activePath?.startsWith(`${c.path}/`),
  );

  const chip = (node: BlogCategoryNode) => (
    <Link
      key={node.id}
      className={`blog-chip${activePath === node.path ? ' is-active' : ''}`}
      to={`/c${node.path}`}
    >
      {node.name}
      <span className="blog-chip__count">{node.postCount}</span>
    </Link>
  );

  return (
    <nav className="blog-nav" aria-label="카테고리">
      <div className="blog-nav__row">
        <Link className={`blog-chip${activePath ? '' : ' is-active'}`} to="/">
          전체
        </Link>
        {categories.map(chip)}
      </div>
      {activeRoot && activeRoot.children.length > 0 && (
        <div className="blog-nav__row blog-nav__row--child">{activeRoot.children.map(chip)}</div>
      )}
      {activeChild && activeChild.children.length > 0 && (
        <div className="blog-nav__row blog-nav__row--child">{activeChild.children.map(chip)}</div>
      )}
    </nav>
  );
}
