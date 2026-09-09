import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PostToc from '../PostToc';
import type { TocEntry } from '../toc';

const entries = (n: number): TocEntry[] =>
  Array.from({ length: n }, (_, i) => ({ id: `절-${i + 1}`, text: `절 ${i + 1}`, level: 2 }));

describe('접힌 목차', () => {
  it('기본은 접힌 상태다 — 한 줄만 보인다', () => {
    const { container } = render(<PostToc items={entries(3)} />);
    expect(container.querySelector('details')?.open).toBe(false);
    expect(screen.getByText('목차 펼쳐보기')).toBeTruthy();
  });

  it('항목마다 그 절로 가는 링크가 있다', () => {
    render(<PostToc items={entries(2)} />);
    expect(screen.getByRole('link', { name: '절 1' }).getAttribute('href')).toBe(
      `#${encodeURIComponent('절-1')}`,
    );
  });

  it('h3 은 한 단 들여쓴 항목으로 구분된다', () => {
    const { container } = render(
      <PostToc
        items={[
          { id: 'a', text: '가', level: 2 },
          { id: 'b', text: '나', level: 3 },
        ]}
      />,
    );
    expect(container.querySelectorAll('.blog-toc__item--h3')).toHaveLength(1);
  });

  it('고를 것이 하나뿐이면 그리지 않는다', () => {
    const { container } = render(<PostToc items={entries(1)} />);
    expect(container.querySelector('.blog-toc')).toBeNull();
  });

  it('제목이 없는 글에서는 아무것도 그리지 않는다', () => {
    const { container } = render(<PostToc items={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
