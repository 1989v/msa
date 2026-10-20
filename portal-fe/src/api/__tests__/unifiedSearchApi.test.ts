import { describe, expect, it, vi } from 'vitest';
const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('axios', () => ({ default: { create: () => ({ get }) } }));
import { searchUnified } from '../unifiedSearchApi';

describe('launcher adapter preserves deployed grouped API', () => {
  it('flattens actual groups and uses max group page count, not sum-of-types page count', async () => {
    get.mockResolvedValueOnce({ data: { success: true, data: { query: 'coffee', understood: { type: null, residual: 'coffee' }, groups: [
      { type: 'game', total: 45, hits: [{ id: '1', type: 'game', slug: 'garden', title: 'Garden', summary: null, facets: {} }] },
      { type: 'cafe_drink', total: 100, hits: [{ id: '2', type: 'cafe_drink', slug: 'coffee-key', title: 'Coffee', summary: 'brand', facets: { group: 'AMERICANO' } }] },
    ] } } });
    const signal = new AbortController().signal;
    const result = await searchUnified('coffee', '', 2, true, signal);
    expect(get).toHaveBeenCalledWith('/api/search/unified', { params: { q: 'coffee', type: undefined, size: 20, page: 2 }, signal });
    expect(result.total).toBe(145); expect(result.totalPages).toBe(5);
    expect(result.hits[0].sourceId).toBe('garden'); expect(result.hits[1].group).toBe('AMERICANO');
    expect(result.mode).toBe('grouped');
  });
});
