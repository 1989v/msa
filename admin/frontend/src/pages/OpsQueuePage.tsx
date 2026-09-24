import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  closeOpsIssue,
  listOpsIssues,
  mergeOpsQueue,
  OPS_DOMAINS,
  OPS_STATUSES,
  retryOpsIssue,
  type OpsDomainKey,
  type OpsIssueStatus,
  type OpsQueue,
  type OpsQueueItem,
} from '@/api/opsIssues';

const STATUS_LABEL: Record<OpsIssueStatus, string> = { OPEN: '열림', RETRIED: '재시도함', CLOSED: '종결' };

const TYPE_LABEL: Record<string, string> = {
  DLT: 'DLT(처리 실패 메시지)',
  SAGA_STUCK: '사가 체류',
  CLAIM_STUCK: '클레임 체류',
  PAYMENT_UNKNOWN: '결제 결과 미상',
  RECON_MISMATCH: '대사 불일치',
};

const time = (iso: string) => new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = (err.response?.data as { error?: { message?: string } } | undefined)?.error?.message;
    if (msg) return msg;
  }
  return '실패했습니다';
}

/**
 * 운영 큐 — 커머스 여덟 도메인의 운영 이슈를 한 목록으로. 도메인 API 를 동시에 부르고, 한 도메인이 실패해도 나머지를 보여 준다.
 *
 * 재시도는 종류마다 다르다 — DLT 는 원 토픽 재발행, 사가·클레임 체류는 멈춘 단계부터 재개, 결제 미상은 재조회, 대사 불일치는 재대사.
 * 종결에는 사유가 필요하고, 처리자와 시각이 행에 남는다.
 */
export function OpsQueuePage() {
  const [statusFilter, setStatusFilter] = useState<OpsIssueStatus | ''>('OPEN');
  const [domainFilter, setDomainFilter] = useState<OpsDomainKey | ''>('');
  const [typeFilter, setTypeFilter] = useState('');
  const [queue, setQueue] = useState<OpsQueue | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setQueue(await mergeOpsQueue(OPS_DOMAINS, (d) => listOpsIssues(d, statusFilter || undefined)));
  }, [statusFilter]);

  useEffect(() => {
    reload().catch((e) => setMessage(`불러오지 못했습니다 — ${errorMessage(e)}`));
  }, [reload]);

  const types = useMemo(() => [...new Set(queue?.items.map((i) => i.type) ?? [])].sort(), [queue]);
  const rows = useMemo(
    () =>
      (queue?.items ?? []).filter(
        (i) => (!domainFilter || i.domain.key === domainFilter) && (!typeFilter || i.type === typeFilter),
      ),
    [queue, domainFilter, typeFilter],
  );

  const act = async (item: OpsQueueItem, kind: 'retry' | 'close') => {
    const reason = window.prompt(kind === 'close' ? '종결 사유(필수)' : '재시도 사유(선택)') ?? undefined;
    if (reason === undefined) return;
    if (kind === 'close' && !reason.trim()) {
      setMessage('종결 사유가 필요합니다');
      return;
    }
    setBusy(true);
    try {
      if (kind === 'retry') await retryOpsIssue(item.domain, item.id, reason.trim() || undefined);
      else await closeOpsIssue(item.domain, item.id, reason.trim());
      setMessage(`${item.domain.label} #${item.id} ${kind === 'retry' ? '재시도' : '종결'} 완료`);
      await reload();
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">운영 큐</h1>
          <p className="text-sm text-zinc-500">
            커머스 도메인의 운영 이슈를 한 목록으로 봅니다. DLT 는 재시도하면 원래 토픽으로 다시 보냅니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {message && <span className="text-sm text-zinc-500">{message}</span>}
          <Button size="sm" variant="outline" disabled={busy} onClick={() => reload().catch((e) => setMessage(errorMessage(e)))}>
            새로고침
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1">
          <span className="text-zinc-500">상태</span>
          <select
            className="rounded border border-zinc-700 bg-transparent p-1"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as OpsIssueStatus | '')}
          >
            <option value="">전체</option>
            {OPS_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <span className="text-zinc-500">도메인</span>
          <select
            className="rounded border border-zinc-700 bg-transparent p-1"
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value as OpsDomainKey | '')}
          >
            <option value="">전체</option>
            {OPS_DOMAINS.map((d) => (
              <option key={d.key} value={d.key}>{d.label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <span className="text-zinc-500">종류</span>
          <select className="rounded border border-zinc-700 bg-transparent p-1" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">전체</option>
            {types.map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>
            ))}
          </select>
        </label>
        {queue && <span className="text-zinc-500">{rows.length}건 (도메인당 최근 100건까지)</span>}
      </div>

      {queue && queue.failed.length > 0 && (
        <div role="alert" className="rounded border border-red-500/40 p-3 text-sm text-red-500">
          불러오지 못한 도메인: {queue.failed.map((d) => d.label).join(' · ')} — 나머지 도메인은 아래에 있습니다.
        </div>
      )}

      {!queue ? (
        <div className="text-sm text-zinc-500">{message ?? '불러오는 중…'}</div>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-zinc-500">
              <tr>
                <th className="p-3 text-left">도메인 · 종류</th>
                <th className="p-3 text-left">대상 · 내용</th>
                <th className="p-3 text-left">상태</th>
                <th className="p-3 text-left">처리</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-zinc-500">운영 이슈가 없습니다</td>
                </tr>
              )}
              {rows.map((i) => (
                <tr key={`${i.domain.key}-${i.id}`} className="border-t border-zinc-800 align-top">
                  <td className="p-3">
                    <div>{i.domain.label}</div>
                    <div className="text-xs text-zinc-500">{TYPE_LABEL[i.type] ?? i.type}</div>
                  </td>
                  <td className="max-w-xl p-3">
                    <div className="break-all font-mono text-xs">#{i.id} · {i.targetId}</div>
                    <div className="break-words text-xs text-zinc-500">{i.detail}</div>
                    <div className="text-xs text-zinc-500">생성 {time(i.createdAt)}</div>
                  </td>
                  <td className="p-3">{STATUS_LABEL[i.status] ?? i.status}</td>
                  <td className="p-3 text-xs text-zinc-500">
                    {i.actorId ? (
                      <>
                        <div>{i.actorId} · {time(i.updatedAt)}</div>
                        {i.reason && <div className="break-words">{i.reason}</div>}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-3">
                    {i.status !== 'CLOSED' && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => act(i, 'retry')}>재시도</Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => act(i, 'close')}>종결</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
