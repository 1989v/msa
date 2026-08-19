import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  createDealOffer,
  deleteDealOffer,
  fetchDealAttention,
  listDealCategories,
  listDealOffers,
  updateDealOffer,
  type DealAttention,
  type DealCategory,
  type DealOffer,
  type DealOfferPayload,
  type DisplayStatus,
  type LinkStatus,
  type RevenueType,
} from '@/api/deals';

const STATUS_LABEL: Record<DisplayStatus, string> = {
  OPEN: '노출 중',
  PREOPEN: '노출 대기',
  HOLD: '내림',
};

const LINK_LABEL: Record<LinkStatus, string> = {
  OK: '정상',
  BROKEN: '깨짐',
  UNKNOWN: '미확인',
};

const EMPTY_FORM = {
  id: null as number | null,
  slug: '',
  categoryId: 0,
  merchant: '',
  title: '',
  benefit: '',
  summary: '',
  targetUrl: '',
  revenueType: 'AFFILIATE' as RevenueType,
  network: '',
  status: 'PREOPEN' as DisplayStatus,
  validFrom: '',
  validUntil: '',
  orderNo: 0,
};

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** `2026-08-19T00:00` (datetime-local) ↔ 서버의 ISO LocalDateTime */
function toLocalInput(value: string | null): string {
  return value ? value.slice(0, 16) : '';
}

export function DealOffersPage() {
  const [categories, setCategories] = useState<DealCategory[] | null>(null);
  const [offers, setOffers] = useState<DealOffer[] | null>(null);
  const [attention, setAttention] = useState<DealAttention | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterCategory, setFilterCategory] = useState<number | ''>('');

  const reload = useCallback(async () => {
    const [cats, list, att] = await Promise.all([
      listDealCategories(),
      listDealOffers(filterCategory === '' ? undefined : { categoryId: filterCategory }),
      fetchDealAttention(),
    ]);
    setCategories(cats);
    setOffers(list);
    setAttention(att);
  }, [filterCategory]);

  useEffect(() => {
    reload().catch(() => setMessage('불러오지 못했습니다'));
  }, [reload]);

  const run = async (action: () => Promise<void>, ok: string) => {
    try {
      await action();
      await reload();
      setMessage(ok);
    } catch {
      setMessage(
        '실패했습니다 — slug 는 소문자·숫자·하이픈, 링크는 https, 제휴 링크에는 네트워크가 필요합니다',
      );
    }
  };

  const categoryName = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c.label])),
    [categories],
  );

  if (!offers || !categories) {
    return (
      <div className="flex items-center gap-3 text-sm text-zinc-500">
        <span>{message ?? '불러오는 중…'}</span>
        {message && (
          <Button size="sm" variant="outline" onClick={() => { setMessage(null); reload().catch(() => setMessage('불러오지 못했습니다')); }}>
            다시 시도
          </Button>
        )}
      </div>
    );
  }

  const payload = (): DealOfferPayload => ({
    slug: form.slug.trim(),
    categoryId: form.categoryId,
    merchant: form.merchant.trim(),
    title: form.title.trim(),
    benefit: form.benefit.trim(),
    summary: blankToNull(form.summary),
    // **원본 그대로 보낸다.** trim 외에 어떤 가공도 하지 않는다 — 파라미터를 손대면
    // 네트워크 약관 위반이고 트래킹 쿠키가 깨진다.
    targetUrl: form.targetUrl.trim(),
    revenueType: form.revenueType,
    network: form.revenueType === 'AFFILIATE' ? blankToNull(form.network) : null,
    status: form.status,
    validFrom: blankToNull(form.validFrom),
    validUntil: blankToNull(form.validUntil),
    orderNo: form.orderNo,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">혜택 링크</h1>
          <p className="text-sm text-zinc-500">
            deal.1989v.com 에 노출되는 혜택 링크입니다. 만료된 링크는 자동으로 숨겨집니다.
          </p>
        </div>
        {message && <span className="text-sm text-zinc-500">{message}</span>}
      </div>

      {attention && <AttentionPanel attention={attention} />}

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-medium">오퍼 목록</h2>
          <select
            className="h-9 rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">전체 분류</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500">
              <tr>
                <th className="py-2 pr-3">분류</th>
                <th className="py-2 pr-3">제공처</th>
                <th className="py-2 pr-3">혜택</th>
                <th className="py-2 pr-3">slug</th>
                <th className="py-2 pr-3">수익</th>
                <th className="py-2 pr-3">종료</th>
                <th className="py-2 pr-3">클릭</th>
                <th className="py-2 pr-3">링크</th>
                <th className="py-2 pr-3">상태</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {offers.map((o) => (
                <tr
                  key={o.slug}
                  className={`border-t border-zinc-200 dark:border-zinc-800 ${
                    o.status === 'HOLD' ? 'text-zinc-400' : ''
                  }`}
                >
                  <td className="py-2 pr-3 text-zinc-500">{categoryName.get(o.categoryId) ?? o.categoryCode}</td>
                  <td className="py-2 pr-3">{o.merchant}</td>
                  <td className="py-2 pr-3 font-medium">{o.benefit}</td>
                  <td className="py-2 pr-3 font-mono text-xs text-zinc-500">{o.slug}</td>
                  <td className="py-2 pr-3 text-xs">
                    {o.revenueType === 'AFFILIATE' ? `제휴 · ${o.network ?? '—'}` : '일반'}
                  </td>
                  <td className="py-2 pr-3 text-xs text-zinc-500">
                    {o.validUntil ? o.validUntil.slice(0, 10) : '상시'}
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-zinc-500">{o.clickCount}</td>
                  <td className={`py-2 pr-3 text-xs ${o.linkStatus === 'BROKEN' ? 'text-red-500' : 'text-zinc-500'}`}>
                    {LINK_LABEL[o.linkStatus]}
                    {o.linkStatusCode ? ` (${o.linkStatusCode})` : ''}
                  </td>
                  <td className="py-2 pr-3">{STATUS_LABEL[o.status]}</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setForm({
                        id: o.id,
                        slug: o.slug,
                        categoryId: o.categoryId,
                        merchant: o.merchant,
                        title: o.title,
                        benefit: o.benefit,
                        summary: o.summary ?? '',
                        targetUrl: o.targetUrl,
                        revenueType: o.revenueType,
                        network: o.network ?? '',
                        status: o.status,
                        validFrom: toLocalInput(o.validFrom),
                        validUntil: toLocalInput(o.validUntil),
                        orderNo: o.orderNo,
                      })}
                    >
                      편집
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-2"
                      onClick={() => run(() => deleteDealOffer(o.id), '삭제했습니다')}
                    >
                      삭제
                    </Button>
                  </td>
                </tr>
              ))}
              {offers.length === 0 && (
                <tr><td colSpan={10} className="py-4 text-center text-zinc-500">아직 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <div className="grid gap-2 sm:grid-cols-4">
            <select
              className="h-9 rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700"
              value={form.categoryId || ''}
              onChange={(e) => setForm({ ...form, categoryId: Number(e.target.value) })}
            >
              <option value="">분류 선택</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <Input
              placeholder="slug (coupang-rocket)"
              value={form.slug}
              disabled={form.id !== null}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
            />
            <Input
              placeholder="제공처 (쿠팡)"
              value={form.merchant}
              onChange={(e) => setForm({ ...form, merchant: e.target.value })}
            />
            <Input
              placeholder="혜택 (최대 10% 적립)"
              value={form.benefit}
              onChange={(e) => setForm({ ...form, benefit: e.target.value })}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <Input
              className="sm:col-span-2"
              placeholder="제목 (로켓와우 신규가입)"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <Input
              className="sm:col-span-2"
              placeholder="한 줄 설명 (선택)"
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
            />
          </div>
          <Input
            placeholder="링크 (https://…)"
            value={form.targetUrl}
            onChange={(e) => setForm({ ...form, targetUrl: e.target.value })}
          />
          <p className="text-xs text-zinc-500">
            제휴사가 발급한 링크를 <strong>원본 그대로</strong> 붙여 넣으세요. 파라미터를 지우거나
            바꾸면 대부분 약관 위반이고 성과가 우리 계정으로 잡히지 않습니다.
          </p>
          <div className="grid gap-2 sm:grid-cols-4">
            <select
              className="h-9 rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700"
              value={form.revenueType}
              onChange={(e) => setForm({ ...form, revenueType: e.target.value as RevenueType })}
            >
              <option value="AFFILIATE">제휴 (수수료 발생)</option>
              <option value="PLAIN">일반 혜택 (수수료 없음)</option>
            </select>
            <Input
              placeholder="네트워크 (COUPANG_PARTNERS)"
              value={form.network}
              disabled={form.revenueType === 'PLAIN'}
              onChange={(e) => setForm({ ...form, network: e.target.value })}
            />
            <select
              className="h-9 rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as DisplayStatus })}
            >
              <option value="OPEN">노출 중</option>
              <option value="PREOPEN">노출 대기</option>
              <option value="HOLD">내림</option>
            </select>
            <Input
              type="number"
              value={form.orderNo}
              onChange={(e) => setForm({ ...form, orderNo: Number(e.target.value) })}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <label className="text-xs text-zinc-500">
              시작 (비우면 즉시)
              <Input
                type="datetime-local"
                value={form.validFrom}
                onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
              />
            </label>
            <label className="text-xs text-zinc-500">
              종료 (비우면 상시)
              <Input
                type="datetime-local"
                value={form.validUntil}
                onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
              />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => run(async () => {
                if (form.id === null) await createDealOffer(payload());
                else await updateDealOffer(form.id, payload());
                setForm(EMPTY_FORM);
              }, '저장했습니다')}
            >
              저장
            </Button>
            <Button variant="ghost" onClick={() => setForm(EMPTY_FORM)}>초기화</Button>
            {form.id !== null && (
              <span className="text-xs text-zinc-500">
                slug 는 바꿀 수 없습니다 — 이미 공유된 링크가 죽습니다.
              </span>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

/**
 * 방치를 막는 유일한 장치라 목록 위에 둔다. 아래로 밀면 보지 않게 되고,
 * 보지 않으면 죽은 링크가 그대로 남는다.
 */
function AttentionPanel({ attention }: { attention: DealAttention }) {
  const rows: Array<{ label: string; hint: string; items: DealOffer[] }> = [
    { label: '만료 임박', hint: '14일 이내 종료', items: attention.expiringSoon },
    { label: '오래 미수정', hint: '90일 이상 손대지 않음', items: attention.stale },
    { label: '링크 깨짐', hint: '404 · 410 확인됨', items: attention.broken },
  ];
  const total = rows.reduce((sum, r) => sum + r.items.length, 0);

  return (
    <Card className="p-4">
      <h2 className="mb-3 font-medium">
        점검 필요 {total > 0 && <span className="text-red-500">{total}</span>}
      </h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="text-sm font-medium">
              {row.label} <span className="tabular-nums text-zinc-500">{row.items.length}</span>
            </div>
            <div className="text-xs text-zinc-500">{row.hint}</div>
            <ul className="mt-2 space-y-1 text-xs">
              {row.items.slice(0, 5).map((o) => (
                <li key={o.slug} className="truncate">
                  {o.merchant} · {o.benefit}
                </li>
              ))}
              {row.items.length === 0 && <li className="text-zinc-400">없음</li>}
              {row.items.length > 5 && <li className="text-zinc-400">외 {row.items.length - 5}건</li>}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        링크 점검은 주 1회 자동 실행됩니다. <strong>미확인</strong>은 죽었다는 뜻이 아니라
        상대 서버가 자동 점검을 거부했다는 뜻이라 별도로 표시합니다.
      </p>
    </Card>
  );
}
