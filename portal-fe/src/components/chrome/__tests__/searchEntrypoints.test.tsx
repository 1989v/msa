import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCallback, useState } from 'react';
import ServiceExplorer from '../ServiceExplorer';
import UnifiedSearchPage from '../../../pages/UnifiedSearchPage';
import { searchUnified, type UnifiedHit, type UnifiedResult } from '../../../api/unifiedSearchApi';

vi.mock('../../../api/unifiedSearchApi', async () => ({ ...(await vi.importActual('../../../api/unifiedSearchApi')), searchUnified: vi.fn() }));
vi.mock('../../../api/displayApi', () => ({ fetchDisplayServices: vi.fn().mockResolvedValue([
  { code: 'game', label: '게임 모음', status: 'OPEN', href: '/games', tagline: 'Play', orderNo: 1 },
  { code: 'future', label: '준비 중 서비스', status: 'PREOPEN', href: null, tagline: null, orderNo: 2 },
]) }));
vi.mock('../../../components/ThemeToggle', () => ({ default: () => null }));
const game: UnifiedHit = { id: 'game:1', type: 'game', title: 'Garden game', summary: 'Play now', sourceId: 'garden' };
const place: UnifiedHit = { id: 'attraction:2', type: 'attraction', title: 'Garden place', summary: 'Seoul', sourceId: '2', lang: 'en' };
const result = (hits = [game, place]): UnifiedResult => ({ hits, total: hits.length, page: 0, size: 8, mode: 'bm25' });
const api = vi.mocked(searchUnified);
const pause = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 210)); });
const enter = (input: HTMLElement) => fireEvent.keyDown(input, { key: 'Enter' });
beforeEach(() => { api.mockReset(); api.mockResolvedValue(result()); });
afterEach(cleanup);

function mount(kind: 'page' | 'explorer', navigate = vi.fn()) {
  const view = render(kind === 'page'
    ? <MemoryRouter><UnifiedSearchPage navigate={navigate} /></MemoryRouter>
    : <ServiceExplorer onClose={vi.fn()} navigate={navigate} />);
  return { ...view, navigate, input: screen.getByRole('combobox') };
}

describe.each(['page', 'explorer'] as const)('%s shared autocomplete contract', kind => {
  it('debounces all-service requests, selects first, wraps arrows and directly opens in one Enter', async () => {
    const { input, navigate } = mount(kind);
    fireEvent.change(input, { target: { value: 'garden' } });
    expect(api).not.toHaveBeenCalled(); enter(input); expect(navigate).not.toHaveBeenCalled();
    await pause();
    expect(api).toHaveBeenLastCalledWith('garden', '', 0, false, expect.any(AbortSignal));
    const options = screen.getAllByRole('option');
    expect(input).toHaveAttribute('aria-controls', screen.getByRole('listbox').id);
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    enter(input); expect(navigate).toHaveBeenLastCalledWith('/games/garden');
    fireEvent.keyDown(input, { key: 'ArrowUp' }); enter(input);
    expect(navigate).toHaveBeenLastCalledWith('/en/place/attractions/2');
    fireEvent.keyDown(input, { key: 'ArrowDown' }); enter(input);
    expect(navigate).toHaveBeenLastCalledWith('/games/garden');
  });
  it('protects all IME Enter variants and the composition-end Enter', async () => {
    const { input, navigate } = mount(kind);
    fireEvent.change(input, { target: { value: 'garden' } }); await pause();
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 });
    fireEvent.compositionStart(input); enter(input); fireEvent.compositionEnd(input); enter(input);
    expect(navigate).not.toHaveBeenCalled();
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 65)); });
    enter(input); expect(navigate).toHaveBeenCalledOnce();
  });
  it('clears old selection immediately and ignores reverse or cleared-query responses', async () => {
    let oldResolve!: (value: UnifiedResult) => void;
    api.mockImplementationOnce(() => new Promise(resolve => { oldResolve = resolve; }));
    const { input, navigate } = mount(kind);
    fireEvent.change(input, { target: { value: 'old' } }); await pause();
    const oldSignal = api.mock.calls[0][4];
    fireEvent.change(input, { target: { value: 'new' } }); enter(input);
    expect(navigate).not.toHaveBeenCalled(); expect(oldSignal.aborted).toBe(true);
    await pause();
    await act(async () => oldResolve(result([{ ...game, title: 'Obsolete' }])));
    expect(screen.queryByText('Obsolete')).not.toBeInTheDocument();
    enter(input); expect(navigate).toHaveBeenLastCalledWith('/games/garden');
    let clearResolve!: (value: UnifiedResult) => void;
    api.mockImplementationOnce(() => new Promise(resolve => { clearResolve = resolve; }));
    fireEvent.change(input, { target: { value: 'pending' } }); await pause();
    fireEvent.change(input, { target: { value: '' } });
    await act(async () => clearResolve(result())); enter(input);
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(navigate).toHaveBeenCalledOnce();
  });
  it('never navigates on idle, zero results or errors', async () => {
    const { input, navigate } = mount(kind); enter(input);
    api.mockResolvedValueOnce(result([]));
    fireEvent.change(input, { target: { value: 'none' } }); await pause(); enter(input);
    expect(screen.getByText('검색 결과가 없습니다.')).toBeInTheDocument();
    api.mockRejectedValueOnce(new Error('offline'));
    fireEvent.change(input, { target: { value: 'error' } }); await pause(); enter(input);
    expect(screen.getByText(/검색을 불러오지 못했습니다/)).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });
  it('aborts on close and starts clean on reopen even if transport resolves later', async () => {
    let resolveOld!: (value: UnifiedResult) => void;
    api.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    const first = mount(kind);
    fireEvent.change(first.input, { target: { value: 'old' } }); await pause();
    const signal = api.mock.calls[0][4]; first.unmount(); expect(signal.aborted).toBe(true);
    const reopened = mount(kind);
    await act(async () => resolveOld(result()));
    enter(reopened.input); expect(reopened.navigate).not.toHaveBeenCalled();
    expect(reopened.input).toHaveValue(''); expect(screen.queryAllByRole('option')).toHaveLength(0);
    fireEvent.change(reopened.input, { target: { value: 'new' } }); await pause(); enter(reopened.input);
    expect(reopened.navigate).toHaveBeenCalledWith('/games/garden');
  });
});

function DialogHarness() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return <><button onClick={() => setOpen(true)}>Explore</button>{open && <ServiceExplorer onClose={close} />}</>;
}

describe('service explorer dialog integration', () => {
  it('keeps cards, dismisses autocomplete before dialog, preserves focus trap and restores opener', async () => {
    render(<DialogHarness />);
    const opener = screen.getByRole('button', { name: 'Explore' }); opener.focus(); fireEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: '서비스 탐색' });
    expect(dialog).toHaveFocus();
    const input = screen.getByRole('combobox'); input.focus();
    fireEvent.change(input, { target: { value: 'garden' } }); await pause();
    expect(screen.getByRole('link', { name: /게임 모음/ })).toHaveAttribute('href', '/games');
    expect(screen.getByText('준비 중 서비스').closest('[aria-disabled]')).toHaveAttribute('aria-disabled', 'true');
    fireEvent.compositionStart(input); fireEvent.keyDown(input, { key: 'Escape' });
    expect(dialog).toBeInTheDocument(); fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(dialog).toBeInTheDocument(); expect(input).toHaveFocus(); expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    const lastLink = within(dialog).getByRole('link', { name: /게임 모음/ }); lastLink.focus();
    fireEvent.keyDown(lastLink, { key: 'Tab' }); expect(input).toHaveFocus();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(opener).toHaveFocus();
  });
  it('scrolls the active option into view as arrow selection wraps in the bounded results list', async () => {
    const original = Element.prototype.scrollIntoView;
    const scroll = vi.fn(); Element.prototype.scrollIntoView = scroll;
    try {
      const { input } = mount('explorer');
      fireEvent.change(input, { target: { value: 'garden' } }); await pause();
      const options = screen.getAllByRole('option');
      expect(scroll).toHaveBeenLastCalledWith({ block: 'nearest' });
      expect(scroll.mock.contexts.at(-1)).toBe(options[0]);
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(scroll.mock.contexts.at(-1)).toBe(options[1]);
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(scroll.mock.contexts.at(-1)).toBe(options[0]);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });
  it('handles native form submission only for a ready selection and blocks IME submit sequences', async () => {
    const { input, navigate } = mount('explorer');
    const form = screen.getByRole('search');
    fireEvent.submit(form); expect(navigate).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'garden' } });
    fireEvent.submit(form); expect(navigate).not.toHaveBeenCalled(); await pause();
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true }); fireEvent.submit(form);
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 }); fireEvent.submit(form);
    fireEvent.compositionStart(input); enter(input); fireEvent.submit(form);
    fireEvent.compositionEnd(input); fireEvent.submit(form);
    expect(navigate).not.toHaveBeenCalled();
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 65)); });
    fireEvent.submit(form); expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenLastCalledWith('/games/garden');
    navigate.mockClear();
    // A normal Enter cancels default form submission, so it opens only once.
    expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(false);
    expect(navigate).toHaveBeenCalledOnce();
  });
  it('keeps English results and the explicit all-results link', async () => {
    const navigate = vi.fn();
    render(<ServiceExplorer lang="en" onClose={vi.fn()} navigate={navigate} />);
    const input = screen.getByRole('combobox', { name: 'Search all services' });
    fireEvent.change(input, { target: { value: 'garden' } }); await pause();
    expect(screen.getByRole('dialog', { name: 'Explore services' })).toBeInTheDocument();
    expect(screen.getByText('Place')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View all results' })).toHaveAttribute('href', '/search?q=garden&all=1');
    expect(screen.getByRole('link', { name: /Free web games/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: /Garden place/ }));
    expect(navigate).toHaveBeenCalledWith('/en/place/attractions/2');
  });
});
