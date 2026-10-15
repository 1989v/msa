import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../client';
import * as api from '../marketGeometry';
describe('P4 geometry API contract', () => {
  afterEach(() => vi.restoreAllMocks());
  it('unwraps geometry and review list from ApiResponse', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: [] } }); expect(await api.getGeometry(1)).toEqual([]); expect(await api.getNeedsReview(1)).toEqual([]); expect(get.mock.calls.map(c => c[0])).toEqual(['/api/v1/admin/place/markets/1/geometry', '/api/v1/admin/place/markets/1/needs-review']);
  });
  it('uses contract verbs, paired null resets and query deletion reasons', async () => {
    const result = { rejudge: { changedStores: 12 } }, response = { data: { data: result } }; const put = vi.spyOn(apiClient, 'put').mockResolvedValue(response), post = vi.spyOn(apiClient, 'post').mockResolvedValue(response), del = vi.spyOn(apiClient, 'delete').mockResolvedValue(response);
    expect(await api.saveBoundary(1, [[37, 127], [38, 127], [38, 128]], '확인')).toEqual(result); await api.resetBoundary(1, 'DERIVED', '초안'); expect(post).toHaveBeenCalledWith('/api/v1/admin/place/markets/1/boundary/reset', { to: 'DERIVED', reason: '초안' });
    const path = { name: null, geometry: [[37, 127], [38, 127]] as api.LatLng[], reason: '추가' }; await api.savePath(1, null, path); await api.savePath(1, 4, path); expect(post).toHaveBeenCalledWith('/api/v1/admin/place/markets/1/paths', path); expect(put).toHaveBeenCalledWith('/api/v1/admin/place/markets/1/paths/4', path);
    for (const kind of ['paths', 'entrances', 'road-rules'] as const) { await api.deleteGeometryItem(1, kind, 4, '삭제 이유'); expect(del).toHaveBeenCalledWith(`/api/v1/admin/place/markets/1/${kind}/4`, { params: { reason: '삭제 이유' } }); }
    const geo = { centerLat: null, centerLng: null, radiusM: null, reason: '해제' }; await api.saveGeo(1, geo); expect(put).toHaveBeenCalledWith('/api/v1/admin/place/markets/1/geo', geo); await api.assignStorePath(1, 8, 4, '확인'); expect(put).toHaveBeenCalledWith('/api/v1/admin/place/markets/1/stores/8/path', { pathId: 4, reason: '확인' });
  });
});
