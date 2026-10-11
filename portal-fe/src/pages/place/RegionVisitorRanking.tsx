import { Link } from 'react-router-dom';
import type { PlaceLang, RegionVisitorRanking as Ranking } from '../../api/placeApi';
import { regionPath } from '../../seo/copy.mjs';
import { KTO_RANKING_COPY, SIGNAL_COPY, ktoRankingSignalLine } from './visitSignals';
import './RegionVisitorRanking.css';

/**
 * 시도 페이지 「타지 방문자가 많은 시군구」 — 마지막 다 받은 달의 외지인+외국인 상위 10. 행마다 그 시군구 지역 페이지로 간다.
 * 다 받은 달이 없거나 시군구가 3개 미만인 시도(세종·제주)는 서버가 빈 결과를 주고, 그때는 절을 그리지 않는다.
 * 시군구 페이지·관광지 상세에는 순위를 내지 않는다.
 */
export default function RegionVisitorRanking({ ranking, sidoName, lang }: { ranking: Ranking; sidoName: string; lang: PlaceLang }) {
  const line = ktoRankingSignalLine(sidoName, ranking.month, lang);
  if (ranking.items.length === 0 || !line) return null;
  const C = KTO_RANKING_COPY[lang];
  const title = SIGNAL_COPY.KTO_REGION_VISITORS[lang].sectionTitle;

  return (
    <section className="place-visitor-ranking" aria-label={title} data-place-section="REGION_VISITOR_RANKING">
      <h2 className="place-subtitle">{title}</h2>
      <ol className="place-visitor-ranking-list">
        {ranking.items.map((item) => (
          <li key={item.code} className="place-visitor-ranking-row">
            <Link to={regionPath(lang, item.code)}>{(lang === 'en' && item.nameEn) || item.name}</Link>
            <span className="place-visitor-ranking-value">{C.value(item.total)}</span>
          </li>
        ))}
      </ol>
      <p className="place-visitor-note">{line}</p>
      <details className="place-visitor-ranking-basis">
        <summary>{C.basisToggle}</summary>
        {C.basis.map((text) => (
          <p key={text} className="place-visitor-note">
            {text}
          </p>
        ))}
        <p className="place-visitor-note">{C.sourceLine}</p>
      </details>
    </section>
  );
}
