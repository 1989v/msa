import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { adsErrorMessage, checkLedger, formatCredits, type LedgerCheck } from '@/api/ads';

/**
 * 원장 검사 (ADR-0098) — 전체 분개 합이 0 인지 지금 돌려 본다. 0 이 아니면 서버 로그에 ERROR 가 함께 남는다.
 * 매일 도는 같은 검사의 수동판이다.
 */
export function AdsLedgerCheckPage() {
  const [result, setResult] = useState<LedgerCheck | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const run = useCallback(async () => {
    setRunning(true);
    try {
      setResult(await checkLedger());
      setMessage(null);
    } catch (err) {
      setMessage(adsErrorMessage(err, '검사하지 못했습니다'));
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">원장 검사</h1>
          <p className="text-sm text-zinc-500">복식부기 원장의 전체 분개 합이 0 이어야 합니다.</p>
        </div>
        <Button size="sm" disabled={running} onClick={run}>
          다시 검사
        </Button>
      </div>
      {message && <p className="text-sm text-zinc-500">{message}</p>}
      {result && (
        <Card className="space-y-1 p-4 text-sm">
          <p className="text-lg font-semibold">{result.balanced ? '균형 — 분개 합 0' : '불균형'}</p>
          <p>
            불균형 금액 <span className="font-mono">{formatCredits(result.imbalanceMicros)}</span> 크레딧
          </p>
          <p className="text-xs text-zinc-500">검사 시각 {result.checkedAt}</p>
        </Card>
      )}
    </div>
  );
}
