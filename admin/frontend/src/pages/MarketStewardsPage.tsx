import { useEffect, useState } from 'react';
import * as api from '@/api/stewards';
import type { Steward, StewardStatus } from '@/api/stewards';
import type { Page } from '@/api/markets';
import { Button } from '@/components/ui/button';
import { historyTime } from './markets/editorState';
import { ACTION_LABEL, STATUS_LABEL, stewardActions, stewardConfirmation } from './markets/stewardState';
import type { StewardConfirmation } from './markets/stewardState';

export function MarketStewardsPage() {
  const [status, setStatus] = useState<StewardStatus | ''>('PENDING'); const [page, setPage] = useState(0);
  const [list, setList] = useState<Page<Steward> | null>(null); const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const [confirmation, setConfirmation] = useState<StewardConfirmation | null>(null);
  useEffect(() => { let active = true; setLoading(true); setList(null); api.listStewards(status, page).then(data => { if (active) setList(data); }).catch(() => { if (active) setMessage('신청 목록을 불러오지 못했습니다. 다시 시도하세요.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [status, page, version]);
  const decide = async () => { if (!confirmation || busy) return; setBusy(true); setMessage(''); try { await api.decideSteward(confirmation.id, confirmation.action); setConfirmation(stewardConfirmation({ type: 'complete' })); setVersion(v => v + 1); setMessage('신청 상태를 변경했습니다.'); } catch { setMessage('상태를 변경하지 못했습니다. 이미 처리된 신청인지 목록을 다시 확인하세요.'); } finally { setBusy(false); } };
  return <main className="min-w-0 space-y-6" style={{ color: 'var(--ko-text-primary)' }}><h1 className="text-2xl font-semibold">상인회 담당자 신청</h1><p>단체명과 연락처로 담당자를 확인한 뒤 승인하세요. 정지하면 다음 요청부터 편집 권한이 중단됩니다.</p>
    <label className="block">신청 상태 <select className="min-h-11 rounded border bg-transparent p-2 focus-visible:outline focus-visible:outline-2" disabled={busy} value={status} onChange={e => { setStatus(e.target.value as StewardStatus | ''); setPage(0); setConfirmation(null); setMessage(''); }}><option value="">전체</option>{Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    {message && <p role="status">{message}</p>}<Button className="min-h-11 focus-visible:outline focus-visible:outline-2" variant="outline" disabled={busy || loading} onClick={() => { setMessage(''); setConfirmation(null); setVersion(v => v + 1); }}>다시 불러오기</Button>
    {loading && <p role="status">신청 목록을 불러오는 중…</p>}
    <ul className="space-y-4">{list?.items.map(row => <li key={row.id} className="min-w-0 space-y-3 border-b py-4 [overflow-wrap:anywhere]"><h2 className="text-lg font-semibold">{row.orgName} · {STATUS_LABEL[row.status]}</h2><dl className="grid gap-2 sm:grid-cols-2"><div><dt>시장</dt><dd>시장 #{row.marketId}</dd></div><div><dt>회원</dt><dd>#{row.memberId}</dd></div><div><dt>연락처</dt><dd>{row.contact}</dd></div><div><dt>신청일 · 한국 시간 (KST)</dt><dd>{historyTime(row.createdAt)}</dd></div></dl>
      <div className="flex flex-wrap gap-2">{stewardActions(row.status).map(action => <Button className="min-h-11 focus-visible:outline focus-visible:outline-2" key={action} variant="outline" disabled={busy || loading} onClick={() => setConfirmation(stewardConfirmation({ type: 'ask', id: row.id, action }))}>{ACTION_LABEL[action]}</Button>)}</div>
      {confirmation?.id === row.id && <div role="alert" className="space-y-2"><p>{row.orgName}의 신청을 {ACTION_LABEL[confirmation.action]}할까요?{confirmation.action === 'SUSPEND' && ' 편집 권한이 즉시 중단됩니다.'}</p><Button className="min-h-11 focus-visible:outline focus-visible:outline-2" variant="outline" disabled={busy} onClick={() => void decide()}>{ACTION_LABEL[confirmation.action]} 확인</Button> <Button className="min-h-11 focus-visible:outline focus-visible:outline-2" variant="outline" disabled={busy} onClick={() => setConfirmation(stewardConfirmation({ type: 'cancel' }))}>취소</Button></div>}
    </li>)}</ul>{list && !list.items.length && <p>이 상태의 신청이 없습니다.</p>}
    {list && <nav aria-label="신청 목록 페이지" className="flex flex-wrap items-center gap-3"><Button className="min-h-11 focus-visible:outline focus-visible:outline-2" variant="outline" disabled={busy || loading || page === 0} onClick={() => { setPage(page - 1); setConfirmation(null); }}>이전</Button><span>{page + 1} / {Math.max(1, Math.ceil(list.total / list.size))} 페이지 · 총 {list.total}건</span><Button className="min-h-11 focus-visible:outline focus-visible:outline-2" variant="outline" disabled={busy || loading || (page + 1) * list.size >= list.total} onClick={() => { setPage(page + 1); setConfirmation(null); }}>다음</Button></nav>}{busy && <p role="status">처리 중…</p>}
  </main>;
}
