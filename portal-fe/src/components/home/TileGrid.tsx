import type { PortalTile } from '../../api/portalApi';
import './Home.css';

interface TileGridProps {
  tiles: PortalTile[];
}

export default function TileGrid({ tiles }: TileGridProps) {
  if (tiles.length === 0) return null;

  return (
    <section id="services" className="home-section">
      <div className="home-inner">
        <h2 className="home-section-title">만든 서비스</h2>
        <p className="home-section-desc">
          직접 설계하고 운영 중인 서비스입니다. 준비중 표시는 아직 화면이 없다는 뜻입니다.
        </p>

        <ul className="tile-grid">
          {tiles.map((tile) => (
            <li key={tile.code}>
              {tile.status === 'LIVE' && tile.href ? (
                <a className="tile tile-live" href={tile.href}>
                  <TileBody tile={tile} />
                  <span className="tile-arrow" aria-hidden="true">→</span>
                </a>
              ) : (
                <div className="tile tile-soon" aria-disabled="true">
                  <TileBody tile={tile} />
                  <span className="tile-badge">준비중</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function TileBody({ tile }: { tile: PortalTile }) {
  return (
    <span className="tile-body">
      <span className="tile-label">{tile.label}</span>
      {tile.tagline && <span className="tile-tagline">{tile.tagline}</span>}
    </span>
  );
}
