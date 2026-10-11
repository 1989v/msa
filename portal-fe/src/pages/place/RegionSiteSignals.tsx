import { Link } from 'react-router-dom';
import type { Attraction, PlaceLang } from '../../api/placeApi';
import { attractionPath, placeCategoryLabel } from '../../seo/copy.mjs';
import { secureImageUrl, titleParts } from './placeView';
import { SIGNAL_COPY, SITE_CLICKS_BASIS, SITE_SECTION_MIN_ITEMS, siteSectionSignalLine } from './visitSignals';
import './RegionSiteSignals.css';

/**
 * 시군구 페이지 「많이 찜한 곳」(SITE_SAVES) · 「이 사이트에서 많이 누른 곳」(SITE_CLICKS).
 * 목록은 서버가 하한 이상만 정렬해 준다(`sort=saved|clicked`). 3곳 미만이면 절을 그리지 않는다.
 */
export default function RegionSiteSignals({
  kind,
  items,
  sigunguName,
  lang,
}: {
  kind: 'SITE_SAVES' | 'SITE_CLICKS';
  items: Attraction[];
  sigunguName: string;
  lang: PlaceLang;
}) {
  const line = siteSectionSignalLine(kind, sigunguName, lang);
  if (items.length < SITE_SECTION_MIN_ITEMS || !line) return null;
  const title = SIGNAL_COPY[kind][lang].sectionTitle;
  const basis = kind === 'SITE_CLICKS' ? SITE_CLICKS_BASIS[lang] : null;

  return (
    <section className="place-list place-site-signals" aria-label={title} data-place-section={kind === 'SITE_SAVES' ? 'REGION_SITE_SAVES' : 'REGION_SITE_CLICKS'}>
      <h2 className="place-subtitle">{title}</h2>
      {items.map((a) => (
        <Link key={a.id} className="place-card" to={attractionPath(lang, a.id)}>
          {a.imageUrl ? (
            <img className="place-card-img" src={secureImageUrl(a.imageUrl)} alt="" loading="lazy" />
          ) : (
            <div className="place-card-img place-card-img-empty" aria-hidden />
          )}
          <div className="place-card-body">
            <h3 className="place-card-title">{titleParts(a).primary}</h3>
            {a.category && <span className="place-card-addr">{placeCategoryLabel(a.category, lang)}</span>}
            {a.address && <p className="place-card-addr">{a.address}</p>}
          </div>
        </Link>
      ))}
      <p className="place-visitor-note">{line}</p>
      {basis && (
        <details className="place-site-signals-basis">
          <summary>{basis.toggle}</summary>
          {basis.lines.map((text) => (
            <p key={text} className="place-visitor-note">
              {text}
            </p>
          ))}
        </details>
      )}
    </section>
  );
}
