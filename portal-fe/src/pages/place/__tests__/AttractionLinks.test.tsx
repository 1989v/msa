import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AttractionLinks from '../AttractionLinks';

const video = (id: string, format: 'LONG' | 'SHORT' | null) => ({
  source: 'YOUTUBE', externalId: id, title: `영상 ${id}`, url: `https://www.youtube.com/watch?v=${id}`,
  thumbnailUrl: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`, author: null, publishedAt: null, viewCount: null,
  duration: null, format,
});

/** 영상 절의 카드 링크 */
function videoLinks() {
  const heading = screen.getByText(/^(영상|Videos)$/, { selector: '.place-links-group-title' });
  return within(heading.closest('.place-links-group') as HTMLElement).getAllByRole('link');
}

describe('AttractionLinks — 영상 절 하나에서 롱폼과 쇼츠를 전환한다', () => {
  it('처음은 롱폼 5개, 쇼츠로 바꾸면 쇼츠 주소·쇼츠 표시로 그린다', () => {
    // 수집 순서(인기순)에 쇼츠가 섞여 온다. 형태를 아직 모르는 영상(null)은 롱폼 쪽이다
    const collected = [
      video('s1', 'SHORT'), video('l1', 'LONG'), video('s2', 'SHORT'), video('u1', null),
      video('l2', 'LONG'), video('l3', 'LONG'), video('l4', 'LONG'), video('l5', 'LONG'),
    ];
    const { container } = render(<AttractionLinks links={JSON.stringify({ collected, deepLinks: [] })} lang="ko" />);

    const long = screen.getByRole('button', { name: '롱폼 5' });
    const shorts = screen.getByRole('button', { name: '쇼츠 2' });
    expect(long).toHaveAttribute('aria-pressed', 'true');
    expect(videoLinks().map((a) => a.getAttribute('href'))).toEqual(
      ['l1', 'u1', 'l2', 'l3', 'l4'].map((id) => `https://www.youtube.com/watch?v=${id}`),
    );
    expect(container.querySelectorAll('.place-links-short-mark')).toHaveLength(0);

    fireEvent.click(shorts);
    expect(shorts).toHaveAttribute('aria-pressed', 'true');
    expect(videoLinks().map((a) => a.getAttribute('href'))).toEqual([
      'https://www.youtube.com/shorts/s1',
      'https://www.youtube.com/shorts/s2',
    ]);
    expect(container.querySelectorAll('.place-links-short-mark')).toHaveLength(2);
  });

  it('한 종류만 있으면 전환 없이 그것만 그린다', () => {
    render(<AttractionLinks links={JSON.stringify({ collected: [video('s1', 'SHORT')], deepLinks: [] })} lang="en" />);
    expect(videoLinks()).toHaveLength(1);
    expect(screen.queryByRole('group', { name: 'Videos' })).toBeNull();
  });
});
