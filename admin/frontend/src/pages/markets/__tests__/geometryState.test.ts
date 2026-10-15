import { describe, it, expect } from 'vitest';
import { editBoundary, rejudgeMessage } from '../geometryState';
import type { LatLng } from '@/api/marketGeometry';
describe('boundary vertex editing', () => {
  const points: LatLng[] = [[37, 127], [38, 127], [38, 128]];
  it('moves, inserts across the closing edge, and deletes without mutating the persisted ring', () => {
    expect(editBoundary(points, { type: 'move', index: 1, point: [39, 129] })[1]).toEqual([39, 129]);
    const added = editBoundary(points, { type: 'insert', index: 2 }); expect(added[3]).toEqual([37.5, 127.5]);
    expect(editBoundary(added, { type: 'delete', index: 3 })).toEqual(points);
    expect(editBoundary(points, { type: 'delete', index: 0 })).toEqual(points); expect(points[1]).toEqual([38, 127]);
  });
  it('uses the server rejudge count including zero', () => { expect(rejudgeMessage({ rejudge: { changedStores: 0 } })).toBe('가게 0곳 판정이 바뀌었습니다'); });
});
