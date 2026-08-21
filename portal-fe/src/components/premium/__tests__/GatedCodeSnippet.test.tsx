import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GatedCodeSnippet, { type GatedSnippetView } from '../GatedCodeSnippet';
import { storedUnlockToken } from '../snippetUnlock';

const unlockSnippets = vi.fn();
vi.mock('../../../api/portfolioApi', () => ({
  unlockSnippets: () => unlockSnippets(),
}));

const longPreview = Array.from({ length: 8 }, (_, i) => `line ${i + 1}`).join('\n');

function snippet(overrides: Partial<GatedSnippetView> = {}): GatedSnippetView {
  return {
    id: 1,
    title: '멱등 컨슈머',
    language: 'kotlin',
    filePath: 'order/app/src/main/kotlin/Consumer.kt',
    lineStart: 12,
    lineEnd: 48,
    gitUrl: 'https://github.com/example/msa/blob/main/Consumer.kt#L12-L48',
    previewCode: longPreview,
    totalLines: 20,
    locked: true,
    code: null,
    ...overrides,
  };
}

function renderSnippet(view: GatedSnippetView, onUnlocked?: (token: string) => void) {
  return render(
    <MemoryRouter initialEntries={['/portfolio']}>
      <GatedCodeSnippet snippet={view} onUnlocked={onUnlocked} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  unlockSnippets.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GatedCodeSnippet — 잠긴 상태', () => {
  it('미리보기만 그리고 잠금 띠에 두 가지 여는 길을 놓는다', () => {
    renderSnippet(snippet());

    expect(screen.getByText(/line 1/)).toBeInTheDocument();
    expect(screen.getByText('전체 20줄 중 8줄 미리보기')).toBeInTheDocument();

    const login = screen.getByRole('link', { name: '로그인하고 전체 보기' });
    expect(login).toHaveAttribute('href', `/shop/login?next=${encodeURIComponent('/portfolio')}`);
    expect(screen.getByRole('button', { name: '광고 보고 전체 보기' })).toBeInTheDocument();
  });

  it('메타데이터는 잠겨 있어도 보인다 — 파일 경로·줄 범위·Git 링크', () => {
    renderSnippet(snippet());

    expect(screen.getByText('order/app/src/main/kotlin/Consumer.kt')).toBeInTheDocument();
    expect(screen.getByText('L12–L48')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View on Git/ })).toHaveAttribute(
      'target',
      '_blank',
    );
  });

  it('전문이 미리보기보다 짧으면 잠금 띠를 그리지 않는다 — 이미 전부 보인다', () => {
    renderSnippet(snippet({ previewCode: 'one\ntwo', totalLines: 2 }));

    expect(screen.queryByRole('button', { name: '광고 보고 전체 보기' })).not.toBeInTheDocument();
  });
});

describe('GatedCodeSnippet — 열린 상태', () => {
  it('전문을 그리고 잠금 띠는 없다', () => {
    const fullCode = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n');
    renderSnippet(snippet({ locked: false, code: fullCode }));

    expect(screen.getByText(/line 20/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '광고 보고 전체 보기' })).not.toBeInTheDocument();
  });
});

describe('GatedCodeSnippet — 광고 보상 흐름', () => {
  it('카운트다운이 끝나야 보상 버튼이 활성화되고, 수령하면 토큰을 저장하고 알린다', async () => {
    vi.useFakeTimers();
    unlockSnippets.mockResolvedValue({ token: 'reward-token', expiresIn: 3600 });
    const onUnlocked = vi.fn();
    renderSnippet(snippet(), onUnlocked);

    fireEvent.click(screen.getByRole('button', { name: '광고 보고 전체 보기' }));

    const reward = screen.getByRole('button', { name: '코드 전체 보기' });
    expect(reward).toBeDisabled();
    expect(screen.getByText('5초 후 열립니다')).toBeInTheDocument();

    // 1초씩 진행한다 — 다음 초의 타이머는 이전 초의 렌더가 끝나야 걸린다
    for (let second = 0; second < 5; second += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }
    expect(screen.getByText('준비 완료')).toBeInTheDocument();
    expect(reward).toBeEnabled();

    await act(async () => {
      fireEvent.click(reward);
    });

    expect(unlockSnippets).toHaveBeenCalledTimes(1);
    expect(onUnlocked).toHaveBeenCalledWith('reward-token');
    expect(storedUnlockToken()).toBe('reward-token');
  });

  it('중도에 닫으면 보상이 없다', () => {
    renderSnippet(snippet());

    fireEvent.click(screen.getByRole('button', { name: '광고 보고 전체 보기' }));
    fireEvent.click(screen.getByRole('button', { name: /닫기/ }));

    expect(unlockSnippets).not.toHaveBeenCalled();
    expect(storedUnlockToken()).toBeNull();
  });
});
