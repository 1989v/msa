import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import {
  REJECT_REASON_LABEL,
  adsErrorMessage,
  approveCreative,
  listPendingCreatives,
  rejectCreative,
  type AdminCreative,
  type CreativeRejectReason,
} from '@/api/ads';
import { AdminPreviewImage } from './AdsPreviewImage';

const REASONS = Object.keys(REJECT_REASON_LABEL) as CreativeRejectReason[];

/**
 * 광고 소재 심사 큐 (ADR-0098) — 심사 대기(PENDING) 소재를 승인하거나 사유 코드와 함께 반려한다.
 * 승인은 다음 후보 인덱스 갱신(1분 안)에 게재 대상이 된다. 광고주가 적은 문자열은 텍스트로만 그린다.
 */
export function AdsReviewPage() {
  const [items, setItems] = useState<AdminCreative[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<number, CreativeRejectReason>>({});

  const reload = useCallback(async () => {
    setItems(await listPendingCreatives());
  }, []);

  useEffect(() => {
    reload().catch(() => setMessage('불러오지 못했습니다'));
  }, [reload]);

  const run = async (action: () => Promise<unknown>, ok: string) => {
    try {
      await action();
      await reload();
      setMessage(ok);
    } catch (err) {
      setMessage(adsErrorMessage(err, '실패했습니다'));
    }
  };

  if (!items) {
    return <div className="text-sm text-zinc-500">{message ?? '불러오는 중…'}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">광고 심사</h1>
          <p className="text-sm text-zinc-500">
            심사 대기 소재 {items.length}건. 반려는 사유 코드가 필요하고, 광고주 콘솔에 그대로 보입니다.
          </p>
        </div>
        {message && <span className="text-sm text-zinc-500">{message}</span>}
      </div>

      {items.length === 0 && <p className="text-sm text-zinc-500">심사할 소재가 없습니다.</p>}

      <div className="space-y-3">
        {items.map((creative) => {
          const reason = reasons[creative.id] ?? 'MISLEADING';
          return (
            <Card key={creative.id} className="grid gap-4 p-4 md:grid-cols-[240px_1fr]" data-testid="ads-review-item">
              {creative.imageUrl ? (
                <AdminPreviewImage url={creative.imageUrl} alt={creative.title} />
              ) : (
                <div className="aspect-[1.91/1] w-full rounded-md bg-zinc-100 dark:bg-zinc-800" />
              )}
              <div className="min-w-0 space-y-2">
                <div className="font-mono text-xs text-zinc-500">
                  소재 #{creative.id} · 캠페인 #{creative.campaignId} · 광고주 #{creative.advertiserId}
                </div>
                <p className="break-words font-semibold">{creative.title}</p>
                <p className="break-words text-sm text-zinc-600 dark:text-zinc-300">{creative.body}</p>
                <p className="break-all font-mono text-xs text-zinc-500">{creative.link}</p>
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <Button size="sm" onClick={() => run(() => approveCreative(creative.id), '승인했습니다')}>
                    승인
                  </Button>
                  <Select
                    aria-label="반려 사유"
                    className="h-8 text-xs"
                    value={reason}
                    onChange={(e) =>
                      setReasons((prev) => ({ ...prev, [creative.id]: e.target.value as CreativeRejectReason }))
                    }
                  >
                    {REASONS.map((code) => (
                      <option key={code} value={code}>
                        {REJECT_REASON_LABEL[code]}
                      </option>
                    ))}
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => run(() => rejectCreative(creative.id, reason), '반려했습니다')}
                  >
                    반려
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
