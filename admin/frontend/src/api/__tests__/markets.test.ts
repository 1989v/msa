import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../client';
import { listMarkets, overrideStore, orderZones, revertChange } from '../markets';
describe('admin markets API', () => {
  afterEach(() => vi.restoreAllMocks());
  it('uses admin pagination and exact override payload', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: { items: [], total: 0, page: 2, size: 20 } } });
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue({});
    await listMarkets('광장', 2);
    expect(get).toHaveBeenCalledWith('/api/v1/admin/place/markets', { params: { name: '광장', page: 2, size: 20 } });
    const payload = { values: { latitude: '37.5', longitude: '127' }, clear: [], reason: '핀 수정' };
    await overrideStore(1, 2, payload);
    expect(put).toHaveBeenCalledWith('/api/v1/admin/place/markets/1/stores/2/override', payload);
  });
  it('sends all zone IDs as array and reverts with POST', async () => {
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue({}); const post = vi.spyOn(apiClient, 'post').mockResolvedValue({});
    await orderZones(1, [3, 2, 1]); await revertChange(1, 9);
    expect(put).toHaveBeenCalledWith('/api/v1/admin/place/markets/1/zones/order', [3, 2, 1]);
    expect(post).toHaveBeenCalledWith('/api/v1/admin/place/markets/1/changes/9/revert');
  });
});
