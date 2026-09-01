import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameSuggestionsPanel } from '../GameSuggestions';
import type { GameSuggestion, SuggestionPage } from '../../../api/gameApi';

vi.mock('../../../api/gameApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/gameApi')>();
  return {
    ...actual,
    fetchSuggestions: vi.fn(),
    resolveGameNickname: vi.fn(),
    fetchMemberDisplayName: vi.fn(),
  };
});

import { fetchSuggestions, resolveGameNickname } from '../../../api/gameApi';

function suggestion(over: Partial<GameSuggestion> = {}): GameSuggestion {
  return {
    id: 1,
    nickname: '활잡이',
    body: '2스테이지 보스가 너무 빠릅니다',
    status: 'OPEN',
    createdAt: new Date().toISOString(),
    updatedAt: null,
    edited: false,
    mine: false,
    replies: [],
    ...over,
  };
}

function serve(items: GameSuggestion[]) {
  const page: SuggestionPage = {
    content: items,
    totalElements: items.length,
    number: 0,
    last: true,
  };
  vi.mocked(fetchSuggestions).mockResolvedValue(page);
}

function renderPanel(loggedIn: boolean) {
  return render(
    <MemoryRouter>
      <GameSuggestionsPanel slug="archer-outbreak" lang="ko" loggedIn={loggedIn} />
    </MemoryRouter>,
  );
}

describe('GameSuggestionsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveGameNickname).mockResolvedValue('활잡이');
  });

  it('비로그인이면 폼 대신 로그인 안내를 내고, 회원 이름을 부르지 않는다', async () => {
    serve([suggestion()]);
    renderPanel(false);

    await screen.findByText('2스테이지 보스가 너무 빠릅니다');
    expect(screen.queryByLabelText('개선 제안 내용')).toBeNull();
    expect(screen.getByRole('link', { name: '로그인' })).toBeTruthy();
    // 읽기만 하는 방문자에게 회원 API 를 부르지 않는다
    expect(vi.mocked(resolveGameNickname)).not.toHaveBeenCalled();
  });

  it('로그인하면 저장된 이름으로 폼이 열린다 — 이름을 다시 묻지 않는다', async () => {
    serve([]);
    renderPanel(true);

    await waitFor(() => expect(screen.getByLabelText('개선 제안 내용')).toBeTruthy());
    expect(screen.queryByLabelText('표시할 이름')).toBeNull();
    expect(screen.getByText('활잡이')).toBeTruthy();
  });

  it('이름을 확보하지 못하면 그 자리에서 입력받는다 — 다른 화면으로 보내지 않는다', async () => {
    serve([]);
    vi.mocked(resolveGameNickname).mockResolvedValue(null);
    renderPanel(true);

    await waitFor(() => expect(screen.getByLabelText('표시할 이름')).toBeTruthy());
    expect(screen.queryByLabelText('개선 제안 내용')).toBeNull();
  });

  it('남의 제안에는 수정·답글 버튼을 그리지 않는다', async () => {
    serve([suggestion({ mine: false })]);
    renderPanel(true);

    await screen.findByText('2스테이지 보스가 너무 빠릅니다');
    expect(screen.queryByRole('button', { name: '수정' })).toBeNull();
    expect(screen.queryByRole('button', { name: '답글' })).toBeNull();
  });

  it('내 제안에는 수정·답글 버튼이 뜬다', async () => {
    serve([suggestion({ mine: true })]);
    renderPanel(true);

    await screen.findByText('2스테이지 보스가 너무 빠릅니다');
    expect(screen.getByRole('button', { name: '수정' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '답글' })).toBeTruthy();
  });

  it('운영자 답글은 authorType 이 그린다 — 닉네임을 「운영자」로 지어도 배지는 따라오지 않는다', async () => {
    serve([
      suggestion({
        id: 1,
        replies: [
          { id: 10, authorType: 'OPERATOR', authorName: '운영자', body: '1.2 에서 낮췄습니다', createdAt: null },
          // 사칭 시도 — 이름은 「운영자」지만 자격은 AUTHOR 다
          { id: 11, authorType: 'AUTHOR', authorName: '운영자', body: '제가 진짜 운영자입니다', createdAt: null },
        ],
      }),
    ]);
    renderPanel(true);

    await screen.findByText('1.2 에서 낮췄습니다');
    const [real, impostor] = screen.getAllByText('운영자').map((el) => el.closest('li'));
    expect(real?.className).toContain('is-operator');
    expect(impostor?.className).toContain('is-author');
    expect(impostor?.className).not.toContain('is-operator');
  });

  it('처리 상태를 한국어 배지로 그린다', async () => {
    serve([suggestion({ status: 'APPLIED' })]);
    renderPanel(true);

    const badge = await screen.findByText('반영');
    expect(badge.className).toContain('is-applied');
  });

  it('수정된 제안에는 「수정됨」이 붙는다', async () => {
    serve([suggestion({ edited: true })]);
    renderPanel(true);

    expect(await screen.findByText('수정됨')).toBeTruthy();
  });
});
