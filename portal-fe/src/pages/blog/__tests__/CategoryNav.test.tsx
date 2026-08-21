import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import CategoryNav from '../CategoryNav';
import type { BlogCategoryNode } from '../../../api/blogApi';

const node = (
  id: number,
  path: string,
  name: string,
  children: BlogCategoryNode[] = [],
): BlogCategoryNode => ({
  id,
  slug: path.split('/').pop() ?? '',
  name,
  description: null,
  path,
  depth: path.split('/').length - 1,
  orderNo: id,
  postCount: id,
  children,
});

const categories = [
  node(1, '/tech', '기술', [
    node(3, '/tech/server', '서버', [node(5, '/tech/server/search', '검색')]),
    node(4, '/tech/data', '데이터'),
  ]),
  node(2, '/life', '일상', [node(6, '/life/hobby', '취미')]),
];

describe('CategoryNav', () => {
  it('공간 밖(activePath 없음)에서는 아무것도 그리지 않는다 — 공간 전환은 머리 몫', () => {
    const { container } = render(
      <MemoryRouter>
        <CategoryNav categories={categories} />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('공간 안에서는 그 공간의 서브트리만 편다 — 다른 공간(depth-1)은 없다', () => {
    render(
      <MemoryRouter>
        <CategoryNav categories={categories} activePath="/tech/server" />
      </MemoryRouter>,
    );

    // 전체 칩은 공간 홈으로 간다
    expect(screen.getByRole('link', { name: /전체/ })).toHaveAttribute('href', '/c/tech');
    // depth-2 칩 + 활성 상태
    expect(screen.getByRole('link', { name: /서버/ })).toHaveClass('is-active');
    expect(screen.getByRole('link', { name: /데이터/ })).toBeInTheDocument();
    // 활성 depth-2 의 하위(depth-3)가 열린다
    expect(screen.getByRole('link', { name: /검색/ })).toHaveAttribute('href', '/c/tech/server/search');
    // 다른 공간은 여기 없다
    expect(screen.queryByRole('link', { name: /일상/ })).not.toBeInTheDocument();
  });
});
