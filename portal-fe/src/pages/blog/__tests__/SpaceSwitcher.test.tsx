import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import SpaceSwitcher, { activeSpacePath } from '../SpaceSwitcher';
import type { BlogCategoryNode } from '../../../api/blogApi';

const space = (id: number, slug: string, name: string, description: string | null): BlogCategoryNode => ({
  id,
  slug,
  name,
  description,
  path: `/${slug}`,
  depth: 1,
  orderNo: id * 10,
  postCount: id * 3,
  children: [],
});

const spaces = [
  space(1, 'tech', '기술', '서버 · 검색 · 데이터'),
  space(2, 'life', '일상', '취미 · 기록'),
  space(3, 'harness', 'AI 하네스', '도메인별 베스트 CLAUDE.md · 에이전트 하네스 공유'),
];

describe('activeSpacePath', () => {
  it('공간 문맥은 /c/{space}/** 에서만 나온다', () => {
    expect(activeSpacePath('/c/tech')).toBe('/tech');
    expect(activeSpacePath('/c/tech/server/search')).toBe('/tech');
    expect(activeSpacePath('/')).toBe('/');
    expect(activeSpacePath('/blog')).toBe('/');
    expect(activeSpacePath('/posts/my-post')).toBeNull();
    expect(activeSpacePath('/studio')).toBeNull();
  });
});

describe('SpaceSwitcher', () => {
  it('하위 분류에 있어도 소속 공간 탭이 현재로 표시된다', () => {
    render(
      <MemoryRouter initialEntries={['/c/tech/server']}>
        <SpaceSwitcher spaces={spaces} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: '기술' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '전체' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'AI 하네스' })).toHaveAttribute('href', '/c/harness');
  });

  it('모바일 트리거가 공간 목록 시트를 연다 — 이름·소개·글 수까지', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <SpaceSwitcher spaces={spaces} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /공간/ }));

    const sheet = screen.getByRole('dialog', { name: '공간' });
    expect(sheet).toHaveTextContent('AI 하네스');
    expect(sheet).toHaveTextContent('도메인별 베스트 CLAUDE.md · 에이전트 하네스 공유');
    expect(sheet).toHaveTextContent('9'); // harness postCount

    await user.click(screen.getByRole('button', { name: /일상/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
