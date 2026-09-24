import { Link } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  REJECT_REASON_LABEL,
  VIRTUAL_CREDIT_NOTE,
  fetchCampaigns,
  fetchCreatives,
  fetchReport,
  formatCredits,
  kstDate,
  type AdvertiserDashboard,
  type Campaign,
  type CampaignDay,
} from '../../api/adsConsoleApi';
import { CreditNote, StatePill } from './consoleParts';
import { CREATIVE_STATE, campaignState, consoleHref } from './consoleView';

/**
 * 대시보드 — 잔액·오늘 지출·오늘 청구액, 캠페인 목록, 소재 심사 상태.
 * 오늘 지출과 노출·클릭은 시간별 집계에 반영된 만큼이라 최대 집계 주기(5분)만큼 늦다.
 */
export default function ConsoleDashboard({
  advertiser,
  readOnly,
}: {
  advertiser: AdvertiserDashboard;
  readOnly: boolean;
}) {
  const today = kstDate();
  const campaigns = useQuery({ queryKey: ['ads', 'campaigns'], queryFn: fetchCampaigns });
  const report = useQuery({ queryKey: ['ads', 'report', today, today], queryFn: () => fetchReport(today, today) });

  const list = campaigns.data ?? [];
  const todayRows = new Map<number, CampaignDay>((report.data ?? []).map((row) => [row.campaignId, row]));
  const totals = (report.data ?? []).reduce(
    (acc, row) => ({ impressions: acc.impressions + row.impressions, clicks: acc.clicks + row.clicks }),
    { impressions: 0, clicks: 0 },
  );

  return (
    <div className="adc-stack">
      <div className="adc-kpis">
        <div className="adc-kpi">
          <span className="adc-kpi__k">잔액</span>
          <span className="adc-kpi__v">
            {formatCredits(advertiser.balanceMicros)}
            <small>크레딧</small>
          </span>
          <CreditNote />
          {!readOnly && (
            <Link className="adc-btn adc-kpi__action" to={consoleHref('/top-up')}>
              충전
            </Link>
          )}
        </div>
        <div className="adc-kpi">
          <span className="adc-kpi__k">오늘 지출</span>
          <span className="adc-kpi__v">
            {formatCredits(advertiser.todaySpendMicros)}
            <small>크레딧</small>
          </span>
          <CreditNote />
          <span className="adc-kpi__sub">
            가시 노출 {totals.impressions.toLocaleString('ko-KR')} · 클릭 {totals.clicks.toLocaleString('ko-KR')}
          </span>
        </div>
        <div className="adc-kpi">
          <span className="adc-kpi__k">오늘 청구액</span>
          <span className="adc-kpi__v">
            {formatCredits(advertiser.todayChargedMicros)}
            <small>크레딧</small>
          </span>
          <CreditNote />
          <span className="adc-kpi__sub">정산이 끝난 시각까지의 합계</span>
        </div>
      </div>

      <section className="adc-section">
        <div className="adc-section__head">
          <h2>캠페인</h2>
          {!readOnly && (
            <Link className="adc-btn adc-btn--ghost" to={consoleHref('/campaigns/new')}>
              새 캠페인
            </Link>
          )}
        </div>
        {campaigns.isLoading && <p className="adc-status">불러오는 중…</p>}
        {campaigns.isError && (
          <p className="adc-status adc-status--error" role="alert">
            캠페인을 불러오지 못했습니다.
          </p>
        )}
        {campaigns.isSuccess && list.length === 0 && <p className="adc-status">아직 캠페인이 없습니다.</p>}
        {list.length > 0 && (
          <div className="adc-table-wrap">
            <table className="kh-table adc-table">
              <caption className="adc-table__caption">금액 단위 크레딧 · {VIRTUAL_CREDIT_NOTE}</caption>
              <thead>
                <tr>
                  <th>캠페인</th>
                  <th>상태</th>
                  <th>입찰</th>
                  <th className="num">오늘 지출 / 일예산</th>
                  <th className="num">CTR</th>
                </tr>
              </thead>
              <tbody>
                {list.map((campaign) => (
                  <CampaignRow key={campaign.id} campaign={campaign} today={todayRows.get(campaign.id) ?? null} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <CreativeReviewSection campaigns={list} />
    </div>
  );
}

function CampaignRow({ campaign, today }: { campaign: Campaign; today: CampaignDay | null }) {
  const spend = today?.spendMicros ?? 0;
  const state = campaignState(campaign, spend);
  const budget = campaign.dailyBudgetMicros ?? 0;
  const ratio = budget > 0 ? Math.min(100, Math.round((spend / budget) * 100)) : 0;
  return (
    <tr>
      <td>
        <Link className="adc-link" to={consoleHref(`/campaigns/${campaign.id}`)}>
          {campaign.name}
        </Link>
      </td>
      <td>
        <StatePill tone={state.tone} label={state.label} />
        {today?.unbilledOverBudget && <span className="adc-flag">예산 초과분 미청구</span>}
      </td>
      <td className="adc-nowrap">
        {campaign.bidType ?? '—'} {formatCredits(campaign.bidMicros)}
      </td>
      <td className="num">
        {formatCredits(spend)} / {formatCredits(campaign.dailyBudgetMicros)}
        <div className="adc-bar-meter" aria-hidden="true">
          <span style={{ width: `${ratio}%` }} />
        </div>
      </td>
      <td className="num">{today && today.impressions > 0 ? `${(today.ctr * 100).toFixed(2)}%` : '—'}</td>
    </tr>
  );
}

/** 소재 심사 상태 — 캠페인마다 소재 목록을 받아 한 표로 모은다. 보관한 소재는 뺀다. */
function CreativeReviewSection({ campaigns }: { campaigns: Campaign[] }) {
  const results = useQueries({
    queries: campaigns.map((campaign) => ({
      queryKey: ['ads', 'creatives', campaign.id],
      queryFn: () => fetchCreatives(campaign.id),
    })),
  });
  const rows = results.flatMap((result, index) =>
    (result.data ?? [])
      .filter((creative) => creative.status !== 'ARCHIVED')
      .map((creative) => ({ creative, campaign: campaigns[index] })),
  );
  if (rows.length === 0) return null;

  return (
    <section className="adc-section">
      <div className="adc-section__head">
        <h2>소재 심사</h2>
      </div>
      <div className="adc-table-wrap">
        <table className="kh-table adc-table">
          <thead>
            <tr>
              <th>소재</th>
              <th>캠페인</th>
              <th>심사</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ creative, campaign }) => {
              const state = CREATIVE_STATE[creative.status];
              return (
                <tr key={creative.id}>
                  <td className="adc-creative-title">{creative.title}</td>
                  <td>
                    <Link className="adc-link" to={consoleHref(`/campaigns/${campaign.id}`)}>
                      {campaign.name}
                    </Link>
                  </td>
                  <td>
                    <StatePill tone={state.tone} label={state.label} />
                    {creative.rejectReason && (
                      <span className="adc-reason">{REJECT_REASON_LABEL[creative.rejectReason]}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
