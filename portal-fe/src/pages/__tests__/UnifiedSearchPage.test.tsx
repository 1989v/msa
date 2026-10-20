import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
function mount(entry = '/search') { const navigate = vi.fn(); render(<MemoryRouter initialEntries={[entry]}><UnifiedSearchPage navigate={navigate} /></MemoryRouter>); return navigate; }
beforeEach(() => { mocked.mockReset(); mocked.mockResolvedValue(result()); });
afterEach(cleanup);

describe('unified search launcher', () => {
  it('selects first result by default; arrow selects another and Enter opens the direct detail', async () => {
    const navigate = mount(); const input = screen.getByRole('combobox', { name: '검색어' });
    fireEvent.change(input, { target: { value: '정원' } }); await pause();
    expect(await screen.findAllByRole('option')).toHaveLength(11); // 9 type choices + 2 results
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
  it('restores full results/filter/page from URL and allows explicit repeated full search', async () => {
    mount('/search?q=coffee&type=cafe_drink&all=1&page=2');
    await waitFor(() => expect(mocked).toHaveBeenCalledWith('coffee', 'cafe_drink', 2, true, expect.any(AbortSignal)));
    expect(screen.getByRole('combobox', { name: '검색어' })).toHaveValue('coffee');
    fireEvent.click(screen.getByText('전체 결과 보기'));
    await waitFor(() => expect(mocked).toHaveBeenLastCalledWith('coffee', 'cafe_drink', 0, true, expect.any(AbortSignal)));
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
