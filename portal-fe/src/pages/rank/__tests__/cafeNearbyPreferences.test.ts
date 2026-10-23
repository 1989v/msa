import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { nearbyBrandsKey, nearbyFingerprint, readNearbyBrands, saveNearbyBrands } from '../cafeNearbyPreferences';
beforeEach(() => { localStorage.clear(); vi.stubGlobal('crypto', webcrypto); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('restores within the same grid, resets another grid/area and stores no coordinate or grid', async () => {
 const point = { kind: 'CURRENT' as const, lat: 37.51234567, lng: 127.01234567 };
 const hash = (await nearbyFingerprint(point))!;
 expect(hash).toMatch(/^current:[a-f0-9]{64}$/);
 saveNearbyBrands(hash, ['mega', 'ediya']);
 expect(readNearbyBrands((await nearbyFingerprint({ ...point, lat: 37.519, lng: 127.019 }))!)).toEqual(['mega', 'ediya']);
 expect(readNearbyBrands((await nearbyFingerprint({ ...point, lat: 37.52 }))!)).toEqual([]);
 const stored = localStorage.getItem(nearbyBrandsKey)!;
 for (const number of ['37.51234567', '127.01234567', '3751', '12701']) expect(stored).not.toContain(number);
 saveNearbyBrands('area:1168000000', ['mega']);
 expect(readNearbyBrands('area:1168000000')).toEqual(['mega']);
 expect(readNearbyBrands('area:5011000000')).toEqual([]);
});
it('keeps selections in memory when storage is blocked and never substitutes a raw grid when crypto fails', async () => {
 vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
 vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
 saveNearbyBrands('area:test', ['mega']);
 expect(readNearbyBrands('area:test')).toEqual(['mega']);
 vi.stubGlobal('crypto', {});
 expect(await nearbyFingerprint({ kind: 'CURRENT', lat: 37.5, lng: 127 })).toBeNull();
});

it('uses the latest in-memory selection when overwriting an older stored preference fails', () => {
 saveNearbyBrands('area:quota', ['mega']);
 vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
 saveNearbyBrands('area:quota', ['ediya']);
 expect(readNearbyBrands('area:quota')).toEqual(['ediya']);
});
