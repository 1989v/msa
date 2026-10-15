import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as api from '../../api/marketStewardApi';
import { stewardError } from './stewardState';

const KINDS: Record<api.GeometryKind, string> = { BOUNDARY: '시장 경계', PATH: '골목 선', ENTRANCE: '출입구', NOTE: '위치 메모' };
const STATUS = { PENDING: '검토 대기', APPROVED: '승인 · 편집 반영 대기', REJECTED: '반려' };
/** Local metre projection, like the public market canvas; inverse projection records [lat, lng]. */
export function requestProjection(coordinates: { latitude: number; longitude: number }[]) {
  if (!coordinates.length) return null;
  const lat = coordinates.reduce((sum, p) => sum + p.latitude, 0) / coordinates.length;
  const lng = coordinates.reduce((sum, p) => sum + p.longitude, 0) / coordinates.length;
  const north = Math.PI * 6371008.8 / 180, east = north * Math.max(0.001, Math.cos(lat * Math.PI / 180));
  const width = Math.max(300, ...coordinates.map(p => Math.abs((p.longitude - lng) * east) * 2.4));
  const height = Math.max(200, ...coordinates.map(p => Math.abs((p.latitude - lat) * north) * 2.4));
  const scale = Math.min(540 / width, 340 / height);
  return { point: ([latitude, longitude]: [number, number]) => [300 + (longitude - lng) * east * scale, 200 - (latitude - lat) * north * scale],
    coordinate: (x: number, y: number): [number, number] => [lat + (200 - y) / north / scale, lng + (x - 300) / east / scale] };
}
export default function MarketGeometryRequests({ detail }: { detail: api.MarketEditorDetail }) {
  const [kind, setKind] = useState<api.GeometryKind>('BOUNDARY'); const [points, setPoints] = useState<[number, number][]>([]);
  const [description, setDescription] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [blocked, setBlocked] = useState(false);
  const coordinates = useMemo(() => detail.stores.flatMap(s => s.display.coordinate ? [s.display.coordinate] : []), [detail]);
  const projection = useMemo(() => requestProjection(coordinates), [coordinates]);
  const requests = useQuery({ queryKey: ['market-geometry-requests', detail.market.id], queryFn: () => api.listGeometryRequests(detail.market.id), retry: false, staleTime: 0, gcTime: 0 });
  const validPoints = !points.length || (kind === 'BOUNDARY' ? points.length >= 3 : kind === 'PATH' ? points.length >= 2 : points.length === 1);
  const add = (point: [number, number]) => { if (busy || blocked) return; setPoints(p => kind === 'ENTRANCE' || kind === 'NOTE' ? [point] : p.length < 2000 ? [...p, point] : p); };
  const [lat, setLat] = useState(''); const [lng, setLng] = useState('');
  return <section className="market-steward market-geometry-requests" aria-label="골목 구조 변경 요청"><h2>골목 구조 변경 요청</h2><p>그림과 설명을 운영자에게 보냅니다. 승인 뒤에도 운영자가 편집기로 저장해야 지도에 반영됩니다.</p>
    <fieldset disabled={busy || blocked}><legend>변경 요청 작성</legend><label>요청 종류<select value={kind} onChange={e => { setKind(e.target.value as api.GeometryKind); setPoints([]); }}>{Object.entries(KINDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    {projection ? <><p>북쪽이 위입니다. 가게 점을 참고해 지도를 누르면 꼭짓점을 추가합니다. 출입구·메모는 한 점만 남습니다.</p><svg className="market-request-canvas" viewBox="0 0 600 400" role="img" aria-label="변경 요청 지도" onClick={e => { const box = e.currentTarget.getBoundingClientRect(); if (box.width && box.height) add(projection.coordinate((e.clientX - box.left) / box.width * 600, (e.clientY - box.top) / box.height * 400)); }}>
      {coordinates.map((p, i) => { const [x, y] = projection.point([p.latitude, p.longitude]); return <circle key={i} cx={x} cy={y} r="4" fill="currentColor"><title>기존 가게</title></circle>; })}
      {kind === 'BOUNDARY' ? <polygon points={points.map(p => projection.point(p).join(',')).join(' ')} fill="none" stroke="var(--ko-accent-primary)" strokeWidth="3" /> : <polyline points={points.map(p => projection.point(p).join(',')).join(' ')} fill="none" stroke="var(--ko-accent-primary)" strokeWidth="3" />}
      {points.map((p, i) => { const [x, y] = projection.point(p); return <circle key={i} cx={x} cy={y} r="7" fill="var(--ko-accent-primary)"><title>요청 지점 {i + 1}</title></circle>; })}
    </svg></> : <p>가게 좌표가 없어 지도를 표시할 수 없습니다. 좌표를 입력하거나 설명만 보내세요.</p>}
    <div className="market-request-coordinate"><label>요청 지점 위도<input type="number" min="-90" max="90" step="any" value={lat} onChange={e => setLat(e.target.value)} /></label><label>요청 지점 경도<input type="number" min="-180" max="180" step="any" value={lng} onChange={e => setLng(e.target.value)} /></label><button type="button" disabled={!lat || !lng || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng)) || Math.abs(Number(lat)) > 90 || Math.abs(Number(lng)) > 180} onClick={() => add([Number(lat), Number(lng)])}>좌표로 지점 추가</button></div>
    <ol aria-label="요청 지점 목록">{points.map((p, i) => <li key={i}>{i + 1}. {p.map(n => n.toFixed(6)).join(', ')}</li>)}</ol><button type="button" disabled={!points.length} onClick={() => setPoints(p => p.slice(0, -1))}>마지막 지점 취소</button><button type="button" disabled={!points.length} onClick={() => setPoints([])}>그림 지우기</button>
    <form onSubmit={async e => { e.preventDefault(); if (!description.trim() || !validPoints || busy || blocked) return; setBusy(true); setMessage(''); try { const result = await api.submitGeometryRequest(detail.market.id, { kind, geometry: points.length ? points : null, description: description.trim() }); setDescription(''); setPoints([]); setMessage(`요청 #${result.id}을 보냈습니다.`); await requests.refetch(); } catch (error) { const text = stewardError(error); setMessage(text); if (text === '이 시장 관리 권한이 없습니다.') setBlocked(true); } finally { setBusy(false); } }}><label>변경 설명 (필수)<textarea required maxLength={5000} value={description} onChange={e => setDescription(e.target.value)} /></label>{!validPoints && <p>경계는 3개, 골목은 2개 이상의 지점이 필요합니다.</p>}<button type="submit" disabled={!description.trim() || !validPoints}>변경 요청 보내기</button></form></fieldset>
    {message && <p role="status">{message}</p>}<h3>이 시장의 요청</h3>{requests.isPending && <p role="status">요청을 불러오는 중…</p>}{requests.isError && <><p role="alert">{stewardError(requests.error)}</p><button onClick={() => void requests.refetch()}>요청 다시 불러오기</button></>}
    <ul>{requests.data?.map(row => <li key={row.id}><strong>#{row.id} · {KINDS[row.kind]} · {STATUS[row.status]}</strong><p>{row.description}</p>{row.decisionReason && <p>운영자 사유: {row.decisionReason}</p>}</li>)}</ul>{requests.data?.length === 0 && <p>보낸 변경 요청이 없습니다.</p>}
  </section>;
}
