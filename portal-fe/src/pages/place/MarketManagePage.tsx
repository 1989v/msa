import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { buildLoginHref, getUserId, isLoggedIn } from '../../auth/auth';
import * as api from '../../api/marketStewardApi';
import type { EditorStore, MarketEditorDetail, StoreInput } from '../../api/marketStewardApi';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import { useSeo } from '../../seo/useSeo';
import { referenceStores, stewardError, storeInput, validManual } from './stewardState';
import './AttractionMarket.css';
import MarketGeometryRequests from './MarketGeometryRequests';

export default function MarketManagePage() {
  useHeritageSurface();
  useSeo({ title: '가게 정보 관리', noindex: true, canonical: null });
  const { marketId = '' } = useParams(); const id = Number(marketId);
  const loggedIn = isLoggedIn();
  const validId = Number.isSafeInteger(id) && id > 0;
  // No cached grant: the service verifies ACTIVE on every read and write.
  const query = useQuery({ queryKey: ['market-manage', id, getUserId()], queryFn: () => api.getManagedMarket(id), enabled: loggedIn && validId, retry: false, staleTime: 0, gcTime: 0 });
  if (!loggedIn) return <main className="place-market market-manage"><h1>가게 정보 관리</h1><a href={buildLoginHref()}>로그인하고 계속하기</a></main>;
  if (!validId) return <main className="place-market market-manage"><h1>시장을 찾을 수 없습니다.</h1></main>;
  if (query.isPending) return <main className="place-market market-manage"><p role="status">관리 권한과 가게 정보를 확인하는 중…</p></main>;
  if (query.isError) return <main className="place-market market-manage"><h1>가게 정보 관리</h1><p role="alert">{stewardError(query.error)}</p><a href={buildLoginHref()}>다시 로그인</a><button onClick={() => void query.refetch()}>다시 불러오기</button></main>;
  return <ManageEditor key={id} detail={query.data} refresh={async () => { await query.refetch({ throwOnError: true }); }} />;
}
function ManageEditor({ detail, refresh }: { detail: MarketEditorDetail; refresh: () => Promise<void> }) {
  const [editor, setEditor] = useState<{ row: EditorStore | null; manual: boolean } | null>(null);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [forbidden, setForbidden] = useState(false);
  const run = async (action: () => Promise<void>) => { if (busy || forbidden) return false; setBusy(true); setMessage(''); try { await action(); await refresh(); setMessage('저장했습니다.'); return true; } catch (error) { const text = stewardError(error); setMessage(text); if (text === '이 시장 관리 권한이 없습니다.') setForbidden(true); return false; } finally { setBusy(false); } };
  if (forbidden) return <main className="place-market market-manage"><h1>가게 정보 관리</h1><p role="alert">이 시장 관리 권한이 없습니다.</p></main>;
  return <main className="place-market market-manage"><h1>{detail.market.name} · 가게 정보 관리</h1><p>상인회가 확인한 가게 정보와 구역 이름을 관리합니다.</p>
    {message && <p role="status">{message}</p>}{message.includes('로그인') && <a href={buildLoginHref()}>다시 로그인</a>}{busy && <p role="status">저장 중…</p>}
    <fieldset disabled={busy || forbidden}><legend>가게 관리</legend><button onClick={() => setEditor({ row: null, manual: true })}>수동 가게 추가</button>
      <ul className="place-market-shops">{detail.stores.map(row => <li key={row.source.id}><strong>{row.display.name}</strong><p>{row.display.items || '품목 미등록'} · {row.display.membership.status} · {detail.zones.find(z => z.id === row.display.zoneId)?.name || '구역 미배정'}</p><button onClick={() => setEditor({ row, manual: false })}>표시값 수정 · {row.display.name}</button>{row.source.source === 'MANUAL' && <button onClick={() => setEditor({ row, manual: true })}>수동 가게 수정 · {row.display.name}</button>}</li>)}</ul>{!detail.stores.length && <p>등록된 가게가 없습니다.</p>}
      {editor && <StewardStoreEditor key={`${editor.row?.source.id ?? 'new'}-${editor.manual}`} detail={detail} row={editor.row} manual={editor.manual} run={run} close={() => setEditor(null)} />}
      <section aria-label="구역 이름 관리"><h2>구역 이름 관리</h2>{detail.zones.map(zone => <ZoneRename key={`${zone.id}-${zone.name}`} zone={zone} save={name => run(() => api.renameManagedZone(detail.market.id, zone, name))} />)}{!detail.zones.length && <p>등록된 구역이 없습니다.</p>}</section>
    </fieldset>
    <MarketGeometryRequests detail={detail} />
  </main>;
}
function ZoneRename({ zone, save }: { zone: api.EditorZone; save: (name: string) => Promise<boolean> }) {
  const [name, setName] = useState(zone.name);
  return <form className="market-zone-rename" onSubmit={e => { e.preventDefault(); if (name.trim() && name.trim() !== zone.name) void save(name); }}><label htmlFor={`zone-name-${zone.id}`}>구역 이름 · {zone.name}</label><input id={`zone-name-${zone.id}`} value={name} maxLength={300} onChange={e => setName(e.target.value)} /><button type="submit" disabled={!name.trim() || name.trim() === zone.name}>구역 이름 저장</button></form>;
}
export function StewardStoreEditor({ detail, row, manual, run, close }: { detail: MarketEditorDetail; row: EditorStore | null; manual: boolean; run: (action: () => Promise<void>) => Promise<boolean>; close: () => void }) {
  const [form, setForm] = useState<StoreInput>(() => manual ? storeInput(row) : { ...storeInput(row), name: row?.display.name ?? '', items: row?.display.items ?? null, zoneId: row?.display.zoneId ?? null, membership: row?.display.membership.status ?? 'IN' });
  const [reason, setReason] = useState(''); const [deleting, setDeleting] = useState(false);
  const references = referenceStores(detail.stores, row?.source.id);
  const values: Record<string, string | null> = {};
  if (row) { if (form.name.trim() !== row.display.name) values.name = form.name.trim(); if ((form.items?.trim() || null) !== row.display.items) values.items = form.items?.trim() || null; if (form.zoneId !== row.display.zoneId) values.zoneId = form.zoneId == null ? null : String(form.zoneId); if (form.membership !== row.display.membership.status) values.membership = form.membership; }
  const valid = manual ? validManual(form) : !!form.name.trim() && form.name.trim().length <= 300 && !!reason.trim() && Object.keys(values).length > 0;
  return <section className="market-steward" aria-label="가게 편집"><h2>{manual ? row ? '수동 가게 수정' : '수동 가게 추가' : '표시값 수정'}</h2><form onSubmit={async e => { e.preventDefault(); if (!valid) return; const id = detail.market.id; const ok = await run(() => manual ? api.saveManagedStore(id, row?.source.id ?? null, { ...form, name: form.name.trim(), items: form.items?.trim() || null, relativePosition: form.pinKind === 'EXACT' ? null : form.relativePosition?.trim() || null, positionNote: form.positionNote?.trim() || null }) : api.overrideManagedStore(id, row!.source.id, values, reason)); if (ok) close(); }}>
    <label>가게 이름 (필수)<input maxLength={300} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
    <label>품목<input value={form.items ?? ''} onChange={e => setForm({ ...form, items: e.target.value })} /></label>
    <label>시장 소속<select value={form.membership} onChange={e => setForm({ ...form, membership: e.target.value as StoreInput['membership'] })}><option value="IN">시장 안</option><option value="OUT">시장 밖</option><option value="UNKNOWN">소속 미확인</option></select></label>
    <label>구역<select value={form.zoneId ?? ''} onChange={e => setForm({ ...form, zoneId: e.target.value ? Number(e.target.value) : null })}><option value="">미배정</option>{detail.zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</select></label>
    {!manual && <label>수정 이유 (필수)<input required value={reason} onChange={e => setReason(e.target.value)} /></label>}
    {manual && form.pinKind === 'REFERENCE' && <><p>참고 위치는 이웃 가게를 기준으로 표시됩니다. 실제 출입구와 다를 수 있습니다.</p><label>기준 가게 (필수)<select value={form.referenceStoreId ?? ''} onChange={e => setForm({ ...form, referenceStoreId: Number(e.target.value) || null })}><option value="">기준 가게 선택</option>{references.map(r => <option key={r.source.id} value={r.source.id}>{r.display.name}</option>)}</select></label>{!references.length && <p>기준으로 삼을 위치가 확인된 시장 안 가게가 없습니다. 운영자에게 문의하세요.</p>}<label>상대 위치 (필수)<select value={form.relativePosition ?? ''} onChange={e => setForm({ ...form, relativePosition: e.target.value })}><option value="">선택</option>{['옆', '맞은편', '앞', '뒤'].map(p => <option key={p}>{p}</option>)}</select></label><label>위치 메모 (필수)<input required value={form.positionNote ?? ''} onChange={e => setForm({ ...form, positionNote: e.target.value })} /></label></>}
    {manual && form.pinKind === 'EXACT' && <p>등록된 정확 위치를 유지합니다.</p>}
    <button type="submit" disabled={!valid}>가게 저장</button><button type="button" onClick={close}>닫기</button>
    {manual && row && <button type="button" onClick={() => setDeleting(true)}>수동 가게 삭제</button>}
  </form>{deleting && row && <div role="alert">이 수동 가게를 삭제할까요? 다른 가게가 참조 중이면 삭제할 수 없습니다.<button type="button" onClick={async () => { if (await run(() => api.deleteManagedStore(detail.market.id, row.source.id))) close(); }}>삭제 확인</button><button type="button" onClick={() => setDeleting(false)}>취소</button></div>}</section>;
}
