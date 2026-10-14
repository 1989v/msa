import { useState } from 'react';
import type { Detail, Zone, ZonePayload } from '@/api/markets';
import { deleteZone, orderZones, saveZone } from '@/api/markets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Mutation } from './StoreEditor';
export function ZoneEditor({ detail, polygon, run, clearPolygon }: { detail: Detail; polygon: string | null; run: Mutation; clearPolygon: () => void }) {
  const blank: ZonePayload = { name: '', kind: detail.market.marketType === 'BUILDING' ? 'BUILDING' : 'CUSTOM', parentId: null, polygonWkt: null, buildingName: null, dong: null, floor: null, sortOrder: 0 };
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState<ZonePayload>(blank);
  const [deleting, setDeleting] = useState<number | null>(null);
  const select = (zone: Zone) => { setEditing(zone.id); setForm({ name: zone.name, kind: zone.kind, parentId: zone.parentId, polygonWkt: zone.polygonWkt, buildingName: zone.buildingName, dong: zone.dong, floor: zone.floor, sortOrder: zone.sortOrder }); clearPolygon(); };
  const sorted = [...detail.zones].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const move = async (index: number, delta: number) => { const ids = sorted.map(z => z.id); [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]]; await run(() => orderZones(detail.market.id, ids)); };
  return <section className="space-y-3 border-t py-4"><h2 className="text-lg font-semibold">구역 · 건물 / 동 / 층</h2>
    {!sorted.length && <p>등록된 구역이 없습니다.</p>}
    <ul>{sorted.map((z, i) => <li key={z.id} className="flex flex-wrap items-center gap-2 py-2"><span>{z.parentId ? `상위 #${z.parentId} → ` : ''}{z.name} · {z.kind} · {[z.buildingName, z.dong, z.floor].filter(Boolean).join(' / ')} · {z.source}</span><Button variant="outline" onClick={() => select(z)}>구역 수정</Button><Button variant="outline" disabled={i === 0} onClick={() => move(i, -1)}>위</Button><Button variant="outline" disabled={i === sorted.length - 1} onClick={() => move(i, 1)}>아래</Button><Button variant="outline" onClick={() => setDeleting(z.id)}>구역 삭제</Button></li>)}</ul>
    {deleting != null && <p role="alert">구역 #{deleting} 삭제 확인 <Button variant="outline" onClick={async () => { if (await run(() => deleteZone(detail.market.id, deleting))) setDeleting(null); }}>삭제 확인</Button><Button variant="outline" onClick={() => setDeleting(null)}>취소</Button></p>}
    <h3>{editing == null ? '구역 추가' : `구역 #${editing} 편집`}</h3>
    <label className="block">구역 이름<Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
    <label>종류 <select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as ZonePayload['kind'] })}>{(detail.market.marketType === 'BUILDING' ? ['BUILDING', 'FLOOR'] : ['ROAD', 'CUSTOM', 'BUILDING', 'FLOOR']).map(kind => <option key={kind}>{kind}</option>)}</select></label>{' '}
    <label>상위 구역 <select value={form.parentId ?? ''} onChange={e => setForm({ ...form, parentId: Number(e.target.value) || null })}><option value="">없음</option>{detail.zones.filter(z => z.id !== editing).map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</select></label>
    {(['buildingName', 'dong', 'floor'] as const).map(field => <label key={field} className="block">{{ buildingName: '건물', dong: '동', floor: '층' }[field]}<Input value={form[field] ?? ''} onChange={e => setForm({ ...form, [field]: e.target.value || null })} /></label>)}
    <label className="block">순서<Input type="number" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: Number(e.target.value) })} /></label>
    {detail.market.marketType !== 'BUILDING' && <p>{polygon ? '새 폴리곤을 저장합니다.' : form.polygonWkt ? '기존 폴리곤 유지' : '지도에서 폴리곤을 그릴 수 있습니다.'}</p>}
    <div className="flex gap-2"><Button variant="outline" disabled={!form.name.trim()} onClick={async () => { if (await run(() => saveZone(detail.market.id, editing, { ...form, name: form.name.trim(), polygonWkt: detail.market.marketType === 'BUILDING' ? null : polygon ?? form.polygonWkt }))) { setEditing(null); setForm(blank); clearPolygon(); } }}>구역 저장</Button><Button variant="outline" onClick={() => { setEditing(null); setForm(blank); clearPolygon(); }}>새 구역 / 취소</Button></div>
  </section>;
}
