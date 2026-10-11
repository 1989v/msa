import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../../../api/gameApi', async (original) => ({ ...await original<typeof import('../../../api/gameApi')>(), listGames: vi.fn(), fetchGameTags: vi.fn(async () => [{ slug: 'quick', name: 'Quick' }]), fetchGameCollections: vi.fn(async () => []) }));
vi.mock('../../../hooks/useHeritageSurface', () => ({ useHeritageSurface() {}, useHeritageTheme: () => ['light', () => {}] }));
vi.mock('../../../components/GNB', () => ({ default: () => null }));
vi.mock('../../../components/Footer', () => ({ default: () => null }));
vi.mock('../GameCard', () => ({ default: ({ game }: {game: { title: string }}) => <p>{game.title}</p> }));
vi.mock('../LeaderboardRail', () => ({ default: () => null }));
vi.mock('../HouseBanner', () => ({ default: () => null }));
vi.mock('../../../components/ads/AdSlot', () => ({ default: () => null }));
import { listGames, type GameSummary } from '../../../api/gameApi';
import GamesPage from '../GamesPage';
import { gameUrl, hubMeta } from '../../../seo/copy.mjs';
const games = Array.from({ length: 48 }, (_, i) => ({ id: i, slug: `g${i}`, title: `Game ${i}`, genre: 'ACTION', tags: [] })) as unknown as GameSummary[];
const page = (total: number, content = games) => ({ content, totalElements: total, totalPages: 2, number: 0, size: content.length });
function deferred() { let resolve!: (value: ReturnType<typeof page>) => void; let reject!: (value: Error) => void; const promise = new Promise<ReturnType<typeof page>>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function mount(path = '/') { return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/" element={<GamesPage />} /><Route path="/games" element={<GamesPage />} /><Route path="/en" element={<GamesPage />} /><Route path="/games/genre/:genre" element={<GamesPage />} /></Routes></MemoryRouter>); }
function description() { return document.querySelector('meta[name="description"]')?.getAttribute('content'); }
beforeEach(() => { vi.clearAllMocks(); document.title = 'Initial'; document.head.querySelectorAll('meta,link,script').forEach((el) => el.remove()); const meta = document.createElement('meta'); meta.name = 'description'; meta.content = hubMeta('ko', 82).description; document.head.append(meta); const canonical = document.createElement('link'); canonical.rel = 'canonical'; canonical.href = gameUrl('ko'); document.head.append(canonical); });
it('keeps initial metadata while count loads or fails', async () => { const count = deferred(); vi.mocked(listGames).mockImplementation((params) => params?.size === 1 ? count.promise : Promise.resolve(page(82))); mount(); await screen.findByText('Game 47'); expect(description()).toContain('82종'); await act(async () => count.reject(Error('offline'))); expect(document.title).toBe('Initial'); expect(description()).toContain('82종'); });
it('uses 82 total for 48 cards during tag loading/failure and sort races', async () => { const tag = deferred(), slow = deferred(), fast = deferred(); vi.mocked(listGames).mockImplementation((params) => { if (params?.size === 1) return Promise.resolve(page(82, [])); if (params?.tag) return tag.promise; if (params?.sort === 'new') return slow.promise; if (params?.sort === 'top') return fast.promise; return Promise.resolve(page(82)); }); mount(); await screen.findByText('Game 47'); expect(description()).toContain('82종'); fireEvent.click(screen.getByText('Quick')); expect(description()).toContain('82종'); await act(async () => tag.reject(Error('offline'))); expect(await screen.findByText('게임 목록을 불러오지 못했습니다.')).toBeTruthy(); expect(description()).toContain('82종'); fireEvent.click(screen.getByText('Quick')); fireEvent.click(screen.getByText('신작')); fireEvent.click(screen.getByText('평점')); await act(async () => fast.resolve(page(82, [{ ...games[0], title: 'Latest' }]))); await screen.findByText('Latest'); await act(async () => slow.resolve(page(4, [{ ...games[0], title: 'Stale' }]))); expect(screen.queryByText('Stale')).toBeNull(); expect(description()).toContain('82종'); });
it('uses genre total and shared English guide', async () => { vi.mocked(listGames).mockImplementation((params) => Promise.resolve(page(params?.genre === 'ACTION' ? 60 : 82))); const view = mount('/games/genre/action'); await waitFor(() => expect(description()).toContain('60종')); expect(screen.queryByText('웹게임 고르고 시작하기')).toBeNull(); fireEvent.click(screen.getByRole('link', { name: '전체' })); await screen.findByText('웹게임 고르고 시작하기'); await waitFor(() => expect(description()).toContain('82종')); view.unmount(); mount('/en'); expect(screen.getByText('Choose a game and start playing')).toBeTruthy(); await waitFor(() => expect(description()).toContain('82 free')); });

it('moves to count-free metadata when a new scope fails and ignores stale counts', async () => {
 const action = deferred(), puzzle = deferred();
 vi.mocked(listGames).mockImplementation((params) => {
  if (params?.size === 1 && params.genre === 'ACTION') return action.promise;
  if (params?.size === 1 && params.genre === 'PUZZLE') return puzzle.promise;
  return Promise.resolve(page(82));
 });
 mount(); await screen.findByText('Game 47');
 fireEvent.click(screen.getAllByRole('link', { name: '액션' }).find((link) => link.classList.contains('game-genre-btn'))!);
 expect(description()).not.toMatch(/82종|0종/);
 fireEvent.click(screen.getAllByRole('link', { name: '퍼즐' }).find((link) => link.classList.contains('game-genre-btn'))!);
 await act(async () => { puzzle.reject(Error('offline')); action.resolve(page(60)); });
 expect(description()).toContain('퍼즐'); expect(description()).not.toMatch(/82종|60종|0종/);
 expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toContain('/genre/puzzle');
});
