import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  adsErrorMessage,
  listAdvertisers,
  suspendAdvertiser,
  unsuspendAdvertiser,
  type AdminAdvertiser,
} from '@/api/ads';

/**
 * 광고주 (ADR-0098) — 정지·해제. 정지된 광고주는 조회만 되고, 캠페인은 1분 안에 게재 후보에서 빠진다.
 * 정지 사유는 광고주 콘솔에 그대로 보인다. 「1989v 하우스」(SYSTEM)는 정지 대상이 아니다.
 */
export function AdsAdvertisersPage() {
  const [items, setItems] = useState<AdminAdvertiser[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<number, string>>({});

  const reload = useCallback(async () => {
    setItems(await listAdvertisers());
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

  if (!items) return <div className="text-sm text-zinc-500">{message ?? '불러오는 중…'}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">광고주</h1>
          <p className="text-sm text-zinc-500">정지하면 쓰기가 막히고 게재가 멈춥니다. 사유는 광고주에게 보입니다.</p>
        </div>
        {message && <span className="text-sm text-zinc-500">{message}</span>}
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-zinc-500">
            <tr>
              <th className="p-3 text-left">id</th>
              <th className="p-3 text-left">이름</th>
              <th className="p-3 text-left">종류</th>
              <th className="p-3 text-left">회원</th>
              <th className="p-3 text-left">상태</th>
              <th className="p-3 text-left">정지 사유</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="border-t border-zinc-800">
                <td className="p-3 font-mono text-xs">{a.id}</td>
                <td className="p-3">{a.displayName}</td>
                <td className="p-3">{a.kind === 'SYSTEM' ? '하우스' : '회원'}</td>
                <td className="p-3 font-mono text-xs">{a.memberId ?? '—'}</td>
                <td className="p-3">{a.status === 'ACTIVE' ? '활성' : '정지'}</td>
                <td className="p-3 text-xs text-zinc-500">
                  {a.suspendReason ? `${a.suspendReason} · 운영자 #${a.suspendedBy ?? '—'} · ${a.suspendedAt ?? ''}` : '—'}
                </td>
                <td className="p-3 text-right">
                  {a.kind === 'MEMBER' && a.status === 'ACTIVE' && (
                    <div className="flex items-center justify-end gap-2">
                      <Input
                        aria-label={`정지 사유 ${a.id}`}
                        className="h-8 w-48 text-xs"
                        placeholder="정지 사유"
                        maxLength={255}
                        value={reasons[a.id] ?? ''}
                        onChange={(e) => setReasons((prev) => ({ ...prev, [a.id]: e.target.value }))}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!(reasons[a.id] ?? '').trim()}
                        onClick={() => run(() => suspendAdvertiser(a.id, (reasons[a.id] ?? '').trim()), '정지했습니다')}
                      >
                        정지
                      </Button>
                    </div>
                  )}
                  {a.status === 'SUSPENDED' && (
                    <Button size="sm" variant="outline" onClick={() => run(() => unsuspendAdvertiser(a.id), '해제했습니다')}>
                      해제
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
