import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import DrawPage from '../DrawPage';
import { DRAW_DRAFT_KEY } from '../drawDraft';
import { PARTY_KEY } from '../party';
import { listGames } from '../../../api/gameApi';
vi.mock('../../../api/gameApi', () => ({ listGames: vi.fn(), displayTitle: (g: { title: string }) => g.title }));
vi.mock('../../../seo/useSeo', () => ({ useSeo: vi.fn() }));
const games = ['marble-race', 'ladder-draw', 'card-flip', 'unsupported'].map((slug) => ({ slug, title: slug, tags: ['roster-ready'] }));
const page = { content: games } as unknown as Awaited<ReturnType<typeof listGames>>;
function draw(path = '/draw') { return render(<MemoryRouter initialEntries={[path]}><Routes>
  <Route path="/draw" element={<DrawPage />} /><Route path="/en/draw" element={<DrawPage />} />
  <Route path="/games/:slug" element={<p>game destination</p>} /><Route path="/en/games/:slug" element={<p>game destination</p>} />
</Routes></MemoryRouter>); }
beforeEach(() => { vi.restoreAllMocks(); localStorage.clear(); vi.mocked(listGames).mockReset().mockResolvedValue(page); });
describe('local draw', () => {
  it('filters games and consumes the real v1 parser with roster/mode and no room', async () => {
    const socket = vi.fn(); vi.stubGlobal('WebSocket', socket);
    draw(); await screen.findByRole('button', { name: 'marble-race' });
    expect(screen.queryByRole('button', { name: 'unsupported' })).toBeNull();
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull();
    fireEvent.change(screen.getByLabelText('참가자 · 한 줄에 한 명'), { target: { value: '가\n나\n다' } });
    fireEvent.click(screen.getByRole('button', { name: '순서 정하기' }));
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }));
    expect(screen.getByText('game destination')).toBeInTheDocument();
    const sandbox: Record<string, unknown> = { Date, JSON, Math, String, isFinite, parseInt, localStorage }; sandbox.window = sandbox;
    vm.runInNewContext(readFileSync('public/games/lib/party.js', 'utf8'), sandbox);
    expect((sandbox.GameParty as { take: (slug: string) => unknown }).take('marble-race')).toMatchObject({ names: ['가', '나', '다'], mode: 'order', room: null });
    expect(socket).not.toHaveBeenCalled(); vi.unstubAllGlobals();
  });
  it('handoff failure blocks navigation and keeps editable input', async () => {
    draw(); await screen.findByRole('button', { name: 'marble-race' });
    fireEvent.change(screen.getByLabelText('참가자 · 한 줄에 한 명'), { target: { value: '가\n나' } });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }));
    expect(screen.getByRole('alert')).toHaveTextContent('추첨을 저장하지 못했습니다');
    expect(screen.queryByText('game destination')).toBeNull(); expect(screen.getByLabelText('참가자 · 한 줄에 한 명')).toHaveValue('가\n나');
  });
  it('restores names/mode/game and tolerates corrupt/storage-denied drafts', async () => {
    localStorage.setItem(DRAW_DRAFT_KEY, JSON.stringify({ text: 'A\nB', mode: 'order', choice: 'ladder-draw' }));
    const rendered = draw('/en/draw'); await screen.findByRole('button', { name: 'ladder-draw' });
    expect(screen.getByLabelText('Participants · one per line')).toHaveValue('A\nB');
    expect(screen.getByRole('button', { name: 'Running order' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'ladder-draw' })).toHaveAttribute('aria-pressed', 'true');
    rendered.unmount(); localStorage.setItem(DRAW_DRAFT_KEY, 'invalid');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    draw(); await screen.findByRole('button', { name: 'marble-race' });
    expect(screen.getByText(/이 기기에 최근 설정/)).toBeInTheDocument();
    expect(screen.getByLabelText('참가자 · 한 줄에 한 명')).toHaveValue('참가자 1\n참가자 2\n참가자 3\n참가자 4');
  });
  it('does not start during loading, failure, filtered empty, or fewer than two names; retries', async () => {
    let resolve!: (p: typeof page) => void;
    vi.mocked(listGames).mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    draw(); expect(screen.getByRole('button', { name: '시작하기' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull();
    await act(async () => resolve({ content: [] } as unknown as typeof page));
    expect(screen.getByText('지금 이용할 수 있는 게임이 없습니다.')).toBeInTheDocument();
    vi.mocked(listGames).mockRejectedValueOnce(new Error('network'));
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await screen.findByRole('alert'); expect(screen.getByRole('button', { name: '시작하기' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await screen.findByRole('button', { name: 'marble-race' });
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull();
    fireEvent.change(screen.getByLabelText('참가자 · 한 줄에 한 명'), { target: { value: '혼자' } });
    await waitFor(() => expect(screen.getByRole('button', { name: '시작하기' })).toBeDisabled());
    expect(localStorage.getItem(PARTY_KEY)).toBeNull();
  });
});
