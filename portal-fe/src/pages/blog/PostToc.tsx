import type { TocEntry } from './toc';

/**
 * 글 앞의 접힌 목차.
 *
 * `<details>` 를 쓰는 이유는 접기가 브라우저 기능이어서다 — 키보드·스크린리더·JS 없는 상태가
 * 전부 그냥 동작하고, 여는 상태를 React 가 들고 있지 않아 본문이 다시 그려져도 열린 채로 남는다.
 * 펼침/접힘 글자는 `details[open]` 선택자가 갈라 끼운다 (`Blog.css`).
 *
 * 계층은 들여쓰기 하나로 말하지 않는다. h2 는 순번(`01_`)을 제목 앞에 달고 h3 은 그 아래로
 * 물려 들어가 짧은 괘선을 앞에 세운다 — k-heritage 의 `.kh-section-head`·`.kh-index` 와
 * 같은 어법이다 (`docs/design/k-heritage.html`). 순번은 CSS 카운터가 매기므로 목차 데이터는
 * 번호를 들고 있지 않다.
 *
 * 항목이 하나뿐이면 그리지 않는다. 목차는 "어디로 갈지 고르는" 물건이라 고를 것이 없으면
 * 줄만 하나 늘어난다.
 */
export default function PostToc({ items }: { items: TocEntry[] }) {
  if (items.length < 2) return null;

  return (
    <details className="blog-toc">
      <summary className="blog-toc__toggle">
        {/* 한글에는 모노·자간을 걸지 않는다 (DESIGN.md §12) — 숫자만 모노다 */}
        <span className="blog-toc__label">목차</span>
        <span className="blog-toc__count">{String(items.length).padStart(2, '0')}</span>
        <span className="blog-toc__state">
          <span className="blog-toc__state--closed">펼쳐보기</span>
          <span className="blog-toc__state--open">접기</span>
        </span>
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
