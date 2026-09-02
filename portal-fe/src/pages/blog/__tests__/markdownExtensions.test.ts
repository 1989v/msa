// 콜아웃과 체크박스는 **발행 경로를 지난 뒤**의 HTML 로 판정한다.
// 확장이 만들어 내는 것과 sanitizer 를 통과해 화면에 남는 것은 다른 사실이다.
import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../markdown';

describe('GFM 콜아웃', () => {
  it('종류를 클래스로 낸다', () => {
    const html = renderMarkdown('> [!NOTE]\n> 본문');
    expect(html).toContain('class="kh-alert kh-alert--note"');
  });

  it('제목을 안 적으면 종류 이름을 쓴다', () => {
    expect(renderMarkdown('> [!WARNING]\n> x')).toContain('>주의</p>');
  });

  it('적은 제목이 이긴다', () => {
    expect(renderMarkdown('> [!NOTE] 규칙\n> x')).toContain('>규칙</p>');
  });

  it('안쪽을 다시 마크다운으로 파싱한다 — 목록·강조가 살아야 한다', () => {
    const html = renderMarkdown('> [!TIP] t\n> **굵게**\n> - 항목');
    expect(html).toContain('<strong>굵게</strong>');
    expect(html).toContain('<li>항목</li>');
  });

  it('다섯 종류를 모두 받는다', () => {
    for (const t of ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION']) {
      expect(renderMarkdown(`> [!${t}]\n> x`)).toContain(`kh-alert--${t.toLowerCase()}`);
    }
  });

  it('모르는 종류는 평범한 인용문으로 떨어진다', () => {
    const html = renderMarkdown('> [!FOO]\n> x');
    expect(html).toContain('<blockquote>');
    expect(html).not.toContain('kh-alert');
  });

  it('평범한 인용문은 그대로다', () => {
    expect(renderMarkdown('> 인용')).toBe('<blockquote><p>인용</p>\n</blockquote>\n');
  });

  it('중첩 인용을 깨지 않는다', () => {
    const html = renderMarkdown('> 바깥\n>> 안쪽');
    expect((html.match(/<blockquote/g) ?? []).length).toBe(2);
  });
});

describe('체크박스', () => {
  // sanitizer 가 `input` 을 막아 기본 렌더러의 출력은 통째로 지워지고 항목
  // 앞에 빈칸만 남았다. 글자로 바꾸면 허용 목록을 안 넓히고도 보인다.
  const html = renderMarkdown('- [ ] 안 함\n- [x] 함');

  it('빈 칸과 채운 칸을 다른 글자로 낸다', () => {
    expect(html).toContain('☐');
    expect(html).toContain('☑');
  });

  it('input 요소를 남기지 않는다', () => {
    expect(html).not.toContain('<input');
  });

  it('항목 글자가 살아 있다', () => {
    expect(html).toContain('안 함');
    expect(html).toContain('함');
  });
});

describe('기본 문법이 그대로 동작한다', () => {
  const cases: Array<[string, string, string]> = [
    ['코드블럭', '```ts\nconst a = 1;\n```', '<code class="language-ts">'],
    ['표', '| a |\n|---|\n| 1 |', '<table>'],
    ['수평선', '---', '<hr>'],
    ['번호 목록', '1. 하나', '<ol>'],
    ['중첩 불릿', '- 하나\n  - 둘', '<ul>'],
    ['접기', '<details><summary>s</summary><p>b</p></details>', '<details>'],
  ];
  for (const [name, src, expected] of cases) {
    it(name, () => expect(renderMarkdown(src)).toContain(expected));
  }

  it('스크립트는 계속 막는다', () => {
    expect(renderMarkdown('<script>alert(1)</script>')).not.toContain('<script>');
  });
});
