import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/common/Pagination';
import {
  approveSeller,
  changeSellerCommission,
  listSellers,
  reactivateSeller,
  rejectSeller,
  SELLER_STATUSES,
  suspendSeller,
  type Seller,
  type SellerPage,
  type SellerStatus,
} from '@/api/sellers';

const STATUS_LABEL: Record<SellerStatus, string> = {
  PENDING: '심사 대기',
  ACTIVE: '활성',
  SUSPENDED: '정지',
  REJECTED: '반려',
};

const CYCLE_LABEL = { WEEKLY: '매주', MONTHLY: '매월' } as const;

const PAGE_SIZE = 20;
const MAX_BP = 10_000;

type Action = 'approve' | 'reject' | 'suspend' | 'reactivate' | 'commission';

const ACTION_TITLE: Record<Action, string> = {
  approve: '입점 승인',
  reject: '입점 반려',
  suspend: '판매자 정지',
  reactivate: '판매자 재활성',
  commission: '수수료율 변경',
};

/** 사유가 필수인 조치 — 서버도 빈 사유를 400 으로 돌려보낸다 */
const REASON_REQUIRED: Record<Action, boolean> = {
  approve: false,
  reject: true,
  suspend: true,
  reactivate: false,
  commission: true,
};

const NEEDS_BP: Record<Action, boolean> = {
  approve: true,
  reject: false,
  suspend: false,
  reactivate: false,
  commission: true,
};

const formatBp = (bp: number | null) => (bp == null ? '—' : `${(bp / 100).toFixed(2)}% (${bp}bp)`);

function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = (err.response?.data as { error?: { message?: string } } | undefined)?.error?.message;
    if (msg) return msg;
  }
  return '실패했습니다';
}

/**
 * 판매자 관리 — 입점 승인·반려, 정지·재활성, 수수료율.
 *
 * 조치마다 행위자와 사유가 이력으로 남는다. 승인·정지·재활성은 판매자 역할(ROLE_SELLER)
 * 부여·회수로 이어지지만, 판매 가능 여부는 역할이 아니라 이 상태가 매 요청 정한다 —
 * 정지는 토큰 만료를 기다리지 않고 다음 요청부터 먹는다.
 */
export function SellersPage() {
  const [statusFilter, setStatusFilter] = useState<SellerStatus | ''>('PENDING');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<SellerPage | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [target, setTarget] = useState<{ seller: Seller; action: Action } | null>(null);

  const reload = useCallback(async () => {
    setData(await listSellers({ status: statusFilter || undefined, page, size: PAGE_SIZE }));
  }, [statusFilter, page]);

  useEffect(() => {
    reload().catch((e) => setMessage(`불러오지 못했습니다 — ${errorMessage(e)}`));
  }, [reload]);

  const totalPages = data ? Math.ceil(data.totalElements / PAGE_SIZE) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">판매자</h1>
          <p className="text-sm text-zinc-500">
            승인할 때 수수료율을 정합니다. 반려·정지·수수료율 변경은 사유가 필요하고 이력으로 남습니다.
          </p>
        </div>
        {message && <span className="text-sm text-zinc-500">{message}</span>}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-zinc-500">상태</span>
        <select
          className="rounded border border-zinc-700 bg-transparent p-1"
          value={statusFilter}
          onChange={(e) => {
            setPage(0);
            setStatusFilter(e.target.value as SellerStatus | '');
          }}
        >
          <option value="">전체</option>
          {SELLER_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        {data && <span className="text-zinc-500">{data.totalElements}건</span>}
      </div>

      {!data ? (
        <div className="text-sm text-zinc-500">{message ?? '불러오는 중…'}</div>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-zinc-500">
              <tr>
                <th className="p-3 text-left">상호</th>
                <th className="p-3 text-left">사업자번호 · 대표자</th>
                <th className="p-3 text-left">정산</th>
                <th className="p-3 text-left">수수료율</th>
                <th className="p-3 text-left">상태</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-zinc-500">해당 상태의 판매자가 없습니다</td>
                </tr>
              )}
              {data.items.map((s) => (
                <tr key={s.id} className="border-t border-zinc-800 align-top">
                  <td className="p-3">
                    <div className="font-medium">{s.businessName}</div>
                    <div className="font-mono text-xs text-zinc-500">#{s.id} · 회원 {s.memberId}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-mono text-xs">{s.businessRegistrationNo ?? '파기됨'}</div>
                    <div className="text-xs text-zinc-500">{s.representativeName ?? '—'}</div>
                  </td>
                  <td className="p-3 text-xs">
                    <div>
                      {s.bankName ?? '—'} <span className="font-mono">{s.accountMasked ?? ''}</span>
                    </div>
                    <div className="text-zinc-500">
                      {CYCLE_LABEL[s.settlementCycle]} · 배송비 {s.shippingFee.toLocaleString('ko-KR')}원
                    </div>
                  </td>
                  <td className="p-3 font-mono text-xs">{formatBp(s.commissionRateBp)}</td>
                  <td className="p-3">
                    <div>{STATUS_LABEL[s.status]}</div>
                    {s.rejectReason && <div className="max-w-xs text-xs text-zinc-500">{s.rejectReason}</div>}
                  </td>
                  <td className="space-x-1 whitespace-nowrap p-3 text-right">
                    {s.status === 'PENDING' && (
                      <>
                        <Button size="sm" onClick={() => setTarget({ seller: s, action: 'approve' })}>승인</Button>
                        <Button size="sm" variant="outline" onClick={() => setTarget({ seller: s, action: 'reject' })}>반려</Button>
                      </>
                    )}
                    {s.status === 'ACTIVE' && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setTarget({ seller: s, action: 'commission' })}>수수료율</Button>
                        <Button size="sm" variant="destructive" onClick={() => setTarget({ seller: s, action: 'suspend' })}>정지</Button>
                      </>
                    )}
                    {s.status === 'SUSPENDED' && (
                      <Button size="sm" variant="outline" onClick={() => setTarget({ seller: s, action: 'reactivate' })}>재활성</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {data && totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}

      {target && (
        <SellerActionDialog
          seller={target.seller}
          action={target.action}
          onClose={() => setTarget(null)}
          onDone={async (ok) => {
            setTarget(null);
            setMessage(ok);
            await reload().catch(() => setMessage('목록을 다시 불러오지 못했습니다'));
          }}
        />
      )}
    </div>
  );
}

function SellerActionDialog({
  seller,
  action,
  onClose,
  onDone,
}: {
  seller: Seller;
  action: Action;
  onClose: () => void;
  onDone: (message: string) => Promise<void>;
}) {
  const [bp, setBp] = useState(seller.commissionRateBp != null ? String(seller.commissionRateBp) : '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const bpValue = Number(bp);
    if (NEEDS_BP[action] && (!/^\d+$/.test(bp.trim()) || bpValue > MAX_BP)) {
      setError(`수수료율은 0~${MAX_BP} 사이의 정수(bp)입니다. 1000bp = 10%`);
      return;
    }
    if (REASON_REQUIRED[action] && !reason.trim()) {
      setError('사유를 입력해 주세요.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const r = reason.trim();
      if (action === 'approve') await approveSeller(seller.id, bpValue, r);
      else if (action === 'reject') await rejectSeller(seller.id, r);
      else if (action === 'suspend') await suspendSeller(seller.id, r);
      else if (action === 'reactivate') await reactivateSeller(seller.id, r);
      else await changeSellerCommission(seller.id, bpValue, r);
      await onDone(`${seller.businessName} — ${ACTION_TITLE[action]} 완료`);
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  return (
    <Dialog open title={`${ACTION_TITLE[action]} — ${seller.businessName}`} onClose={onClose}>
      <div className="space-y-4 text-sm">
        {NEEDS_BP[action] && (
          <label className="block space-y-1">
            <span className="text-zinc-500">수수료율 (bp, 1000 = 10%)</span>
            <Input inputMode="numeric" value={bp} onChange={(e) => setBp(e.target.value)} />
            {/^\d+$/.test(bp.trim()) && <span className="text-xs text-zinc-500">= {(Number(bp) / 100).toFixed(2)}%</span>}
          </label>
        )}
        <label className="block space-y-1">
          <span className="text-zinc-500">사유{REASON_REQUIRED[action] ? ' (필수)' : ' (선택)'}</span>
          <textarea
            className="w-full rounded-md border border-zinc-300 bg-transparent p-2 text-sm dark:border-zinc-700"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {action === 'suspend' && (
          <p className="text-xs text-zinc-500">정지하면 이 판매자의 상품은 다음 요청부터 판매가 막힙니다. 진행 중인 주문은 계속 이행합니다.</p>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button variant={action === 'suspend' || action === 'reject' ? 'destructive' : 'default'} disabled={saving} onClick={submit}>
            {saving ? '처리 중…' : ACTION_TITLE[action]}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
