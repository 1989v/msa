import axios from 'axios';
import type { Coordinate, Market, StoreRow, OverrideField, OverridePayload } from '@/api/markets';
export function overrideRequest(values: OverridePayload['values'], clear: OverrideField[], reason: string): OverridePayload {
  if (!reason.trim()) throw new Error('수정 이유를 입력해 주세요.');
  return { values, clear, reason: reason.trim() };
}
export type PolygonState = { vertices: Coordinate[]; closed: boolean };
export function polygonEdit(state: PolygonState, action: { type: 'add'; coordinate: Coordinate } | { type: 'close' } | { type: 'cancel' }): PolygonState {
  if (action.type === 'cancel') return { vertices: [], closed: false };
  if (action.type === 'close') return state.vertices.length >= 3 ? { ...state, closed: true } : state;
  return state.closed ? state : { vertices: [...state.vertices, action.coordinate], closed: false };
}
export function polygonWkt(state: PolygonState): string | null {
  if (!state.closed) return null;
  return `POLYGON((${[...state.vertices, state.vertices[0]].map(p => `${p.longitude} ${p.latitude}`).join(',')}))`;
}
export function parsePolygon(wkt: string | null): Coordinate[] {
  const ring = wkt?.match(/^POLYGON\s*\(\(\s*([^()]+)\)/i)?.[1];
  return ring ? ring.split(',').map(p => { const [longitude, latitude] = p.trim().split(/\s+/).map(Number); return { longitude, latitude }; }).filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)) : [];
}
export function projection(coordinates: Coordinate[], market: Market) {
  const latitude = coordinates.length ? coordinates.reduce((sum, p) => sum + p.latitude, 0) / coordinates.length : market.latitude ?? 37.5665;
  const longitude = coordinates[0]?.longitude ?? market.longitude ?? 126.978;
  const metres = Math.PI * 6_371_008.8 / 180;
  const east = metres * Math.max(1e-9, Math.cos(latitude * Math.PI / 180));
  const raw = coordinates.map(p => ({ x: (p.longitude - longitude) * east, y: -(p.latitude - latitude) * metres }));
  const minX = raw.length ? Math.min(...raw.map(p => p.x)) : -272;
  const maxX = raw.length ? Math.max(...raw.map(p => p.x)) : 272;
  const minY = raw.length ? Math.min(...raw.map(p => p.y)) : -168;
  const maxY = raw.length ? Math.max(...raw.map(p => p.y)) : 168;
  const width = maxX - minX, height = maxY - minY;
  const scale = width === 0 && height === 0 ? 1 : Math.min(width === 0 ? Infinity : 544 / width, height === 0 ? Infinity : 336 / height);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  return {
    toPoint: (p: Coordinate) => ({ x: 300 + ((p.longitude - longitude) * east - cx) * scale, y: 216 + (-(p.latitude - latitude) * metres - cy) * scale }),
    toCoordinate: (x: number, y: number): Coordinate => ({ longitude: longitude + ((x - 300) / scale + cx) / east, latitude: latitude - ((y - 216) / scale + cy) / metres }),
  };
}
export function eligibleReferences(rows: StoreRow[], editedId: number | null) { return rows.filter(row => row.source.id !== editedId && row.display.pinKind === 'EXACT' && row.display.membership.status === 'IN' && row.display.coordinate != null); }
export function revertConfirmation(current: number | null, action: { type: 'ask'; id: number } | { type: 'cancel' | 'complete' }) { return action.type === 'ask' ? action.id : current == null ? current : null; }
export function editError(error: unknown) { return axios.isAxiosError(error) && error.response?.status === 409 ? '이후 변경과 충돌하여 되돌릴 수 없습니다. 최신 이력을 다시 확인해 주세요.' : axios.isAxiosError(error) ? error.response?.data?.error?.message ?? '저장하지 못했습니다. 입력과 연결을 확인해 주세요.' : error instanceof Error ? error.message : '불러오지 못했습니다. 다시 시도해 주세요.'; }
export function historyTime(value: string) { return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}+09:00`)); }
export function changeSummary(raw: string | null) { if (!raw) return '없음'; try { const parsed = JSON.parse(raw); return JSON.stringify(parsed); } catch { return raw; } }

export function compactChange(raw: string | null): string {
  if (!raw) return '없음';
  try { const value = JSON.parse(raw); const row = value.store ?? value.zone ?? value; const labels: Record<string, string> = { name: '이름', items: '품목', zoneId: '구역', membership: '소속', latitude: '위도', longitude: '경도', buildingName: '건물', dong: '동', floor: '층', sortOrder: '순서' }; const summary = Object.entries(labels).filter(([key]) => key in row).map(([key, label]) => `${label}: ${typeof row[key] === 'object' && row[key] ? row[key].status ?? JSON.stringify(row[key]) : row[key] ?? '비움'}`).join(' · '); return (summary || JSON.stringify(value)).slice(0, 240); } catch { return raw.slice(0, 240); }
}

export function shouldShowStoreLabel({ storeId, selectedStoreId, hoveredStoreId, draggedStoreId, drawing }: { storeId: number; selectedStoreId: number | null; hoveredStoreId: number | null; draggedStoreId: number | null; drawing: boolean }): boolean {
  return !drawing && (storeId === selectedStoreId || storeId === hoveredStoreId || storeId === draggedStoreId);
}
