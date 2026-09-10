// 목차는 **발행 경로를 지난 뒤**의 HTML 로 판정한다. 마크다운을 따로 파싱해 만든 사본을
// 보면 검사가 자기 자신을 재게 되고, 정작 화면에 그려지는 id 와 어긋나도 초록불이 난다.
import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../markdown';
import { decorateHeadings } from '../toc';

/** 실제 경로 그대로: 마크다운 → sanitize 된 HTML → 목차·앵커 */
function build(markdown: string) {
  const { html, toc } = decorateHeadings(renderMarkdown(markdown));
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return { html, toc, doc };
}

describe('목차 뽑기', () => {
  it('h2·h3 만 담고 h4 는 담지 않는다', () => {
    const { toc } = build('## 하나\n\n### 하나-하나\n\n#### 너무 깊음\n\n## 둘');
    expect(toc.map((t) => [t.level, t.text])).toEqual([
      [2, '하나'],
      [3, '하나-하나'],
      [2, '둘'],
    ]);
  });

  // 이 검사가 이 기능의 전부다 — 목차가 가리키는 id 가 본문에 실제로 없으면
  // 눌러도 아무 일이 안 일어나는데 화면에는 목차가 멀쩡히 보인다.
  it('목차의 id 로 본문 제목을 찾을 수 있다', () => {
    const { toc, doc } = build('## 첫 절\n\n본문\n\n### 안쪽 절\n\n## 끝 절');
    expect(toc).toHaveLength(3);
    for (const entry of toc) {
      const heading = doc.getElementById(entry.id);
      expect(heading, entry.id).not.toBeNull();
      expect(heading?.tagName).toBe(`H${entry.level}`);
    }
  });

  it('한글 제목은 로마자로 옮기지 않고 글자를 그대로 쓴다', () => {
    const { toc } = build('## 재고는 왜 SSOT 인가');
    expect(toc[0]?.id).toBe('재고는-왜-ssot-인가');
  });

  it('같은 제목이 두 번 나오면 뒤엣것에 번호가 붙는다', () => {
    const { toc, doc } = build('## 정리\n\n가\n\n## 정리\n\n나');
    expect(toc.map((t) => t.id)).toEqual(['정리', '정리-2']);
    expect(doc.querySelectorAll('#정리')).toHaveLength(1);
  });

  it('글자가 남지 않는 제목은 순번으로 떨어진다', () => {
    const { toc } = build('## ***\n\n가\n\n## 다음');
    expect(toc[0]?.id).toBe('section-1');
  });

  it('목차 글자에 앵커 기호가 섞이지 않는다', () => {
    const { toc } = build('## 마무리\n\n가\n\n## 다음');
    expect(toc[0]?.text).toBe('마무리');
  });
});

describe('제목 앵커', () => {
  it('제목 안에 그 절을 가리키는 링크가 생긴다', () => {
    const { toc, doc } = build('## 왜 이렇게 했나\n\n본문\n\n## 다음');
    const anchor = doc.querySelector('h2 > a.blog-anchor');
    expect(anchor?.getAttribute('href')).toBe(`#${encodeURIComponent(toc[0]!.id)}`);
    expect(anchor?.getAttribute('aria-label')).toContain('왜 이렇게 했나');
  });

  it('h3 에도 붙는다', () => {
    const { doc } = build('## 가\n\n### 나');
    expect(doc.querySelectorAll('a.blog-anchor')).toHaveLength(2);
  });

  it('제목이 없는 글은 목차도 앵커도 만들지 않는다', () => {
    const { toc, html } = build('그냥 글.');
    expect(toc).toEqual([]);
    expect(html).not.toContain('blog-anchor');
  });
});

describe('sanitize 결과를 되돌리지 않는다', () => {
  it('스크립트는 계속 막힌다', () => {
    const { html } = build('## 제목\n\n<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
  });

  it('본문 표기가 그대로 살아 있다', () => {
    const { html } = build('## 제목\n\n- 항목\n\n```ts\nconst a = 1;\n```');
    expect(html).toContain('<li>항목</li>');
    expect(html).toContain('<code class="hljs language-typescript">');
  });

  it('다이어그램 SVG 가 살아남는다', () => {
    const md = '## 그림\n\n```mermaid\n%% caption: 주문은 결제 뒤에 재고를 잡는다\nflowchart LR\n  A[주문] --> B[결제]\n```';
    const { html } = build(md);
    expect(html).toContain('<svg');
    expect(html).toContain('그림: 주문은 결제 뒤에 재고를 잡는다');
  });
});
