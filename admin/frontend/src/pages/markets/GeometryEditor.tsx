import { useEffect, useState } from 'react';
import * as api from '@/api/marketGeometry';
import type { Geometry, LatLng, ReviewStore, RoadRule } from '@/api/marketGeometry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GeometryMap } from './GeometryMap';
import { editError } from './editorState';
import { editBoundary, rejudgeMessage } from './geometryState';
const emptyRule = { roadName: '', buildingNoFrom: null, buildingNoTo: null, membership: 'IN' as const };
export function GeometryEditor({ marketId, onChanged }: { marketId: number; onChanged: () => void }) {
  const [data, setData] = useState<Geometry | null>(null);
  const [review, setReview] = useState<ReviewStore[]>([]);
  const [assignments, setAssignments] = useState<Record<number, number | null>>({});
  const [boundary, setBoundary] = useState<LatLng[]>([]);
  const [vertex, setVertex] = useState<number | null>(null);
  const [center, setCenter] = useState<LatLng>([0, 0]);
  const [radius, setRadius] = useState('');
  const [reason, setReason] = useState('');
  const [mode, setMode] = useState<'idle' | 'path' | 'entrance' | 'boundary'>('idle');
  const [line, setLine] = useState<LatLng[]>([]);
  const [pathId, setPathId] = useState<number | null>(null);
  const [pathName, setPathName] = useState('');
  const [entrance, setEntrance] = useState<LatLng | null>(null);
  const [entranceLabel, setEntranceLabel] = useState('');
  const [entrancePath, setEntrancePath] = useState<number | null>(null);
  const [rule, setRule] = useState<Omit<RoadRule, 'id' | 'reason'>>(emptyRule);
  const [ruleId, setRuleId] = useState<number | null>(null);
  const [deletion, setDeletion] = useState<{ kind: 'paths' | 'entrances' | 'road-rules'; id: number } | null>(null);
  const [deleteVertex, setDeleteVertex] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true; setLoadError('');
    Promise.all([api.getGeometry(marketId), api.getNeedsReview(marketId)]).then(([geometry, stores]) => {
      if (!active) return;
      setData(geometry); setReview(stores); setAssignments(Object.fromEntries(stores.map(s => [s.storeId, s.suggestedPathId ?? s.pathId])));
      // The contract permits a repeated closing point; edit an open ring internally.
      const polygon = geometry.boundary?.polygon ?? [];
      setBoundary(polygon.length > 1 && polygon[0][0] === polygon.at(-1)![0] && polygon[0][1] === polygon.at(-1)![1] ? polygon.slice(0, -1) : polygon);
      setCenter([geometry.geo.centerLat, geometry.geo.centerLng]); setRadius(String(geometry.geo.radiusM)); setVertex(null); setDeleteVertex(false);
    }).catch(error => { if (active) setLoadError(editError(error)); });
    return () => { active = false; };
  }, [marketId, revision]);
  const allowed = !busy && !!reason.trim();
  const mutate = async (action: () => Promise<object>, complete?: () => void) => {
    if (!allowed) return;
    setBusy(true); setMessage('');
    try { const result = await action(); setMessage(rejudgeMessage(result)); complete?.(); setRevision(v => v + 1); onChanged(); }
    catch (error) { setMessage(editError(error)); }
    finally { setBusy(false); }
  };
  const cancelDraw = () => { setMode('idle'); setLine([]); setPathId(null); setPathName(''); setEntrance(null); };
  const geoValid = center.every(Number.isFinite) && Math.abs(center[0]) <= 90 && Math.abs(center[1]) <= 180 && radius.trim() !== '' && Number.isFinite(Number(radius)) && Number(radius) > 0;
  const geoPayload = { centerLat: center[0], centerLng: center[1], radiusM: Number(radius), reason: reason.trim() };
  const ruleValid = rule.roadName.trim() && [rule.buildingNoFrom, rule.buildingNoTo].every(n => n == null || Number.isInteger(n) && n >= 0) && (rule.buildingNoFrom == null || rule.buildingNoTo == null || rule.buildingNoFrom <= rule.buildingNoTo);
  if (!data) return <section aria-label="골목 구조"><p role={loadError ? 'alert' : 'status'}>{loadError || '골목 구조를 불러오는 중…'}</p>{loadError && <Button variant="outline" onClick={() => setRevision(v => v + 1)}>다시 불러오기</Button>}</section>;
  return <section aria-label="골목 구조" className="space-y-6 min-w-0">
    <h2 className="text-lg font-semibold">골목 구조</h2>
    <label className="block">구조 수정 이유 (필수)<Input value={reason} disabled={busy} onChange={e => setReason(e.target.value)} /></label>
    <p>저장·삭제·초안 복원에는 이유가 필요합니다. 지도 편집 후 해당 항목을 저장하세요.</p>
    {message && <p role="status">{message}</p>}{loadError && <p role="alert">{loadError}<Button variant="outline" onClick={() => setRevision(v => v + 1)}>다시 불러오기</Button></p>}
    <fieldset disabled={busy} className="space-y-6 min-w-0">
      <GeometryMap entrance={entrance} data={data} boundary={boundary} setBoundary={setBoundary} line={line} center={center.every(Number.isFinite) ? center : [data.geo.centerLat, data.geo.centerLng]} setCenter={setCenter} disabled={busy} selectVertex={i => { setVertex(i); setDeleteVertex(false); }} onPoint={p => { if (mode === 'path' || mode === 'boundary') setLine(points => [...points, p]); if (mode === 'entrance') setEntrance(p); }} />
      <section aria-label="경계 편집" className="space-y-2"><h3>시장 경계 · {data.boundary?.source ?? '없음'}</h3>
        <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!allowed || boundary.length < 3} onClick={() => mutate(() => api.saveBoundary(marketId, boundary, reason.trim()))}>경계 저장</Button>
          <Button variant="outline" onClick={() => { cancelDraw(); setMode('boundary'); }}>새 경계 그리기</Button>
          {(['OSM', 'DERIVED'] as const).map(to => <Button key={to} variant="outline" disabled={!allowed} onClick={() => mutate(() => api.resetBoundary(marketId, to, reason.trim()))}>{to === 'OSM' ? 'OSM 초안으로' : '가게 둘레 초안으로'}</Button>)}
        </div>
        {vertex != null && vertex < boundary.length && <div>선택 꼭짓점 {vertex + 1}<Button variant="outline" disabled={boundary.length <= 3} onClick={() => setDeleteVertex(true)}>꼭짓점 삭제</Button>{deleteVertex && <span role="alert">이 꼭짓점을 삭제할까요?<Button variant="outline" onClick={() => { setBoundary(editBoundary(boundary, { type: 'delete', index: vertex })); setVertex(null); setDeleteVertex(false); }}>꼭짓점 삭제 확인</Button><Button variant="outline" onClick={() => setDeleteVertex(false)}>취소</Button></span>}</div>}
      </section>
      <section aria-label="골목 선 편집" className="space-y-2"><h3>골목 선</h3><Button variant="outline" onClick={() => { cancelDraw(); setMode('path'); }}>골목 선 그리기</Button>
        {mode === 'boundary' && <div>지도에 경계점을 클릭하세요. {line.length}개<Button variant="outline" disabled={line.length < 3} onClick={() => { setBoundary(line); setLine([]); setMode('idle'); }}>경계 그리기 완료</Button><Button variant="outline" onClick={cancelDraw}>그리기 취소</Button></div>}
        {mode === 'path' && <div className="space-y-2"><p>지도에 골목 점을 클릭하세요. {line.length}개</p><label>골목 이름<Input value={pathName} onChange={e => setPathName(e.target.value)} /></label><Button disabled={!allowed || line.length < 2} variant="outline" onClick={() => mutate(() => api.savePath(marketId, pathId, { name: pathName.trim() || null, geometry: line, reason: reason.trim() }), cancelDraw)}>골목 저장 · 그리기 완료</Button><Button variant="outline" onClick={cancelDraw}>그리기 취소</Button><Button variant="outline" disabled={!line.length} onClick={() => setLine(p => p.slice(0, -1))}>마지막 점 취소</Button></div>}
        <ul>{data.paths.map(p => <li key={p.id}>{p.name ?? '이름 없는 골목'} · {p.source}<Button variant="outline" onClick={() => { cancelDraw(); setMode('path'); setPathId(p.id); setPathName(p.name ?? ''); setLine(p.geometry); }}>골목 편집 {p.id}</Button><Button variant="outline" disabled={!allowed} onClick={() => setDeletion({ kind: 'paths', id: p.id })}>골목 삭제 {p.id}</Button></li>)}</ul>
      </section>
      <section aria-label="출입구 편집" className="space-y-2"><h3>출입구</h3><Button variant="outline" onClick={() => { cancelDraw(); setMode('entrance'); }}>출입구 찍기</Button>
        {mode === 'entrance' && <div><p>{entrance ? `선택: ${entrance.join(', ')}` : '지도에서 출입구 위치를 클릭하세요.'}</p><label>출입구 이름<Input value={entranceLabel} onChange={e => setEntranceLabel(e.target.value)} /></label><label>출입구 골목<select value={entrancePath ?? ''} onChange={e => setEntrancePath(e.target.value ? Number(e.target.value) : null)}><option value="">미배정</option>{data.paths.map(p => <option key={p.id} value={p.id}>{p.name ?? `골목 ${p.id}`}</option>)}</select></label><Button variant="outline" disabled={!allowed || !entrance} onClick={() => entrance && mutate(() => api.saveEntrance(marketId, null, { lat: entrance[0], lng: entrance[1], pathId: entrancePath, label: entranceLabel.trim() || null, reason: reason.trim() }), cancelDraw)}>출입구 저장</Button><Button variant="outline" onClick={cancelDraw}>출입구 취소</Button></div>}
        <ul>{data.entrances.map(e => <li key={e.id}>{e.label ?? `출입구 ${e.id}`}<Button variant="outline" disabled={!allowed} onClick={() => setDeletion({ kind: 'entrances', id: e.id })}>출입구 삭제 {e.id}</Button></li>)}</ul>
      </section>
      <section aria-label="도로 규칙" className="space-y-2 min-w-0"><h3>도로 규칙 · 경계가 없을 때 적용</h3><div className="overflow-x-auto"><table className="w-full text-left"><thead><tr>{['도로명', '건물번호 시작', '끝', 'IN/OUT', '이유', '편집'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{data.roadRules.map(r => <tr key={r.id}><td>{r.roadName}</td><td>{r.buildingNoFrom ?? '전체'}</td><td>{r.buildingNoTo ?? '전체'}</td><td>{r.membership}</td><td>{r.reason}</td><td><Button variant="outline" onClick={() => { setRuleId(r.id); setRule(r); }}>규칙 편집 {r.id}</Button><Button variant="outline" disabled={!allowed} onClick={() => setDeletion({ kind: 'road-rules', id: r.id })}>규칙 삭제 {r.id}</Button></td></tr>)}</tbody></table></div>
        <div className="grid gap-2 sm:grid-cols-2"><label>도로명<Input value={rule.roadName} onChange={e => setRule({ ...rule, roadName: e.target.value })} /></label><label>도로 소속<select value={rule.membership} onChange={e => setRule({ ...rule, membership: e.target.value as 'IN' | 'OUT' })}><option>IN</option><option>OUT</option></select></label>{(['buildingNoFrom', 'buildingNoTo'] as const).map((key, i) => <label key={key}>{i ? '건물번호 끝 (선택)' : '건물번호 시작 (선택)'}<Input type="number" min="0" step="1" value={rule[key] ?? ''} onChange={e => setRule({ ...rule, [key]: e.target.value === '' ? null : Number(e.target.value) })} /></label>)}</div>
        <Button variant="outline" disabled={!allowed || !ruleValid} onClick={() => mutate(() => api.saveRoadRule(marketId, ruleId, { roadName: rule.roadName.trim(), buildingNoFrom: rule.buildingNoFrom, buildingNoTo: rule.buildingNoTo, membership: rule.membership, reason: reason.trim() }), () => { setRule(emptyRule); setRuleId(null); })}>도로 규칙 저장</Button><Button variant="outline" onClick={() => { setRule(emptyRule); setRuleId(null); }}>규칙 편집 취소</Button>
      </section>
      <section aria-label="중심과 반경" className="space-y-2"><h3>시장 중심 · 반경</h3><p>중심 {data.geo.centerOverridden ? '수동 보정' : '원천값'} · 반경 {data.geo.radiusOverridden ? '수동 보정' : '원천값'}</p><div className="grid gap-2 sm:grid-cols-3">{(['중심 위도', '중심 경도'] as const).map((label, i) => <label key={label}>{label}<Input type="number" step="any" value={Number.isFinite(center[i]) ? center[i] : ''} onChange={e => setCenter(i === 0 ? [e.target.value === '' ? NaN : Number(e.target.value), center[1]] : [center[0], e.target.value === '' ? NaN : Number(e.target.value)])} /></label>)}<label>반경 (m)<Input type="number" min="1" value={radius} onChange={e => setRadius(e.target.value)} /></label></div>
        <Button variant="outline" disabled={!allowed || !geoValid} onClick={() => mutate(() => api.saveGeo(marketId, geoPayload))}>중심·반경 저장</Button><Button variant="outline" disabled={!allowed} onClick={() => mutate(() => api.saveGeo(marketId, { centerLat: null, centerLng: null, radiusM: data.geo.radiusOverridden ? data.geo.radiusM : null, reason: reason.trim() }))}>중심 보정 해제</Button><Button variant="outline" disabled={!allowed} onClick={() => mutate(() => api.saveGeo(marketId, { centerLat: data.geo.centerOverridden ? data.geo.centerLat : null, centerLng: data.geo.centerOverridden ? data.geo.centerLng : null, radiusM: null, reason: reason.trim() }))}>반경 보정 해제</Button>
      </section>
      <section aria-label="확인 필요 가게" className="space-y-2"><h3>확인 필요 {review.length}곳</h3>{!review.length && <p>확인할 가게가 없습니다.</p>}<ul>{review.map(s => <li key={s.storeId} className="flex flex-wrap items-center gap-2"><span>{s.name} · {s.roadAddress ?? '주소 없음'}</span><label>{s.name} 골목<select value={assignments[s.storeId] ?? ''} onChange={e => setAssignments({ ...assignments, [s.storeId]: e.target.value ? Number(e.target.value) : null })}><option value="">미배정</option>{data.paths.map(p => <option key={p.id} value={p.id}>{p.name ?? `골목 ${p.id}`}{s.suggestedPathId === p.id ? ' (추천)' : ''}</option>)}</select></label><Button variant="outline" disabled={!allowed} onClick={() => mutate(() => api.assignStorePath(marketId, s.storeId, assignments[s.storeId] ?? null, reason.trim()))}>{s.name} 골목 지정</Button></li>)}</ul></section>
      {deletion && <div role="alert" className="border p-3">#{deletion.id} 항목을 삭제할까요?<Button variant="outline" disabled={!allowed} onClick={() => mutate(() => api.deleteGeometryItem(marketId, deletion.kind, deletion.id, reason.trim()), () => setDeletion(null))}>삭제 확인</Button><Button variant="outline" onClick={() => setDeletion(null)}>삭제 취소</Button></div>}
    </fieldset>
  </section>;
}
