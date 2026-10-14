import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { Coordinate, Detail, StoreRow } from '@/api/markets';
import { Button } from '@/components/ui/button';
import { parsePolygon, polygonEdit, projection, shouldShowStoreLabel } from './editorState';
import type { PolygonState } from './editorState';
export function EditorMap({ detail, polygon, setPolygon, onCoordinate, onMove, draft, disabled, selectedStoreId, onSelect }: { detail: Detail; polygon: PolygonState; setPolygon: (state: PolygonState) => void; onCoordinate: (coordinate: Coordinate) => void; onMove: (row: StoreRow, coordinate: Coordinate) => void; draft: Coordinate | null; disabled: boolean; selectedStoreId: number | null; onSelect: (row: StoreRow) => void }) {
  const [drawing, setDrawing] = useState(false);
  const [drag, setDrag] = useState<{ row: StoreRow; coordinate: Coordinate } | null>(null);
  const [hoveredStoreId, setHoveredStoreId] = useState<number | null>(null);
  const dragStart = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const showPolygons = detail.market.marketType !== 'BUILDING';
  const pins = detail.stores.flatMap(row => {
    const reference = row.source.referenceStoreId == null ? null : detail.stores.find(r => r.source.id === row.source.referenceStoreId);
    const coordinate = row.display.pinKind === 'REFERENCE' ? reference?.display.membership.status === 'IN' ? reference.display.coordinate : null : row.display.coordinate;
    return coordinate && row.display.membership.status !== 'UNKNOWN' ? [{ row, coordinate }] : [];
  });
  // Draft/drag vertices deliberately do not alter the fitted transform mid-edit.
  const map = projection([...pins.map(p => p.coordinate), ...detail.zones.flatMap(z => parsePolygon(z.polygonWkt))], detail.market);
  const coordinateAt = (event: PointerEvent<SVGElement>) => {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return map.toCoordinate(point.x, point.y);
  };
  const points = (coordinates: Coordinate[]) => coordinates.map(p => { const point = map.toPoint(p); return `${point.x},${point.y}`; }).join(' ');
  return <section className="space-y-3"><h2 className="text-lg font-semibold">가게 지도 편집</h2><p>지도 클릭: 정확 핀 추가 / 위치 지정. 가게 핀 드래그: 이동 후 이유 입력. ↑ 북쪽 · 참고 핀은 점선 링. 배경 지도 없이 상대 위치를 표시합니다.</p>
    {showPolygons && <div className="flex gap-2"><Button variant="outline" onClick={() => { setDrawing(true); setPolygon({ vertices: [], closed: false }); }}>폴리곤 그리기</Button><Button variant="outline" disabled={!drawing || polygon.vertices.length < 3 || polygon.closed} onClick={() => { setPolygon(polygonEdit(polygon, { type: 'close' })); setDrawing(false); }}>폴리곤 닫기</Button><Button variant="outline" onClick={() => { setPolygon(polygonEdit(polygon, { type: 'cancel' })); setDrawing(false); }}>그리기 취소</Button><span>{polygon.vertices.length} 꼭짓점</span></div>}
    <svg ref={svg} viewBox="0 0 600 432" aria-label="시장 편집 지도" className="w-full max-w-3xl border" style={{ background: 'var(--ko-surface-1)', touchAction: 'none' }} onPointerDown={event => { if (disabled || event.target !== event.currentTarget) return; const coordinate = coordinateAt(event); if (coordinate) { if (drawing) setPolygon(polygonEdit(polygon, { type: 'add', coordinate })); else onCoordinate(coordinate); } }} onPointerMove={event => { if (drag && !disabled && dragStart.current) { if (Math.hypot(event.clientX - dragStart.current.x, event.clientY - dragStart.current.y) >= 4) dragStart.current.moved = true; const coordinate = coordinateAt(event); if (coordinate && dragStart.current.moved) setDrag({ ...drag, coordinate }); } }} onPointerUp={event => { if (drag && !disabled) { const coordinate = coordinateAt(event); if (coordinate && dragStart.current?.moved) onMove(drag.row, coordinate); setDrag(null); dragStart.current = null; } }} onPointerCancel={() => { setDrag(null); dragStart.current = null; }}>
      {showPolygons && detail.zones.map(zone => <polygon key={zone.id} points={points(parsePolygon(zone.polygonWkt))} fill="none" stroke="var(--ko-border-strong)" style={{ pointerEvents: 'none' }} />)}
      {showPolygons && <polyline points={points([...polygon.vertices, ...(polygon.closed ? polygon.vertices.slice(0, 1) : [])])} fill="none" stroke="var(--ko-primary)" strokeWidth="2" style={{ pointerEvents: 'none' }} />}
      {pins.map(({ row, coordinate }) => {
        const id = row.source.id;
        const p = map.toPoint(drag?.row.source.id === id ? drag.coordinate : coordinate);
        const showLabel = shouldShowStoreLabel({ storeId: id, selectedStoreId, hoveredStoreId, draggedStoreId: drag?.row.source.id ?? null, drawing });
        return <g key={id} style={{ pointerEvents: drawing ? 'none' : undefined }}>
          <title>{row.display.name}</title>
          <circle cx={p.x} cy={p.y} r="22" fill="transparent" role="button" tabIndex={disabled || drawing ? -1 : 0} aria-label={`${row.display.name} 핀`} aria-disabled={disabled || drawing}
            onPointerEnter={() => setHoveredStoreId(id)} onPointerLeave={() => setHoveredStoreId(null)} onFocus={() => setHoveredStoreId(id)} onBlur={() => setHoveredStoreId(null)}
            onKeyDown={event => { if (!disabled && !drawing && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSelect(row); } }}
            onPointerDown={event => { event.stopPropagation(); if (disabled || drawing) return; onSelect(row); if (row.display.pinKind === 'EXACT') { event.currentTarget.setPointerCapture(event.pointerId); dragStart.current = { x: event.clientX, y: event.clientY, moved: false }; setDrag({ row, coordinate }); } }} />
          <circle cx={p.x} cy={p.y} r="10" fill="var(--ko-surface-2)" stroke="var(--ko-primary)" strokeWidth="2" strokeDasharray={row.display.pinKind === 'REFERENCE' ? '3 3' : undefined} style={{ pointerEvents: 'none' }} />
          {showLabel && <text x={p.x + 14} y={p.y + 4} fill="var(--ko-text-primary)" fontSize="12" style={{ pointerEvents: 'none' }}>{row.display.name}</text>}
        </g>;
      })}
      {draft && <circle cx={map.toPoint(draft).x} cy={map.toPoint(draft).y} r="10" fill="none" stroke="var(--ko-primary)" strokeWidth="2" style={{ pointerEvents: 'none' }} />}
    </svg>
    {!pins.length && <p>좌표가 있는 가게가 없습니다. 시장 중심을 기준으로 위치를 입력할 수 있습니다.</p>}
  </section>;
}
