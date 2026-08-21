import { Link } from 'react-router-dom';
import type { BlogCategoryNode } from '../../api/blogApi';

/**
 * 공간 안 분류 네비 (서버 > 검색).
 *
 * depth-1(공간) 전환은 머리의 SpaceSwitcher 몫이라 여기서는 보이지 않는다 — 공간 안에서는
 * 그 공간의 하위 분류만 편다. 3단을 한 번에 다 펼치면 글보다 네비가 길어진다 — 상위를
 * 고르면 하위 글까지 함께 나오므로(서브트리 조회) 안 펼쳐도 막다른 길이 없다.
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
  if (!activeRoot) return null;

  const activeChild = activeRoot.children.find(
    (c) => activePath === c.path || activePath?.startsWith(`${c.path}/`),
  );

  const chip = (node: BlogCategoryNode) => (
    <Link
      key={node.id}
      className={`blog-chip kh-press${activePath === node.path ? ' is-active' : ''}`}
      to={`/c${node.path}`}
    >
      {node.name}
      <span className="blog-chip__count">{node.postCount}</span>
    </Link>
  );

  return (
    <nav className="blog-nav" aria-label="분류">
      <div className="blog-nav__row">
        <Link
          className={`blog-chip kh-press${activePath === activeRoot.path ? ' is-active' : ''}`}
          to={`/c${activeRoot.path}`}
        >
          전체
          <span className="blog-chip__count">{activeRoot.postCount}</span>
        </Link>
        {activeRoot.children.map(chip)}
      </div>
      {activeChild && activeChild.children.length > 0 && (
        <div className="blog-nav__row blog-nav__row--child">{activeChild.children.map(chip)}</div>
      )}
    </nav>
  );
}
