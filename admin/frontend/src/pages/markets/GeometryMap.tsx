import { useMemo, useRef } from 'react';
import type { PointerEvent } from 'react';
import type { Geometry, LatLng } from '@/api/marketGeometry';
import { projection } from './editorState';
import { editBoundary } from './geometryState';
export function GeometryMap({ data, boundary, setBoundary, line, onPoint, center, setCenter, disabled, selectVertex, entrance }: { data: Geometry; boundary: LatLng[]; setBoundary: (points: LatLng[]) => void; line: LatLng[]; onPoint: (point: LatLng) => void; center: LatLng; setCenter: (point: LatLng) => void; disabled: boolean; selectVertex: (index: number) => void; entrance: LatLng | null }) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<number | 'center' | null>(null);
  const original = useRef<{ boundary: LatLng[]; center: LatLng } | null>(null);
  // Fit persisted geometry only: dragging and drawing must never move the viewport.
  const map = useMemo(() => {
    const coordinates = [...(data.boundary?.polygon ?? []), ...data.entrances.map(e => [e.lat, e.lng] as LatLng), ...data.paths.flatMap(p => p.geometry), ...data.background.roads.flatMap(r => r.geometry), [data.geo.centerLat, data.geo.centerLng] as LatLng].map(([latitude, longitude]) => ({ latitude, longitude }));
    return projection(coordinates, { id: 0, name: '', marketType: 'STREET', latitude: data.geo.centerLat, longitude: data.geo.centerLng });
  }, [data]);
  const point = ([latitude, longitude]: LatLng) => map.toPoint({ latitude, longitude });
  const points = (line: LatLng[]) => line.map(p => { const xy = point(p); return `${xy.x},${xy.y}`; }).join(' ');
  const at = (event: PointerEvent<SVGElement>): LatLng | null => {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return null;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const coordinate = map.toCoordinate(p.x, p.y);
    return [coordinate.latitude, coordinate.longitude];
  };
  const begin = (event: PointerEvent<SVGCircleElement>, target: number | 'center') => {
    event.stopPropagation(); if (disabled) return;
    original.current = { boundary, center }; drag.current = target;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (typeof target === 'number') selectVertex(target);
  };
  return <div className="space-y-2"><p>↑ 북쪽 · 꼭짓점과 중심 핀을 끌어 이동합니다. 작은 중간점을 누르면 꼭짓점이 추가됩니다.</p>
    <svg ref={svg} viewBox="0 0 600 432" aria-label="골목 구조 편집 지도" className="w-full max-w-3xl border" style={{ background: 'var(--ko-surface-1)', touchAction: 'none' }}
      onPointerDown={e => { if (!disabled && e.target === e.currentTarget) { const p = at(e); if (p) onPoint(p); } }}
      onPointerMove={e => { if (disabled || drag.current == null) return; const p = at(e); if (!p) return; if (drag.current === 'center') setCenter(p); else setBoundary(editBoundary(boundary, { type: 'move', index: drag.current, point: p })); }}
      onPointerUp={() => { drag.current = null; original.current = null; }} onPointerCancel={() => { if (original.current) { setBoundary(original.current.boundary); setCenter(original.current.center); } drag.current = null; original.current = null; }}>
      <g pointerEvents="none">{data.background.roads.map((r, i) => <g key={i}><polyline points={points(r.geometry)} fill="none" stroke="var(--ko-border-strong)" strokeWidth="5" /><title>{r.name ?? r.highway}</title></g>)}
        {data.paths.map(p => <g key={p.id}><polyline points={points(p.geometry)} fill="none" stroke="var(--ko-accent-secondary)" strokeWidth="3" />{p.geometry[0] && <text x={point(p.geometry[0]).x + 8} y={point(p.geometry[0]).y} fill="var(--ko-text-primary)" fontSize="12">{p.name ?? `골목 ${p.id}`}</text>}</g>)}
        <polygon points={points(boundary)} fill="none" stroke="var(--ko-accent-primary)" strokeWidth="2" />
        <polyline points={points(line)} fill="none" stroke="var(--ko-status-warning)" strokeWidth="3" strokeDasharray="4 3" />
        {data.entrances.map(e => <g key={e.id}><rect x={point([e.lat, e.lng]).x - 5} y={point([e.lat, e.lng]).y - 5} width="10" height="10" fill="var(--ko-accent-secondary)" /><title>{e.label ?? `출입구 ${e.id}`}</title></g>)}
        {entrance && <circle cx={point(entrance).x} cy={point(entrance).y} r="9" fill="none" stroke="var(--ko-status-warning)" strokeWidth="3"><title>새 출입구 위치</title></circle>}
      </g>
      {boundary.map((p, i) => { const xy = point(p), next = point(boundary[(i + 1) % boundary.length]); return <g key={i}>
        <circle cx={(xy.x + next.x) / 2} cy={(xy.y + next.y) / 2} r="7" fill="var(--ko-surface-2)" stroke="var(--ko-accent-primary)" role="button" tabIndex={disabled ? -1 : 0} aria-label={`꼭짓점 ${i + 1} 뒤 추가`} aria-disabled={disabled} onPointerDown={e => { e.stopPropagation(); if (!disabled) setBoundary(editBoundary(boundary, { type: 'insert', index: i })); }} onKeyDown={e => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setBoundary(editBoundary(boundary, { type: 'insert', index: i })); } }} />
        <circle cx={xy.x} cy={xy.y} r="10" fill="var(--ko-accent-primary)" role="button" tabIndex={disabled ? -1 : 0} aria-label={`경계 꼭짓점 ${i + 1}`} aria-disabled={disabled} onPointerDown={e => begin(e, i)} onKeyDown={e => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selectVertex(i); } }} />
      </g>; })}
      <circle cx={point(center).x} cy={point(center).y} r="13" fill="var(--ko-surface-2)" stroke="var(--ko-status-warning)" strokeWidth="3" aria-label="시장 중심 핀" role="img" onPointerDown={e => begin(e, 'center')} />
    </svg>
    <p className="text-xs" style={{ color: 'var(--ko-text-secondary)' }}>© OpenStreetMap contributors{data.attribution.filter(a => a !== '© OpenStreetMap contributors').map(a => ` · ${a}`)}</p>
  </div>;
}
