import type { ReactNode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { searchMarketStores } from '../../../api/marketApi';
import { useMarketStoreSearch } from '../useMarketStoreSearch';
vi.mock('../../../api/marketApi', () => ({ searchMarketStores: vi.fn() }));
const result = { items: [{ storeId: 3, contentId: '100', matchedBy: 'DISH' as const, score: 8 }, { storeId: 1, contentId: '100', matchedBy: 'ROMAN' as const, score: 4 }], total: 2, markets: [] };
function mount(query = '') {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  return renderHook(({ q }) => useMarketStoreSearch(q, '100', 'ko'), {
    initialProps: { q: query }, wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
}
const tick = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
beforeEach(() => { vi.useFakeTimers(); vi.mocked(searchMarketStores).mockResolvedValue(result); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.resetAllMocks(); });
describe('market engine search', () => {
  it('disables short inputs, coalesces typing at 300ms, preserves order, hides stale results and reuses cache', async () => {
    const { result: hook, rerender } = mount('국');
    await tick(500); expect(searchMarketStores).toHaveBeenCalledTimes(0);
    rerender({ q: '국밥' }); await tick(150); rerender({ q: '국밥집' });
    await tick(299); expect(searchMarketStores).toHaveBeenCalledTimes(0);
    await tick(1); await tick(1); expect(searchMarketStores).toHaveBeenCalledTimes(1);
    expect(hook.current.storeIds).toEqual([3, 1]); expect(hook.current.matchedBy.get(3)).toBe('DISH');
    rerender({ q: '국밥' }); expect(hook.current.status).toBe('fallback');
    await tick(301); expect(searchMarketStores).toHaveBeenCalledTimes(2);
    rerender({ q: '국밥집' }); expect(hook.current.status).toBe('fallback');
    await tick(301); expect(hook.current.storeIds).toEqual([3, 1]); expect(searchMarketStores).toHaveBeenCalledTimes(2);
    rerender({ q: '' }); await tick(500); expect(hook.current.status).toBe('fallback'); expect(searchMarketStores).toHaveBeenCalledTimes(2);
  });
  it.each(['error', 'null', 'empty'])('falls back without retries on %s', async kind => {
    if (kind === 'error') vi.mocked(searchMarketStores).mockRejectedValue(new Error('offline'));
    else vi.mocked(searchMarketStores).mockResolvedValue(kind === 'null' ? null : { ...result, items: [] });
    const { result: hook } = mount('국밥'); await tick(301); await tick(1000);
    expect(hook.current).toEqual({ status: 'fallback', storeIds: [], matchedBy: new Map() }); expect(searchMarketStores).toHaveBeenCalledTimes(1);
  });
});

it('debounces an initial shared query and ignores its late response after the input changes', async () => {
  let resolve!: (value: typeof result) => void;
  vi.mocked(searchMarketStores).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const { result: hook, rerender } = mount('국밥');
  await tick(299); expect(searchMarketStores).toHaveBeenCalledTimes(0);
  await tick(1); expect(searchMarketStores).toHaveBeenCalledTimes(1);
  rerender({ q: '떡볶이' });
  await act(async () => { resolve(result); }); await tick(1);
  expect(hook.current.status).toBe('fallback'); expect(hook.current.storeIds).toEqual([]);
  await tick(298); expect(searchMarketStores).toHaveBeenCalledTimes(1);
  await tick(2); expect(searchMarketStores).toHaveBeenCalledTimes(2); await tick(1); expect(hook.current.storeIds).toEqual([3, 1]);
});
