import type { LatLng } from '@/api/marketGeometry';
export function editBoundary(polygon: LatLng[], action: { type: 'move'; index: number; point: LatLng } | { type: 'insert'; index: number } | { type: 'delete'; index: number }): LatLng[] {
  if (action.type === 'move') return polygon.map((p, i) => i === action.index ? action.point : p);
  if (action.type === 'delete') return polygon.length > 3 ? polygon.filter((_, i) => i !== action.index) : polygon;
  const a = polygon[action.index], b = polygon[(action.index + 1) % polygon.length];
  if (!a || !b) return polygon;
  return [...polygon.slice(0, action.index + 1), [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as LatLng, ...polygon.slice(action.index + 1)];
}
export const rejudgeMessage = (result: { rejudge?: { changedStores: number } }) => result.rejudge ? `가게 ${result.rejudge.changedStores}곳 판정이 바뀌었습니다` : '저장했습니다.';
