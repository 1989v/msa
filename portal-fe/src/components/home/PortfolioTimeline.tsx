import type { PortfolioTimeline as Timeline } from '../../api/displayApi';
import './Home.css';

/** `2026-06` → `2026.06` */
function ym(value: string | null): string {
  return value ? value.replace('-', '.') : '';
}

function periodText(start: string | null, end: string | null, ongoing: boolean): string {
  if (!start) return '';
  return `${ym(start)} – ${ongoing || !end ? '현재' : ym(end)}`;
}

interface PortfolioTimelineProps {
  timeline: Timeline;
}

export default function PortfolioTimeline({ timeline }: PortfolioTimelineProps) {
  const { career, companies, projects, categories } = timeline;
  if (companies.length === 0 && projects.length === 0) return null;

  const categoryLabel = new Map(categories.map((c) => [c.code, c.label]));

  return (
    <section id="portfolio" className="home-section">
      <div className="home-inner">
        <h2 className="home-section-title">지나온 것</h2>
        <p className="home-section-desc">
          회사에서 한 일은 이력서에, 여기에는 직접 만든 것들을 시간순으로 둡니다.
        </p>

        {companies.length > 0 && (
          <div className="timeline-career">
            <span className="timeline-career-total">
              총 {career.years}년 {career.months}개월 · {career.yearsInField}년차
            </span>
            <ul className="timeline-companies">
              {companies.map((c) => (
                <li key={`${c.name}-${c.startMonth}`} className="timeline-company">
                  <span className="timeline-company-name">{c.name}</span>
                  <span className="timeline-company-period">
                    {periodText(c.startMonth, c.endMonth, c.ongoing)}
                  </span>
                  {c.position && <span className="timeline-company-role">{c.position}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {projects.length > 0 && (
          <ol className="timeline-list">
            {projects.map((p) => (
              <li key={p.title} className="timeline-item">
                <div className="timeline-period">
                  {p.startMonth ? periodText(p.startMonth, p.endMonth, p.ongoing) : '—'}
                </div>
                <div className="timeline-content">
                  <h3 className="timeline-title">
                    {p.title}
                    {p.categoryCode && (
                      <span className="timeline-category">
                        {categoryLabel.get(p.categoryCode) ?? p.categoryCode}
                      </span>
                    )}
                  </h3>
                  {p.summary && <p className="timeline-summary">{p.summary}</p>}
                  {p.metrics.length > 0 && (
                    <ul className="timeline-metrics">
                      {p.metrics.map((m) => <li key={m}>{m}</li>)}
                    </ul>
                  )}
                  {p.tags.length > 0 && (
                    <div className="timeline-tags">
                      {p.tags.map((t) => <span key={t} className="timeline-tag">{t}</span>)}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}

        <a className="home-more-link" href="/portfolio">
          전체 기록 보기 →
        </a>
      </div>
    </section>
  );
}
