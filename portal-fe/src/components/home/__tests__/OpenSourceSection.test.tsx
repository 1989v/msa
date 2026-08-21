import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import OpenSourceSection from '../OpenSourceSection';
import type { OpenSourceItem } from '../../../api/displayApi';

// jsdom 에는 useReveal 이 쓰는 두 API 가 없다 — 모션은 이 테스트의 관심사가 아니다.
beforeAll(() => {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
  vi.stubGlobal(
    'IntersectionObserver',
    vi.fn().mockReturnValue({ observe: vi.fn(), disconnect: vi.fn() }),
  );
});

const items: OpenSourceItem[] = [
  {
    slug: 'muxbar',
    name: 'muxbar',
    tagline: 'macOS 메뉴바 tmux 세션 관리',
    repoUrl: 'https://github.com/1989v/muxbar',
    language: 'Swift',
    orderNo: 10,
  },
  {
    slug: 'kafka-lens',
    name: 'kafka-lens',
    tagline: '자체 호스팅 Kafka UI',
    repoUrl: 'https://github.com/1989v/kafka-lens',
    language: 'Kotlin · TypeScript',
    orderNo: 20,
  },
];

describe('OpenSourceSection', () => {
  it('카드 전체가 저장소로 가는 외부 링크다 — 새 탭 + noopener', () => {
    render(<OpenSourceSection items={items} />);

    const card = screen.getByRole('link', { name: /muxbar/ });
    expect(card).toHaveAttribute('href', 'https://github.com/1989v/muxbar');
    expect(card).toHaveAttribute('target', '_blank');
    expect(card).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('이름·태그라인·언어 태그를 그린다', () => {
    render(<OpenSourceSection items={items} />);

    expect(screen.getByText('자체 호스팅 Kafka UI')).toBeInTheDocument();
    expect(screen.getByText('Kotlin · TypeScript')).toBeInTheDocument();
  });

  it('빈 목록이면 섹션 자체를 그리지 않는다 — 눌러도 갈 곳 없는 메뉴 앵커를 남기지 않는다', () => {
    const { container } = render(<OpenSourceSection items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
