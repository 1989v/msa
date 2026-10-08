import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SharePanel from '../SharePanel';

const SHORT = 'https://1989v.com/g/5mZiq85';
const CANONICAL = 'https://game.1989v.com/games/abyssal-crown';

let writeText: ReturnType<typeof vi.fn>;
let share: ReturnType<typeof vi.fn> | undefined;

beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined);
  share = undefined;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  Object.defineProperty(navigator, 'share', { configurable: true, get: () => share });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function externalHrefs() {
  return {
    x: screen.getByRole('link', { name: /^X/ }).getAttribute('href') ?? '',
    linkedIn: screen.getByRole('link', { name: /^LinkedIn/ }).getAttribute('href') ?? '',
  };
}

describe('SharePanel — 단축 주소가 있을 때', () => {
  it('복사·외부 공유 링크가 모두 단축 주소를 쓴다', async () => {
    render(<SharePanel shortUrl={SHORT} url={CANONICAL} title="심연의 왕관" />);

    await userEvent.click(screen.getByRole('button', { name: '링크 복사' }));

    expect(writeText).toHaveBeenCalledWith(SHORT);
    expect(await screen.findByRole('button', { name: '복사됨' })).toBeInTheDocument();
    const { x, linkedIn } = externalHrefs();
    expect(x).toContain(`url=${encodeURIComponent(SHORT)}`);
    expect(linkedIn).toContain(`url=${encodeURIComponent(SHORT)}`);
    expect(x).not.toContain(encodeURIComponent(CANONICAL));
  });

  it('Web Share 가 있으면 단축 주소를 넘긴다', async () => {
    share = vi.fn().mockResolvedValue(undefined);
    render(<SharePanel shortUrl={SHORT} url={CANONICAL} title="심연의 왕관" />);

    await userEvent.click(screen.getByRole('button', { name: '공유' }));

    expect(share).toHaveBeenCalledWith({ title: '심연의 왕관', url: SHORT });
    expect(writeText).not.toHaveBeenCalled();
  });
});

describe('SharePanel — 단축 주소가 없을 때', () => {
  it('null 이면 넘긴 주소(canonical)로 대신한다', async () => {
    render(<SharePanel shortUrl={null} url={CANONICAL} title="심연의 왕관" />);

    await userEvent.click(screen.getByRole('button', { name: '링크 복사' }));

    expect(writeText).toHaveBeenCalledWith(CANONICAL);
    expect(externalHrefs().x).toContain(`url=${encodeURIComponent(CANONICAL)}`);
  });

  it('주소도 안 넘기면 현재 페이지 주소를 복사·공유한다', async () => {
    window.history.replaceState(null, '', '/attractions/126508');
    const here = window.location.href;
    render(<SharePanel title="경복궁" />);

    await userEvent.click(screen.getByRole('button', { name: '링크 복사' }));
    expect(writeText).toHaveBeenCalledWith(here);

    // Web Share 가 없는 브라우저는 공유 버튼도 복사로 떨어진다
    await userEvent.click(screen.getByRole('button', { name: '공유' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
    expect(writeText).toHaveBeenLastCalledWith(here);
  });
});

describe('SharePanel — 영문 화면', () => {
  it('버튼 이름이 영문이다', () => {
    render(<SharePanel shortUrl={SHORT} title="Gyeongbokgung" lang="en" />);

    expect(screen.getByRole('group', { name: 'Share' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();
  });
});
