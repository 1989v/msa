import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { adsErrorMessage, fetchPublisherReport, formatCredits, kstDate, type PublisherReport } from '@/api/ads';

const pct = (rate: number) => `${(rate * 100).toFixed(1)}%`;

/**
 * 퍼블리셔 리포트 (ADR-0098) — 지면 × 일(KST).
 * 유료 채움률은 서버가 센 값이고, 「화면 보고 채움」은 FE 가 보고한 최종 채움 출처라 참고치다.
 * 지면별 수익은 정산 분개를 지출 비율로 내림 배분한 참고치 — 확정 금액은 맨 아래 원장 총액 행이다.
 */
export function AdsPublisherReportPage() {
  const [from, setFrom] = useState(() => kstDate(-6));
  const [to, setTo] = useState(() => kstDate());
  const [report, setReport] = useState<PublisherReport | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setReport(await fetchPublisherReport(from, to));
      setMessage(null);
    } catch (err) {
      setMessage(adsErrorMessage(err, '불러오지 못했습니다'));
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">퍼블리셔 리포트</h1>
          <p className="text-sm text-zinc-500">지면별 수익은 참고치입니다. 확정 금액은 원장 총액 행을 봅니다.</p>
        </div>
        <div className="flex gap-2">
          <Input type="date" aria-label="시작일" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" aria-label="종료일" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      {message && <p className="text-sm text-zinc-500">{message}</p>}
      {report && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="text-zinc-500">
              <tr>
                <th className="p-3 text-left">날짜</th>
                <th className="p-3 text-left">지면</th>
                <th className="p-3 text-right">요청</th>
                <th className="p-3 text-right">유료 채움률</th>
                <th className="p-3 text-left">화면 보고 채움(참고치) 유료·AdSense·HOUSE·빈</th>
                <th className="p-3 text-right">노출</th>
                <th className="p-3 text-right">클릭</th>
                <th className="p-3 text-right">RPM</th>
                <th className="p-3 text-right">수익(참고치)</th>
              </tr>
            </thead>
            <tbody>
              {report.placements.map((row) => (
                <tr key={`${row.placementKey}-${row.date}`} className="border-t border-zinc-800">
                  <td className="p-3 font-mono text-xs">{row.date}</td>
                  <td className="p-3 font-mono text-xs">{row.placementKey}</td>
                  <td className="p-3 text-right">{row.requests.toLocaleString('ko-KR')}</td>
                  <td className="p-3 text-right">{pct(row.paidFillRate)}</td>
                  <td className="p-3 font-mono text-xs text-zinc-500">
                    {row.clientReportedFill.paid} · {row.clientReportedFill.adsense} · {row.clientReportedFill.house} ·{' '}
                    {row.clientReportedFill.empty}
                  </td>
                  <td className="p-3 text-right">{row.impressions.toLocaleString('ko-KR')}</td>
                  <td className="p-3 text-right">{row.clicks.toLocaleString('ko-KR')}</td>
                  <td className="p-3 text-right font-mono text-xs">{formatCredits(row.rpmMicros)}</td>
                  <td className="p-3 text-right font-mono text-xs">{formatCredits(row.publisherRevenueMicros)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-zinc-700 font-semibold" data-testid="ads-ledger-total">
                <td className="p-3" colSpan={7}>
                  원장 총액(퍼블리셔 미지급, 확정) · 지면별 배분 합 {formatCredits(report.ledgerTotal.allocatedMicros)}
                </td>
                <td className="p-3" />
                <td className="p-3 text-right font-mono text-xs">{formatCredits(report.ledgerTotal.publisherPayableMicros)}</td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}
    </div>
  );
}
