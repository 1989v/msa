import type { DisplayService } from '../../api/displayApi';
import { resolveServiceHref } from '../../shell/serviceHref';
import './Home.css';

interface TileGridProps {
  services: DisplayService[];
}

/**
 * 전시 서비스 전체를 작은 색인 격자로 그린다.
 *
 * 타일은 여기서만 쓰는 표현 형태다 — 서버는 전시 서비스(display/services)만 알고,
 * 카드로 그릴지 리스트로 그릴지는 화면이 정한다 (ADR-0066). 2026-09-03 개정으로 큰 타일 9장은
 * 서비스 섹션(ServiceShowcase) 아래의 색인이 됐다 — 진입점은 그대로 전부 여기 있다.
 */
export default function TileGrid({ services }: TileGridProps) {
  if (services.length === 0) return null;

  return (
    <div className="home-index">
      <div className="kh-mono home-index-label">전체 진입점 · {services.length}</div>
      <ul className="tile-grid">
        {services.map((service) => (
          <li key={service.code}>
            {service.status === 'OPEN' && service.href ? (
              <a
                className="tile kh-slab kh-grain tile-open"
                href={resolveServiceHref(service.code, service.href)}
              >
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
