import { useCallback, useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/common/Pagination';
import {
  createCouponDefinition,
  grantPoints,
  listCouponDefinitions,
  type CouponBearer,
  type CouponDefinition,
  type CouponDefinitionPage,
  type CouponType,
  type CreateCouponDefinition,
} from '@/api/promotions';

const PAGE_SIZE = 20;
const MAX_BP = 10_000;

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
const INT = /^\d+$/;

function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = (err.response?.data as { error?: { message?: string } } | undefined)?.error?.message;
    if (msg) return msg;
  }
  return '실패했습니다';
}

/** datetime-local(브라우저 시간대) → 서버 Instant */
const toInstant = (local: string) => new Date(local).toISOString();

const formatInstant = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function describeBenefit(d: CouponDefinition): string {
  if (d.type === 'FIXED') return `${won(d.amount ?? 0)} 할인`;
  const rate = `${((d.rateBp ?? 0) / 100).toFixed(2)}%`;
  return d.maxDiscount != null ? `${rate} · 최대 ${won(d.maxDiscount)}` : rate;
}

/**
 * 혜택 — 쿠폰 정의 목록·만들기, 포인트 지급(데모).
 * 발행 상한은 서버가 조건부 UPDATE 로 지킨다. 만든 사람과 지급 사유가 서버에 남는다.
 */
export function PromotionsPage() {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<CouponDefinitionPage | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setData(await listCouponDefinitions(page, PAGE_SIZE));
  }, [page]);

  useEffect(() => {
    reload().catch((e) => setMessage(`불러오지 못했습니다 — ${errorMessage(e)}`));
  }, [reload]);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">혜택</h1>
          <p className="text-sm text-zinc-500">
            쿠폰 정의를 만들고, 데모용으로 회원에게 포인트를 지급합니다. 판매자 부담 쿠폰은 그 판매자 상품에만 적용됩니다.
          </p>
        </div>
        {message && <span className="text-sm text-zinc-500">{message}</span>}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <CouponCreateForm
          onCreated={async (d) => {
            setMessage(`쿠폰 정의 #${d.id} ${d.name} 을 만들었습니다`);
            setPage(0);
            await reload().catch(() => setMessage('목록을 다시 불러오지 못했습니다'));
          }}
        />
        <PointGrantForm onGranted={setMessage} />
      </div>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">
          쿠폰 정의 {data && <span className="text-sm font-normal text-zinc-500">{data.total}건</span>}
        </h2>
        {!data ? (
          <div className="text-sm text-zinc-500">{message ?? '불러오는 중…'}</div>
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="text-zinc-500">
                <tr>
                  <th className="p-3 text-left">이름</th>
                  <th className="p-3 text-left">혜택</th>
                  <th className="p-3 text-left">최소 주문</th>
                  <th className="p-3 text-left">기간</th>
                  <th className="p-3 text-left">발행</th>
                  <th className="p-3 text-left">부담</th>
                  <th className="p-3 text-left">상태</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-zinc-500">아직 쿠폰 정의가 없습니다</td>
                  </tr>
                )}
                {data.items.map((d) => (
                  <tr key={d.id} className="border-t border-zinc-800 align-top">
                    <td className="p-3">
                      <div className="font-medium">{d.name}</div>
                      <div className="font-mono text-xs text-zinc-500">#{d.id}</div>
                    </td>
                    <td className="p-3 text-xs">{describeBenefit(d)}</td>
                    <td className="p-3 font-mono text-xs">{won(d.minOrderAmount)}</td>
                    <td className="p-3 font-mono text-xs">
                      <div>{formatInstant(d.validFrom)}</div>
                      <div className="text-zinc-500">~ {formatInstant(d.validUntil)}</div>
                    </td>
                    <td className="p-3 font-mono text-xs">
                      {d.issuedCount.toLocaleString('ko-KR')} / {d.issueLimit.toLocaleString('ko-KR')}
                    </td>
                    <td className="p-3 text-xs">{d.bearer === 'PLATFORM' ? '플랫폼' : `판매자 #${d.sellerId}`}</td>
                    <td className="p-3 text-xs">{d.status === 'ACTIVE' ? '활성' : '비활성'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
        {data && totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
      </section>
    </div>
  );
}

interface CouponFormValues {
  name: string;
  type: CouponType;
  amount: string;
  rateBp: string;
  maxDiscount: string;
  minOrderAmount: string;
  validFrom: string;
  validUntil: string;
  issueLimit: string;
  bearer: CouponBearer;
  sellerId: string;
}

const EMPTY_COUPON: CouponFormValues = {
  name: '',
  type: 'FIXED',
  amount: '',
  rateBp: '',
  maxDiscount: '',
  minOrderAmount: '0',
  validFrom: '',
  validUntil: '',
  issueLimit: '',
  bearer: 'PLATFORM',
  sellerId: '',
};

/** 서버 검증과 같은 조건을 먼저 본다 — 통과하면 요청 본문을, 아니면 오류 문구를 준다 */
function toCreateRequest(v: CouponFormValues): CreateCouponDefinition | string {
  if (!v.name.trim()) return '이름을 입력해 주세요.';
  if (v.type === 'FIXED' && (!INT.test(v.amount) || Number(v.amount) < 1)) return '정액 할인 금액은 1원 이상의 정수입니다.';
  if (v.type === 'RATE') {
    if (!INT.test(v.rateBp) || Number(v.rateBp) < 1 || Number(v.rateBp) > MAX_BP) return `할인율은 1~${MAX_BP} bp 입니다. 1000bp = 10%`;
    if (v.maxDiscount !== '' && (!INT.test(v.maxDiscount) || Number(v.maxDiscount) < 1)) return '최대 할인은 1원 이상의 정수입니다.';
  }
  if (!INT.test(v.minOrderAmount)) return '최소 주문 금액은 0 이상의 정수입니다.';
  if (!v.validFrom || !v.validUntil) return '기간을 입력해 주세요.';
  if (new Date(v.validFrom) >= new Date(v.validUntil)) return '종료가 시작보다 뒤여야 합니다.';
  if (!INT.test(v.issueLimit) || Number(v.issueLimit) < 1) return '발행 상한은 1 이상의 정수입니다.';
  if (v.bearer === 'SELLER' && (!INT.test(v.sellerId) || Number(v.sellerId) < 1)) return '판매자 부담 쿠폰은 판매자 id 가 필요합니다.';
  return {
    name: v.name.trim(),
    type: v.type,
    amount: v.type === 'FIXED' ? Number(v.amount) : null,
    rateBp: v.type === 'RATE' ? Number(v.rateBp) : null,
    maxDiscount: v.type === 'RATE' && v.maxDiscount !== '' ? Number(v.maxDiscount) : null,
    minOrderAmount: Number(v.minOrderAmount),
    validFrom: toInstant(v.validFrom),
    validUntil: toInstant(v.validUntil),
    issueLimit: Number(v.issueLimit),
    bearer: v.bearer,
    sellerId: v.bearer === 'SELLER' ? Number(v.sellerId) : null,
  };
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-zinc-500">{label}</span>
      {children}
      {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

const selectClass = 'h-9 w-full rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700';

function CouponCreateForm({ onCreated }: { onCreated: (d: CouponDefinition) => Promise<void> }) {
  const [v, setV] = useState<CouponFormValues>(EMPTY_COUPON);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof CouponFormValues) => (e: { target: { value: string } }) => setV((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const req = toCreateRequest(v);
    if (typeof req === 'string') {
      setError(req);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const created = await createCouponDefinition(req);
      setV(EMPTY_COUPON);
      await onCreated(created);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-4">
      <form className="space-y-3 text-sm" onSubmit={submit}>
        <h2 className="text-base font-semibold">쿠폰 정의 만들기</h2>
        <Field label="이름">
          <Input maxLength={100} value={v.name} onChange={set('name')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="유형">
            <select className={selectClass} value={v.type} onChange={set('type')}>
              <option value="FIXED">정액</option>
              <option value="RATE">정률</option>
            </select>
          </Field>
          {v.type === 'FIXED' ? (
            <Field label="할인 금액 (원)">
              <Input inputMode="numeric" value={v.amount} onChange={set('amount')} />
            </Field>
          ) : (
            <Field label="할인율 (bp)" hint={INT.test(v.rateBp) ? `= ${(Number(v.rateBp) / 100).toFixed(2)}%` : '1000bp = 10%'}>
              <Input inputMode="numeric" value={v.rateBp} onChange={set('rateBp')} />
            </Field>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {v.type === 'RATE' && (
            <Field label="최대 할인 (원, 선택)">
              <Input inputMode="numeric" value={v.maxDiscount} onChange={set('maxDiscount')} />
            </Field>
          )}
          <Field label="최소 주문 금액 (원)" hint="배송비 제외 상품 금액 기준">
            <Input inputMode="numeric" value={v.minOrderAmount} onChange={set('minOrderAmount')} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="시작 (포함)">
            <Input type="datetime-local" value={v.validFrom} onChange={set('validFrom')} />
          </Field>
          <Field label="종료 (제외)">
            <Input type="datetime-local" value={v.validUntil} onChange={set('validUntil')} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="발행 상한 (장)">
            <Input inputMode="numeric" value={v.issueLimit} onChange={set('issueLimit')} />
          </Field>
          <Field label="부담 주체">
            <select className={selectClass} value={v.bearer} onChange={set('bearer')}>
              <option value="PLATFORM">플랫폼</option>
              <option value="SELLER">판매자</option>
            </select>
          </Field>
        </div>
        {v.bearer === 'SELLER' && (
          <Field label="판매자 id" hint="그 판매자 상품에만 적용되고, 최소 주문 금액도 그 판매자 상품 기준입니다">
            <Input inputMode="numeric" value={v.sellerId} onChange={set('sellerId')} />
          </Field>
        )}
        {error && <p className="text-xs text-red-500" role="alert">{error}</p>}
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>{saving ? '만드는 중…' : '만들기'}</Button>
        </div>
      </form>
    </Card>
  );
}

function PointGrantForm({ onGranted }: { onGranted: (message: string) => void }) {
  const [memberId, setMemberId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!memberId.trim()) return setError('회원 id 를 입력해 주세요.');
    if (!INT.test(amount) || Number(amount) < 1) return setError('지급액은 1 이상의 정수입니다.');
    if (!reason.trim()) return setError('사유를 입력해 주세요.');
    setError(null);
    setSaving(true);
    try {
      const r = await grantPoints(memberId.trim(), Number(amount), reason.trim());
      setAmount('');
      setReason('');
      onGranted(`회원 ${r.memberId} 에게 ${won(Number(amount))} 지급 — 잔액 ${won(r.balance)}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-4">
      <form className="space-y-3 text-sm" onSubmit={submit}>
        <h2 className="text-base font-semibold">포인트 지급</h2>
        <p className="text-xs text-zinc-500">데모용 지급입니다. 원장에 사유와 지급한 관리자가 남습니다.</p>
        <Field label="회원 id">
          <Input maxLength={64} value={memberId} onChange={(e) => setMemberId(e.target.value)} />
        </Field>
        <Field label="지급액 (원)">
          <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="사유 (필수)">
          <textarea
            className="w-full rounded-md border border-zinc-300 bg-transparent p-2 text-sm dark:border-zinc-700"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        {error && <p className="text-xs text-red-500" role="alert">{error}</p>}
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>{saving ? '지급 중…' : '지급'}</Button>
        </div>
      </form>
    </Card>
  );
}
