import type { DisplayService } from '../../api/displayApi';
import './Home.css';

interface TileGridProps {
  services: DisplayService[];
}

/**
 * 전시 서비스를 타일 그리드로 그린다.
 *
 * 타일은 여기서만 쓰는 표현 형태다 — 서버는 전시 서비스(display/services)만 알고,
 * 카드로 그릴지 리스트로 그릴지는 화면이 정한다 (ADR-0066).
 */
export default function TileGrid({ services }: TileGridProps) {
  if (services.length === 0) return null;

  return (
    <section id="services" className="home-section">
      <div className="home-inner">
        <div className="kh-section-head">
          <span className="kh-mono kh-index">01_</span>
          <h2 className="home-section-title">만든 서비스</h2>
        </div>
        <p className="home-section-desc">
          직접 설계하고 운영 중인 서비스입니다. 오픈 예정은 아직 화면이 없다는 뜻입니다.
        </p>

        <ul className="tile-grid">
          {services.map((service) => (
            <li key={service.code}>
              {service.status === 'OPEN' && service.href ? (
                <a className="tile kh-slab kh-grain tile-open" href={service.href}>
                  <TileBody service={service} />
                  <span className="tile-arrow" aria-hidden="true">→</span>
                </a>
              ) : (
                <div className="tile kh-slab kh-grain tile-preopen" aria-disabled="true">
                  <TileBody service={service} />
                  <span className="tile-badge">오픈 예정</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function TileBody({ service }: { service: DisplayService }) {
  return (
    <span className="tile-body">
      <span className="tile-label">{service.label}</span>
      {service.tagline && <span className="tile-tagline">{service.tagline}</span>}
    </span>
  );
}
