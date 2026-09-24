import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { VIRTUAL_CREDIT_NOTE, fetchReport, formatCredits, kstDate } from '../../api/adsConsoleApi';

const DEFAULT_DAYS = 7;

const pct = (ctr: number, impressions: number) => (impressions > 0 ? `${(ctr * 100).toFixed(2)}%` : '—');

/**
 * 리포트 — 캠페인 × 일(KST) 가시 노출·클릭·CTR·지출·청구액, 그 아래 소재별.
 * 정산이 덜 끝난 날은 청구액이 비어 온다. 지출과 청구액이 다른 날은 「예산 초과분 미청구」다.
 */
export default function ConsoleReports() {
  const [from, setFrom] = useState(() => kstDate(-(DEFAULT_DAYS - 1)));
  const [to, setTo] = useState(() => kstDate());
  const report = useQuery({ queryKey: ['ads', 'report', from, to], queryFn: () => fetchReport(from, to) });
  const rows = report.data ?? [];

  return (
    <section className="adc-section">
      <div className="adc-section__head">
        <h1>리포트</h1>
      </div>
      <div className="adc-range">
        <label className="adc-field">
          <span className="adc-field__label">시작일</span>
          <input className="kh-field" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="adc-field">
          <span className="adc-field__label">종료일</span>
          <input className="kh-field" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      {report.isLoading && <p className="adc-status">불러오는 중…</p>}
      {report.isError && (
        <p className="adc-status adc-status--error" role="alert">
          리포트를 불러오지 못했습니다.
        </p>
      )}
      {report.isSuccess && rows.length === 0 && <p className="adc-status">이 기간에 게재 기록이 없습니다.</p>}
      {rows.length > 0 && (
        <div className="adc-table-wrap">
          <table className="kh-table adc-table">
            <caption className="adc-table__caption">금액 단위 크레딧 · {VIRTUAL_CREDIT_NOTE}</caption>
            <thead>
              <tr>
                <th>날짜</th>
                <th>캠페인 · 소재</th>
                <th className="num">가시 노출</th>
                <th className="num">클릭</th>
                <th className="num">CTR</th>
                <th className="num">지출</th>
                <th className="num">청구액</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Fragment key={`${row.campaignId}-${row.date}`}>
                  <tr>
                    <td className="adc-num adc-nowrap">{row.date}</td>
                    <td>
                      {row.campaignName}
                      {row.unbilledOverBudget && <span className="adc-flag">예산 초과분 미청구</span>}
                    </td>
                    <td className="num">{row.impressions.toLocaleString('ko-KR')}</td>
                    <td className="num">{row.clicks.toLocaleString('ko-KR')}</td>
                    <td className="num">{pct(row.ctr, row.impressions)}</td>
                    <td className="num">{formatCredits(row.spendMicros)}</td>
                    <td className="num">{row.chargedMicros == null ? '미정산' : formatCredits(row.chargedMicros)}</td>
                  </tr>
                  {row.creatives.map((creative) => (
                    <tr key={creative.creativeId} className="adc-subrow">
                      <td />
                      <td>소재 #{creative.creativeId}</td>
                      <td className="num">{creative.impressions.toLocaleString('ko-KR')}</td>
                      <td className="num">{creative.clicks.toLocaleString('ko-KR')}</td>
                      <td className="num">{pct(creative.ctr, creative.impressions)}</td>
                      <td className="num">{formatCredits(creative.spendMicros)}</td>
                      <td className="num">—</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
