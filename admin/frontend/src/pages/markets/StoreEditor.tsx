import { useState } from 'react';
import type { Coordinate, Detail, ManualStorePayload, OverrideField, StoreRow } from '@/api/markets';
import { deleteManualStore, overrideStore, saveManualStore } from '@/api/markets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { eligibleReferences, overrideRequest } from './editorState';

export type Mutation = (action: () => Promise<void>) => Promise<boolean>;
export function StoreEditor({ detail, row, mode, coordinate, run, close }: { detail: Detail; row: StoreRow | null; mode: 'override' | 'manual'; coordinate: Coordinate | null; run: Mutation; close: () => void }) {
  const source = row?.source;
  const display = row?.display;
  const [reason, setReason] = useState('');
  const [clear, setClear] = useState<OverrideField[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<ManualStorePayload>({ name: (mode === 'manual' ? source?.name : display?.name) ?? '', items: (mode === 'manual' ? source?.items : display?.items) ?? null, zoneId: (mode === 'manual' ? source?.zoneId : display?.zoneId) ?? null, membership: (mode === 'manual' ? source?.membership.status : display?.membership.status) ?? 'IN', pinKind: source?.pinKind ?? 'EXACT', latitude: source?.latitude ?? null, longitude: source?.longitude ?? null, referenceStoreId: source?.referenceStoreId ?? null, relativePosition: source?.relativePosition ?? '옆', positionNote: source?.positionNote ?? null });
  const references = eligibleReferences(detail.stores, source?.id ?? null);
  const pin = coordinate ?? (form.latitude != null && form.longitude != null ? { latitude: form.latitude, longitude: form.longitude } : null);
  const changes: import('@/api/markets').OverridePayload['values'] = {};
  if (display) {
    if (form.name.trim() !== display.name) changes.name = form.name.trim();
    if ((form.items?.trim() || null) !== display.items) changes.items = form.items?.trim() || null;
    if (form.zoneId !== display.zoneId) changes.zoneId = form.zoneId == null ? null : String(form.zoneId);
    if (form.membership !== display.membership.status) changes.membership = form.membership;
    if (coordinate) { changes.latitude = String(coordinate.latitude); changes.longitude = String(coordinate.longitude); }
  }
  const valid = form.name.trim() && (mode === 'override' ? reason.trim() && Object.keys(changes).length : form.pinKind === 'EXACT' ? pin : form.referenceStoreId && form.positionNote?.trim());
  const save = async () => {
    const id = detail.market.id;
    const ok = await run(() => mode === 'override' && source ? overrideStore(id, source.id, overrideRequest(changes, [], reason)) : saveManualStore(id, source?.id ?? null, { ...form, name: form.name.trim(), items: form.items?.trim() || null, latitude: form.pinKind === 'EXACT' ? pin?.latitude ?? null : null, longitude: form.pinKind === 'EXACT' ? pin?.longitude ?? null : null, referenceStoreId: form.pinKind === 'REFERENCE' ? form.referenceStoreId : null, relativePosition: form.pinKind === 'REFERENCE' ? form.relativePosition : null, positionNote: form.pinKind === 'REFERENCE' ? form.positionNote?.trim() || null : null }));
    if (ok) close();
  };
  return <section className="space-y-3 border-t py-4" aria-label="가게 편집">
    <h3 className="font-semibold">{mode === 'override' ? '표시값 수정' : source ? '수동 가게 수정' : '수동 가게 추가'}</h3>
    <label className="block">가게 이름<Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
    <label className="block">품목<Input value={form.items ?? ''} onChange={e => setForm({ ...form, items: e.target.value })} /></label>
    <label>소속 <select value={form.membership} onChange={e => setForm({ ...form, membership: e.target.value as ManualStorePayload['membership'] })}>{['IN', 'OUT', 'UNKNOWN'].map(s => <option key={s}>{s}</option>)}</select></label>{' '}
    <label>구역 <select value={form.zoneId ?? ''} onChange={e => setForm({ ...form, zoneId: e.target.value ? Number(e.target.value) : null })}><option value="">미배정</option>{detail.zones.map(z => <option value={z.id} key={z.id}>{z.name}</option>)}</select></label>
    {mode === 'manual' && <>
      <label className="block">위치 방식 <select value={form.pinKind} onChange={e => setForm({ ...form, pinKind: e.target.value as ManualStorePayload['pinKind'] })}><option value="EXACT">정확 핀 — 지도 클릭</option><option value="REFERENCE">참고 위치</option></select></label>
      {form.pinKind === 'REFERENCE' ? <div className="space-y-3"><label>이웃 가게 <select value={form.referenceStoreId ?? ''} onChange={e => setForm({ ...form, referenceStoreId: Number(e.target.value) || null })}><option value="">선택</option>{references.map(r => <option key={r.source.id} value={r.source.id}>{r.display.name}</option>)}</select></label>{!references.length && <p>참조할 수 있는 IN 정확 핀 가게가 없습니다.</p>}<label> 상대 위치 <select value={form.relativePosition ?? '옆'} onChange={e => setForm({ ...form, relativePosition: e.target.value })}>{['옆', '맞은편', '앞', '뒤'].map(p => <option key={p}>{p}</option>)}</select></label><label className="block">위치 메모 (필수)<Input value={form.positionNote ?? ''} onChange={e => setForm({ ...form, positionNote: e.target.value })} /></label></div> : <p>지도를 클릭하여 정확한 위치를 지정하세요. {pin ? `${pin.latitude.toFixed(6)}, ${pin.longitude.toFixed(6)}` : '위치 미지정'}</p>}
    </>}
    {coordinate && mode === 'override' && <p>이동할 위치: {coordinate.latitude.toFixed(6)}, {coordinate.longitude.toFixed(6)}</p>}
    {mode === 'override' && <>
      <label className="block">수정 이유 (필수)<Input value={reason} onChange={e => setReason(e.target.value)} /></label>
      {!!row?.overrides.length && <fieldset><legend>표시값 보정 해제</legend>{(['name', 'items', 'zoneId', 'membership', 'latitude'] as OverrideField[]).map(field => <label key={field} className="mr-3"><input type="checkbox" checked={clear.includes(field)} onChange={e => setClear(e.target.checked ? [...clear, field, ...(field === 'latitude' ? ['longitude' as const] : [])] : clear.filter(f => f !== field && !(field === 'latitude' && f === 'longitude')))} />{field === 'latitude' ? '좌표 쌍' : field}</label>)}<Button variant="outline" disabled={!reason.trim() || !clear.length} onClick={async () => { if (source && await run(() => overrideStore(detail.market.id, source.id, overrideRequest({}, clear, reason)))) close(); }}>선택 보정 해제</Button></fieldset>}
    </>}
    <div className="flex gap-2"><Button disabled={!valid} onClick={save}>가게 저장</Button><Button variant="outline" onClick={close}>닫기</Button>{mode === 'manual' && source && <Button variant="outline" onClick={() => setDeleting(true)}>삭제</Button>}</div>
    {deleting && source && <div role="alert">수동 가게를 삭제할까요? 참조 또는 보정이 남아 있으면 삭제할 수 없습니다. <Button variant="outline" onClick={async () => { if (await run(() => deleteManualStore(detail.market.id, source.id))) close(); }}>삭제 확인</Button><Button variant="outline" onClick={() => setDeleting(false)}>취소</Button></div>}
  </section>;
}
