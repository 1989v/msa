import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AttractionLinks from '../AttractionLinks';

const video = (id: string, format: 'LONG' | 'SHORT' | null) => ({
  source: 'YOUTUBE', externalId: id, title: `영상 ${id}`, url: `https://www.youtube.com/watch?v=${id}`,
  thumbnailUrl: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`, author: null, publishedAt: null, viewCount: null,
  duration: null, format,
});

/** 그룹 제목으로 그 그룹의 카드 링크를 찾는다 */
function group(title: string) {
  const heading = screen.getByText(title, { selector: '.place-links-group-title' });
  return within(heading.closest('.place-links-group') as HTMLElement).getAllByRole('link');
}

describe('AttractionLinks — 일반 영상과 쇼츠를 나눠 그린다', () => {
  it('일반 영상은 5개까지, 쇼츠는 따로 모아 쇼츠 주소로 열고 왼쪽 위에 쇼츠 표시를 얹는다', () => {
    // 수집 순서(인기순)에 쇼츠가 섞여 온다. 형태를 아직 모르는 영상(null)은 일반 쪽이다
    const collected = [
      video('s1', 'SHORT'), video('l1', 'LONG'), video('s2', 'SHORT'), video('u1', null),
      video('l2', 'LONG'), video('l3', 'LONG'), video('l4', 'LONG'), video('l5', 'LONG'),
    ];
    const { container } = render(<AttractionLinks links={JSON.stringify({ collected, deepLinks: [] })} lang="ko" />);

    expect(group('영상').map((a) => a.getAttribute('href'))).toEqual(
      ['l1', 'u1', 'l2', 'l3', 'l4'].map((id) => `https://www.youtube.com/watch?v=${id}`),
    );
    expect(group('쇼츠').map((a) => a.getAttribute('href'))).toEqual([
      'https://www.youtube.com/shorts/s1',
      'https://www.youtube.com/shorts/s2',
    ]);
    expect(container.querySelectorAll('.place-links-short-mark')).toHaveLength(2);
    group('영상').forEach((a) => expect(a.querySelector('.place-links-short-mark')).toBeNull());
  });

  it('쇼츠만 있어도 절을 그리고, 일반 영상 그룹은 그리지 않는다', () => {
    render(<AttractionLinks links={JSON.stringify({ collected: [video('s1', 'SHORT')], deepLinks: [] })} lang="en" />);
    expect(group('Shorts')).toHaveLength(1);
    expect(screen.queryByText('Videos', { selector: '.place-links-group-title' })).toBeNull();
  });
});
