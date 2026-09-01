import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../markdown';

describe('renderMarkdown — 다이어그램', () => {
  // `class B emphasis` 없이는 accent 색이 안 쓰인다 — flowchart 는 노드 단위로
  // `class <id> emphasis` 를 명시해야만 강조 색(accent)이 나온다 (fencesvg
  // src/draw/flowchart.ts:110). 토큰 전달을 실제로 검증하려면 강조 노드가 필요하다.
  const md = '앞 문장.\n\n```mermaid\n%% caption: 주문은 결제 뒤에 재고를 잡는다\nflowchart LR\n  A[주문] --> B[결제]\n  class B emphasis\n```\n\n뒤 문장.';
  const html = renderMarkdown(md);

  it('펜스를 SVG 로 그린다', () => {
    expect(html).toContain('<svg');
    expect(html).not.toContain('language-mermaid');
  });

  it('캡션이 문단으로 남는다', () => {
    expect(html).toContain('그림: 주문은 결제 뒤에 재고를 잡는다');
  });

  // 옵션을 넘기지 않으므로 fencesvg 가 페이지에서 팔레트를 감지한다. jsdom 은
  // 링크도 테두리도 없는 빈 문서라 감지가 아무것도 못 찾고 기본값으로 떨어지는데,
  // 그 경우에도 색은 반드시 `var(--fs-*, …)` 참조로 나가야 한다 — 그래야 사이트가
  // CSS 로 덮어쓸 수 있고 테마 토글도 따라간다. 하드코딩된 색이 새면 여기서 잡힌다.
  it('색을 참조로 내보낸다 — 하드코딩된 hex 가 없다', () => {
    expect(html).toContain('var(--fs-');
    const svg = html.slice(html.indexOf('<svg'), html.indexOf('</svg>'));
    expect(svg).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('다이어그램이 없는 글은 그대로다', () => {
    expect(renderMarkdown('그냥 글.')).toBe('<p>그냥 글.</p>\n');
  });

  it('sanitize 는 그대로 작동한다', () => {
    expect(renderMarkdown('<script>alert(1)</script>')).not.toContain('<script>');
  });
});
