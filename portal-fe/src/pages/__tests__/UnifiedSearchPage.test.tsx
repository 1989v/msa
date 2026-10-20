import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UnifiedSearchPage from '../UnifiedSearchPage';
import { searchUnified, unifiedHref } from '../../api/unifiedSearchApi';
import type { UnifiedHit, UnifiedResult } from '../../api/unifiedSearchApi';
vi.mock('../../api/unifiedSearchApi', async () => ({ ...(await vi.importActual('../../api/unifiedSearchApi')), searchUnified: vi.fn() }));
vi.mock('../../components/ThemeToggle', () => ({ default: () => null }));
const first: UnifiedHit = { id: 'game:1', type: 'game', title: '정원 게임', summary: '게임', sourceId: 'garden' };
const second: UnifiedHit = { id: 'attraction:2', type: 'attraction', title: '정원', summary: '서울', sourceId: '2' };
const result = (hits = [first, second]): UnifiedResult => ({ hits, total: hits.length, page: 0, size: 8, mode: 'bm25' });
const mocked = vi.mocked(searchUnified);
const pause = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 220)); });
function LocationProbe() { return <div data-testid="location">{useLocation().search}</div>; }
function mount(entry = '/search') { const navigate = vi.fn(); render(<MemoryRouter initialEntries={[entry]}><UnifiedSearchPage navigate={navigate} /><LocationProbe /></MemoryRouter>); return navigate; }
beforeEach(() => { mocked.mockReset(); mocked.mockResolvedValue(result()); });
afterEach(cleanup);

describe('unified search launcher', () => {
  it('selects first result by default; arrow selects another and Enter opens the direct detail', async () => {
    const navigate = mount(); const input = screen.getByRole('combobox', { name: '검색어' });
    fireEvent.change(input, { target: { value: '정원' } }); await pause();
    expect(await screen.findAllByRole('option')).toHaveLength(2);
    expect(screen.getByRole('option', { name: /정원 게임/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'Enter' }); expect(navigate).toHaveBeenLastCalledWith('/games/garden');
    fireEvent.keyDown(input, { key: 'ArrowDown' }); fireEvent.keyDown(input, { key: 'Enter' });
    expect(navigate).toHaveBeenLastCalledWith('/place/attractions/2');
  });
  it('composition Enter never navigates and loading input immediately clears old selection', async () => {
    const navigate = mount(); const input = screen.getByRole('combobox', { name: '검색어' });
    fireEvent.change(input, { target: { value: '정원' } }); await pause();
    fireEvent.compositionStart(input); fireEvent.keyDown(input, { key: 'Enter', isComposing: true }); fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { key: 'Enter' }); expect(navigate).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '다른 검색' } }); fireEvent.keyDown(input, { key: 'Enter' });
    expect(navigate).not.toHaveBeenCalled();
  });
  it('ignores reverse responses even when the old transport does not honor abort', async () => {
    let oldResolve!: (value: UnifiedResult) => void;
    mocked.mockImplementationOnce(() => new Promise(resolve => { oldResolve = resolve; })).mockResolvedValueOnce(result([second]));
    const navigate = mount(); const input = screen.getByRole('combobox', { name: '검색어' });
    fireEvent.change(input, { target: { value: 'old' } }); await pause();
    fireEvent.change(input, { target: { value: 'new' } }); await pause();
    await act(async () => { oldResolve(result([first])); });
    fireEvent.keyDown(input, { key: 'Enter' }); expect(navigate).toHaveBeenCalledWith('/place/attractions/2');
    expect(screen.queryByText('정원 게임')).not.toBeInTheDocument();
  });
  it('ignores legacy type restrictions while restoring full results/page from URL and allows explicit repeated full search', async () => {
    mount('/search?q=coffee&type=cafe_drink&all=1&page=2');
    await waitFor(() => expect(mocked).toHaveBeenCalledWith('coffee', '', 2, true, expect.any(AbortSignal)));
    expect(screen.getByRole('combobox', { name: '검색어' })).toHaveValue('coffee');
    expect(screen.queryByRole('combobox', { name: '검색 종류' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '이전' }));
    await waitFor(() => expect(mocked).toHaveBeenLastCalledWith('coffee', '', 1, true, expect.any(AbortSignal)));
    expect(screen.getByTestId('location')).toHaveTextContent('?q=coffee&all=1&page=1');
    fireEvent.click(screen.getByText('전체 결과 보기'));
    await waitFor(() => expect(mocked).toHaveBeenLastCalledWith('coffee', '', 0, true, expect.any(AbortSignal)));
  });
  it('searches every service in autocomplete even with a legacy game-only URL', async () => {
    mount('/search?q=정원&type=game');
    await pause();
    expect(mocked).toHaveBeenLastCalledWith('정원', '', 0, false, expect.any(AbortSignal));
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(screen.getByText('게임', { selector: '.unified-hit-type' })).toBeInTheDocument();
    expect(screen.getByText('장소')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: '검색 종류' })).not.toBeInTheDocument();
  });
  it('distinguishes empty, loading, zero results and errors', async () => {
    mount(); const input = screen.getByRole('combobox', { name: '검색어' }); expect(screen.getByRole('status')).toHaveTextContent('이름을 입력');
    mocked.mockResolvedValueOnce(result([])); fireEvent.change(input, { target: { value: 'none' } });
    expect(screen.getByRole('status')).toHaveTextContent('검색 중'); await pause();
    expect(screen.getByRole('status')).toHaveTextContent('검색 결과가 없습니다');
    mocked.mockRejectedValueOnce(new Error('down')); fireEvent.change(input, { target: { value: 'error' } }); await pause();
    expect(screen.getByRole('status')).toHaveTextContent('검색을 불러오지 못했습니다');
  });
  it('builds canonical production and local destinations including English places and cafe comparison', () => {
    expect(unifiedHref(first, '1989v.com')).toBe('https://game.1989v.com/games/garden');
    expect(unifiedHref({ ...second, lang: 'en' }, 'localhost')).toBe('/en/place/attractions/2');
    expect(unifiedHref(second, 'game.1989v.com')).toBe('https://place.1989v.com/attractions/2');
    const href = unifiedHref({ ...first, type: 'cafe_drink', title: '아메리카노', group: 'AMERICANO' }, 'localhost');
    const params = new URL(href, 'http://localhost').searchParams;
    expect(params.get('q')).toBe('아메리카노'); expect(params.get('group')).toBe('AMERICANO'); expect(params.has('brand')).toBe(false);
  });
});
