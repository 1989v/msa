import type { AttractionAccess as Access, PlaceLang } from '../../api/placeApi';
import { ACCESS_COPY, accessView } from './accessLines';
import './AttractionAccess.css';

/**
 * 상세 「가까운 역·정류장」 — 행동 줄(지도·길찾기) 바로 아래. 첫 행동은 구글 지도 대중교통 길찾기,
 * 그 아래 미리 계산한 역·정류장과 직선거리. 보일 것이 없으면 절을 그리지 않는다.
 */
export default function AttractionAccess({
  access,
  lang,
  directionsHref,
  onDirectionsClick,
  sectionId,
}: {
  access: Access | null | undefined;
  lang: PlaceLang;
  directionsHref: string;
  onDirectionsClick?: () => void;
  /** 절 이동 줄의 대상 id — 주면 포커스를 받을 수 있게(tabIndex -1) 한다 */
  sectionId?: string;
}) {
  const view = accessView(access, lang);
  if (!view) return null;
  const C = ACCESS_COPY[lang];
  return (
    <section
      className="place-access"
      aria-label={C.title}
      data-place-section="access"
      {...(sectionId ? { id: sectionId, tabIndex: -1 } : {})}
    >
      <h2 className="place-access-title">{C.title}</h2>
      <a className="place-btn" href={directionsHref} target="_blank" rel="noreferrer" onClick={onDirectionsClick}>
        {C.directions}
      </a>
      <ul className="place-access-list">
        {view.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {view.note && <p className="place-access-note">{view.note}</p>}
      <p className="place-access-note">{view.source}</p>
    </section>
  );
}
