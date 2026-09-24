import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  getTrialBalance,
  listStatements,
  retryPayout,
  runSettlementBatch,
  STATEMENT_STATUSES,
  type Statement,
  type StatementStatus,
  type TrialBalance,
} from '@/api/settlements';

const STATUS_LABEL: Record<StatementStatus, string> = {
  DRAFT: '작성 중',
  CONFIRMED: '지급 대기',
  PAID: '지급 완료',
  CARRIED_OVER: '이월',
};

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = (err.response?.data as { error?: { message?: string } } | undefined)?.error?.message;
    if (msg) return msg;
  }
  return '실패했습니다';
}

/**
 * 정산 — 판매자 정산서 목록 · 지급 재시도 · 배치 즉시 실행, 그리고 원장 시산표.
 *
 * 정산서는 매일 05:30 KST 배치가 주기(주간·월간)가 닫힌 판매자마다 만든다. 송금이 실패해 「지급 대기」에 남은 정산서만
 * 재시도할 수 있다. 시산표의 합(차 − 대)이 0 이 아니면 원장이 깨진 것이다.
 */
export function SettlementsPage() {
  const [statusFilter, setStatusFilter] = useState<StatementStatus | ''>('');
  const [statements, setStatements] = useState<Statement[] | null>(null);
  const [trial, setTrial] = useState<TrialBalance | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const [list, tb] = await Promise.all([listStatements({ status: statusFilter || undefined }), getTrialBalance()]);
    setStatements(list);
    setTrial(tb);
  }, [statusFilter]);

  useEffect(() => {
    reload().catch((e) => setMessage(`불러오지 못했습니다 — ${errorMessage(e)}`));
  }, [reload]);

  const act = async (run: () => Promise<string>) => {
    setBusy(true);
    try {
      setMessage(await run());
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
          <h1 className="text-xl font-semibold">정산</h1>
          <p className="text-sm text-zinc-500">지급액 = 순매출 + 배송비 − 수수료. 환불된 라인은 정산서에 들어가지 않습니다.</p>
        </div>
        <div className="flex items-center gap-2">
          {message && <span className="text-sm text-zinc-500">{message}</span>}
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              act(async () => {
                const r = await runSettlementBatch();
                return `배치 — 생성 ${r.opened} · 지급 ${r.paid} · 이월 ${r.carriedOver} · 실패 ${r.failed}`;
              })
            }
          >
            배치 실행
          </Button>
        </div>
      </div>

      {trial && (
        <Card className="overflow-x-auto p-0">
          <div className="flex items-center justify-between p-3">
            <h2 className="font-medium">시산표</h2>
            <span className={trial.net === 0 ? 'text-sm text-zinc-500' : 'text-sm font-semibold text-red-500'}>
              차 − 대 합계 {won(trial.net)}
              {trial.net === 0 ? ' (균형)' : ' — 원장 불균형'}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="text-zinc-500">
              <tr>
                <th className="p-3 text-left">계정</th>
                <th className="p-3 text-right">차변</th>
                <th className="p-3 text-right">대변</th>
                <th className="p-3 text-right">잔액(차 − 대)</th>
              </tr>
            </thead>
            <tbody>
              {trial.accounts.map((a) => (
                <tr key={a.code} className="border-t border-zinc-800">
                  <td className="p-3">
                    <div>{a.name}</div>
                    <div className="font-mono text-xs text-zinc-500">{a.code}</div>
                  </td>
                  <td className="p-3 text-right font-mono">{won(a.debit)}</td>
                  <td className="p-3 text-right font-mono">{won(a.credit)}</td>
                  <td className="p-3 text-right font-mono">{won(a.balance)}</td>
                </tr>
              ))}
              <tr className="border-t border-zinc-700 font-semibold">
                <td className="p-3">합계</td>
                <td className="p-3 text-right font-mono">{won(trial.totalDebit)}</td>
                <td className="p-3 text-right font-mono">{won(trial.totalCredit)}</td>
                <td className="p-3 text-right font-mono">{won(trial.net)}</td>
              </tr>
            </tbody>
          </table>
          {trial.sellerPayables.length > 0 && (
            <div className="border-t border-zinc-800 p-3 text-xs text-zinc-500">
              판매자 미지급금 잔액 —{' '}
              {trial.sellerPayables.map((p) => `판매자 ${p.sellerId}: ${won(p.balance)}`).join(' · ')}
            </div>
          )}
        </Card>
      )}

      <div className="flex items-center gap-2 text-sm">
        <span className="text-zinc-500">상태</span>
        <select
          className="rounded border border-zinc-700 bg-transparent p-1"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatementStatus | '')}
        >
          <option value="">전체</option>
          {STATEMENT_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        {statements && <span className="text-zinc-500">{statements.length}건 (최근 200건까지)</span>}
      </div>

      {!statements ? (
        <div className="text-sm text-zinc-500">{message ?? '불러오는 중…'}</div>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-zinc-500">
              <tr>
                <th className="p-3 text-left">정산서</th>
                <th className="p-3 text-left">기간</th>
                <th className="p-3 text-right">순매출</th>
                <th className="p-3 text-right">배송비</th>
                <th className="p-3 text-right">수수료</th>
                <th className="p-3 text-right">지급액</th>
                <th className="p-3 text-left">상태</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {statements.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-zinc-500">정산서가 없습니다</td>
                </tr>
              )}
              {statements.map((s) => (
                <tr key={s.id} className="border-t border-zinc-800 align-top">
                  <td className="p-3">
                    <div className="font-mono text-xs">#{s.id} · 판매자 {s.sellerId}</div>
                    <div className="text-xs text-zinc-500">{s.lineCount}건</div>
                  </td>
                  <td className="p-3 font-mono text-xs">{s.periodStart} ~ {s.periodEnd}</td>
                  <td className="p-3 text-right font-mono">{won(s.netSales)}</td>
                  <td className="p-3 text-right font-mono">{won(s.shippingFee)}</td>
                  <td className="p-3 text-right font-mono">{won(s.commission)}</td>
                  <td className="p-3 text-right font-mono font-semibold">{won(s.payout)}</td>
                  <td className="p-3">
                    <div>{STATUS_LABEL[s.status]}</div>
                    {s.payoutReference && <div className="font-mono text-xs text-zinc-500">{s.payoutReference}</div>}
                  </td>
                  <td className="whitespace-nowrap p-3 text-right">
                    {s.status === 'CONFIRMED' && (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          act(async () => {
                            const r = await retryPayout(s.id);
                            return `정산서 #${r.id} — ${STATUS_LABEL[r.status]}`;
                          })
                        }
                      >
                        지급 재시도
                      </Button>
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
