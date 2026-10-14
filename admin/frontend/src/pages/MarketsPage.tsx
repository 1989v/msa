import { useCallback, useEffect, useState } from 'react';
import * as api from '@/api/markets';
import type { Coordinate, Detail, Page, Market, StoreRow, Change } from '@/api/markets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StoreEditor } from './markets/StoreEditor';
import { ZoneEditor } from './markets/ZoneEditor';
import { EditorMap } from './markets/EditorMap';
import { changeSummary, compactChange, editError, historyTime, polygonWkt, revertConfirmation } from './markets/editorState';
import type { PolygonState } from './markets/editorState';

export function MarketsPage() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [list, setList] = useState<Page<Market> | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [historyPage, setHistoryPage] = useState(0);
  const [history, setHistory] = useState<Page<Change> | null>(null);
  const [message, setMessage] = useState('');
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const loading = listLoading || detailLoading;
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<{ row: StoreRow | null; mode: 'manual' | 'override'; key: number } | null>(null);
  const [coordinate, setCoordinate] = useState<Coordinate | null>(null);
  const [polygon, setPolygon] = useState<PolygonState>({ vertices: [], closed: false });
  const [revert, setRevert] = useState<number | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => { let active = true; setListLoading(true); api.listMarkets(query, page).then(result => { if (active) { setList(result); } }).catch(error => { if (active) { setMessage(editError(error)); } }).finally(() => { if (active) setListLoading(false); }); return () => { active = false; }; }, [query, page, version]);
  useEffect(() => { if (selected == null) return; let active = true; setDetailLoading(true); Promise.all([api.getMarket(selected), api.getChanges(selected, historyPage)]).then(([d, h]) => { if (active) { setDetail(d); setHistory(h); setMessage(''); } }).catch(error => { if (active) { setMessage(editError(error)); setDetail(null); setHistory(null); } }).finally(() => { if (active) setDetailLoading(false); }); return () => { active = false; }; }, [selected, historyPage, version]);
  const run = useCallback(async (action: () => Promise<void>) => { setBusy(true); setMessage(''); try { await action(); setVersion(v => v + 1); return true; } catch (error) { setMessage(editError(error)); return false; } finally { setBusy(false); } }, []);
  const open = (row: StoreRow | null, mode: 'manual' | 'override', pin: Coordinate | null = null) => { setCoordinate(pin); setEditor({ row, mode, key: Date.now() }); };
  return <div className="min-w-0 max-w-full space-y-6" style={{ color: 'var(--ko-text-primary)' }}>
    <h1 className="text-2xl font-semibold">시장 가게 관리</h1>
    <form className="flex gap-2" onSubmit={e => { e.preventDefault(); setPage(0); setQuery(search.trim()); }}><label className="min-w-0 flex-1">시장 이름<Input value={search} onChange={e => setSearch(e.target.value)} /></label><Button variant="outline" type="submit">검색</Button></form>
    {message && <p role="alert">{message} <Button variant="outline" onClick={() => setVersion(v => v + 1)}>다시 불러오기</Button></p>}
    {loading && <p role="status">불러오는 중…</p>}
    {list && <section aria-label="시장 목록"><ul>{list.items.map(m => <li key={m.id}><Button variant="outline" disabled={busy} onClick={() => { setSelected(m.id); setDetail(null); setHistory(null); setHistoryPage(0); setEditor(null); setCoordinate(null); setPolygon({ vertices: [], closed: false }); setRevert(null); }}>{m.name} · {m.marketType}</Button></li>)}</ul>{!list.items.length && <p>검색한 시장이 없습니다.</p>}<Pager page={page} total={list.total} disabled={loading} setPage={setPage} /></section>}
    {detail && detail.market.id === selected && <fieldset disabled={busy || loading} className="space-y-6 min-w-0">
      <h2 className="text-xl font-semibold">{detail.market.name} · {detail.market.marketType}</h2>
      <EditorMap detail={detail} polygon={polygon} setPolygon={setPolygon} draft={coordinate} selectedStoreId={editor?.row?.source.id ?? null} onSelect={row => open(row, 'override')} disabled={busy || loading} onCoordinate={pin => { setCoordinate(pin); if (!editor) open(null, 'manual', pin); }} onMove={(row, pin) => open(row, 'override', pin)} />
      <section aria-label="가게 목록" className="min-w-0 max-w-full"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">가게 {detail.stores.length}개</h2><Button variant="outline" onClick={() => open(null, 'manual')}>수동 가게 추가</Button></div>
        <div className="min-w-0 max-w-full overflow-x-auto"><table className="w-full min-w-[1000px] whitespace-nowrap text-left tabular-nums"><thead><tr>{['이름', '품목', '구역', '소속', '출처 / 위치', '보정', '편집'].map(label => <th className="p-2" key={label}>{label}</th>)}</tr></thead><tbody>{detail.stores.map(row => <tr key={row.source.id} className="border-b"><td className="p-2"><span className="block max-w-48 truncate" title={row.display.name}>{row.display.name}</span></td><td><span className="block max-w-48 truncate" title={row.display.items ?? undefined}>{row.display.items ?? '—'}</span></td><td><span className="block max-w-40 truncate" title={detail.zones.find(z => z.id === row.display.zoneId)?.name}>{detail.zones.find(z => z.id === row.display.zoneId)?.name ?? '미배정'}</span></td><td>{row.display.membership.status}</td><td>{row.source.source} {row.source.actorKind ?? ''} · {row.display.pinKind}</td><td><ul>{row.overrides.map(o => <li key={o.field} className="max-w-56 truncate" title={`${o.field}: ${o.value ?? '비움'} (${o.reason})`}>{o.field}: {o.value ?? '비움'} ({o.reason})</li>)}</ul>{!row.overrides.length && '없음'}</td><td><Button variant="outline" onClick={() => open(row, 'override')}>표시값 수정</Button>{row.source.source === 'MANUAL' && <Button variant="outline" onClick={() => open(row, 'manual')}>수동 원본 수정</Button>}</td></tr>)}</tbody></table></div>{!detail.stores.length && <p>등록된 가게가 없습니다.</p>}
      </section>
      {editor && <StoreEditor key={editor.key} detail={detail} row={editor.row} mode={editor.mode} coordinate={coordinate} run={run} close={() => { setEditor(null); setCoordinate(null); }} />}
      <ZoneEditor key={detail.market.id} detail={detail} polygon={polygonWkt(polygon)} run={run} clearPolygon={() => setPolygon({ vertices: [], closed: false })} />
      <section aria-label="변경 이력" className="min-w-0 max-w-full space-y-3"><h2 className="text-lg font-semibold">변경 이력 · 한국 시간 (KST)</h2><div className="min-w-0 max-w-full overflow-x-auto"><table className="w-full min-w-[1100px] whitespace-nowrap text-left tabular-nums"><thead><tr>{['시간', '작업자', '대상', '동작', '전 / 후', '되돌리기'].map(h => <th className="p-2" key={h}>{h}</th>)}</tr></thead><tbody>{history?.items.map(log => <tr key={log.id} className="border-b"><td className="p-2">{historyTime(log.createdAt)}</td><td>{log.actorKind} #{log.memberId}</td><td>{log.target} #{log.targetId}</td><td>{log.action}</td><td><div className="w-80"><p className="truncate" title={compactChange(log.beforeRaw)}>전: {compactChange(log.beforeRaw)}</p><p className="truncate" title={compactChange(log.afterRaw)}>후: {compactChange(log.afterRaw)}</p><details className="whitespace-normal break-words [overflow-wrap:anywhere]"><summary>전체 값 보기</summary><p>전: {changeSummary(log.beforeRaw)}</p><p>후: {changeSummary(log.afterRaw)}</p></details></div></td><td>{revert === log.id ? <div role="alert">이 행을 되돌릴까요?<Button variant="outline" onClick={async () => { if (await run(() => api.revertChange(detail.market.id, log.id))) setRevert(revertConfirmation(revert, { type: 'complete' })); }}>되돌리기 확인</Button><Button variant="outline" onClick={() => setRevert(revertConfirmation(revert, { type: 'cancel' }))}>취소</Button></div> : <Button variant="outline" onClick={() => setRevert(revertConfirmation(revert, { type: 'ask', id: log.id }))}>되돌리기</Button>}</td></tr>)}</tbody></table></div>{history && !history.items.length && <p>변경 이력이 없습니다.</p>}{history && <Pager page={historyPage} total={history.total} disabled={loading} setPage={p => { setHistoryPage(p); setRevert(null); }} />}</section>
    </fieldset>}
    {busy && <p role="status">저장 중…</p>}
  </div>;
}
function Pager({ page, total, disabled, setPage }: { page: number; total: number; disabled: boolean; setPage: (page: number) => void }) { return <div className="flex items-center gap-3 py-3"><Button variant="outline" disabled={disabled || page === 0} onClick={() => setPage(page - 1)}>이전</Button><span>{page + 1} / {Math.max(1, Math.ceil(total / 20))} 페이지 · 총 {total}건</span><Button variant="outline" disabled={disabled || (page + 1) * 20 >= total} onClick={() => setPage(page + 1)}>다음</Button></div>; }
