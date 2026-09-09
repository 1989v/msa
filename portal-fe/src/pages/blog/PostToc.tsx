import type { TocEntry } from './toc';

/**
 * 글 앞의 접힌 목차.
 *
 * `<details>` 를 쓰는 이유는 접기가 브라우저 기능이어서다 — 키보드·스크린리더·JS 없는 상태가
 * 전부 그냥 동작하고, 여는 상태를 React 가 들고 있지 않아 본문이 다시 그려져도 열린 채로 남는다.
 * 펼침/접힘 글자는 `details[open]` 선택자가 갈라 끼운다 (`Blog.css`).
 *
 * 항목이 하나뿐이면 그리지 않는다. 목차는 "어디로 갈지 고르는" 물건이라 고를 것이 없으면
 * 줄만 하나 늘어난다.
 */
export default function PostToc({ items }: { items: TocEntry[] }) {
  if (items.length < 2) return null;

  return (
    <details className="blog-toc">
      <summary className="blog-toc__toggle kh-mono">
        <span className="blog-toc__label blog-toc__label--closed">목차 펼쳐보기</span>
        <span className="blog-toc__label blog-toc__label--open">목차 접기</span>
        <span className="blog-toc__count">{items.length}</span>
      </summary>
      <nav aria-label="목차">
        <ol className="blog-toc__list">
          {items.map((item) => (
            <li key={item.id} className={`blog-toc__item blog-toc__item--h${item.level}`}>
              <a href={`#${encodeURIComponent(item.id)}`}>{item.text}</a>
            </li>
          ))}
        </ol>
      </nav>
    </details>
  );
}
