import { useEffect, useState } from 'react';
import * as api from '@/api/geometryRequests';
import { Button } from '@/components/ui/button';
import { historyTime } from './markets/editorState';
const KINDS = { BOUNDARY: '시장 경계', PATH: '골목 선', ENTRANCE: '출입구', NOTE: '위치 메모' };
const STATUS = { PENDING: '검토 대기', APPROVED: '승인 · 편집 반영 대기', REJECTED: '반려' };
export function GeometryPreview({ row }: { row: api.GeometryRequest }) {
  const points = row.geometry; if (!points?.length) return <p>첨부 그림 없음</p>;
  const lat = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const east = Math.max(0.001, Math.cos(lat * Math.PI / 180));
  const origin = points[0]; const raw = points.map(p => [(p[1] - origin[1]) * east, origin[0] - p[0]]);
  const xs = raw.map(p => p[0]), ys = raw.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = 250 / Math.max(maxX - minX, maxY - minY, 0.0001);
  const projected = raw.map(p => [150 + (p[0] - (minX + maxX) / 2) * scale, 150 + (p[1] - (minY + maxY) / 2) * scale]);
  return <figure><svg viewBox="0 0 300 300" className="w-full max-w-sm border" style={{ color: 'var(--ko-accent-primary)' }} role="img" aria-label={`요청 #${row.id} 그림 · 북쪽이 위`}>
    {row.kind === 'BOUNDARY' ? <polygon points={projected.map(p => p.join(',')).join(' ')} fill="none" stroke="currentColor" strokeWidth="2" /> : <polyline points={projected.map(p => p.join(',')).join(' ')} fill="none" stroke="currentColor" strokeWidth="2" />}
    {projected.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="4" fill="currentColor" />)}</svg><figcaption>상인회 제안 · 북쪽이 위 · 실제 지도에 아직 반영되지 않았습니다.</figcaption></figure>;
}
export function MarketGeometryRequestsPage() {
  const [status, setStatus] = useState<api.GeometryStatus | ''>('PENDING'); const [rows, setRows] = useState<api.GeometryRequest[]>([]); const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const [decision, setDecision] = useState<{ id: number; action: 'APPROVE' | 'REJECT' } | null>(null); const [reason, setReason] = useState('');
  useEffect(() => { let active = true; setLoading(true); setRows([]); api.listGeometryRequests(status).then(data => { if (active) setRows(data); }).catch(() => { if (active) setMessage('요청 목록을 불러오지 못했습니다.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [status, version]);
  const decide = async () => { if (!decision || !reason.trim() || busy) return; setBusy(true); setMessage(''); try { await api.decideGeometryRequest(decision.id, decision.action, reason); setDecision(null); setReason(''); setVersion(v => v + 1); setMessage('결정을 기록했습니다. 승인은 지도에 자동 반영되지 않습니다.'); } catch { setMessage('처리하지 못했습니다. 이미 결정된 요청인지 목록을 다시 확인하세요.'); } finally { setBusy(false); } };
  return <main className="space-y-6" style={{ color: 'var(--ko-text-primary)' }}><h1 className="text-2xl font-semibold">상인회 골목 구조 변경 요청</h1><p>승인은 제안 검토 결과만 기록합니다. 승인 후 편집기에서 초안을 가져와 요청 번호를 저장 사유에 넣어 반영하세요.</p>
    <label>요청 상태 <select className="min-h-11 border bg-transparent p-2" disabled={busy} value={status} onChange={e => { setStatus(e.target.value as api.GeometryStatus | ''); setDecision(null); setReason(''); setMessage(''); }}><option value="">전체</option>{Object.entries(STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <Button className="min-h-11" variant="outline" disabled={busy || loading} onClick={() => { setDecision(null); setMessage(''); setVersion(v => v + 1); }}>다시 불러오기</Button>{message && <p role="status">{message}</p>}{loading && <p role="status">요청을 불러오는 중…</p>}
    <ul className="space-y-6">{rows.map(row => <li className="space-y-3 border-b py-4 [overflow-wrap:anywhere]" key={row.id}><h2>요청 #{row.id} · 시장 #{row.marketId} · {KINDS[row.kind]} · {STATUS[row.status]}</h2><p>{row.description}</p><p>신청일 · 한국 시간 (KST): {historyTime(row.createdAt)}</p><GeometryPreview row={row} />{row.decisionReason && <p>결정 사유: {row.decisionReason}</p>}
      {row.status === 'APPROVED' && <a className="inline-flex min-h-11 items-center underline" href={`/admin/place/markets/${row.marketId}?geometryRequest=${row.id}`}>요청 #{row.id}을 편집기로 가져오기</a>}
      {row.status === 'PENDING' && <div className="flex gap-3">{(['APPROVE', 'REJECT'] as const).map(action => <Button className="min-h-11" variant="outline" key={action} disabled={busy || loading} onClick={() => { setDecision({ id: row.id, action }); setReason(''); }}>{action === 'APPROVE' ? '승인' : '반려'}</Button>)}</div>}
      {decision?.id === row.id && <div role="alert" className="space-y-3"><p>요청 #{row.id}을 {decision.action === 'APPROVE' ? '승인' : '반려'}할까요? 승인해도 지도는 바뀌지 않습니다.</p><label className="block">결정 사유 (필수)<textarea className="block min-h-11 w-full border bg-transparent p-2" required maxLength={2000} disabled={busy} value={reason} onChange={e => setReason(e.target.value)} /></label><Button className="min-h-11" disabled={busy || !reason.trim()} onClick={() => void decide()}>결정 확인</Button> <Button className="min-h-11" variant="outline" disabled={busy} onClick={() => setDecision(null)}>취소</Button></div>}
    </li>)}</ul>{!loading && !rows.length && <p>이 상태의 요청이 없습니다.</p>}
  </main>;
}
