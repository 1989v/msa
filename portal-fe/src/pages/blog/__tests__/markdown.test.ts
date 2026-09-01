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

  it('토큰 색을 쓴다', () => {
    expect(html).toContain('var(--ko-accent-primary)');
  });

  it('다이어그램이 없는 글은 그대로다', () => {
    expect(renderMarkdown('그냥 글.')).toBe('<p>그냥 글.</p>\n');
  });

  it('sanitize 는 그대로 작동한다', () => {
    expect(renderMarkdown('<script>alert(1)</script>')).not.toContain('<script>');
  });
});
