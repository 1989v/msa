import { Link } from 'react-router-dom';
import type { GameSummary } from '../../api/gameApi';

const COVER_HUES = [245, 180, 145, 25, 300, 75];

function coverHue(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  return COVER_HUES[Math.abs(hash) % COVER_HUES.length];
}

export default function GameCard({ game }: { game: GameSummary }) {
  const hue = coverHue(game.slug);
  return (
    <Link to={`/games/${game.slug}`} className="game-card" aria-label={`${game.title} 상세로 이동`}>
      <div
        className="game-card-cover"
        style={{
          background: `linear-gradient(135deg, oklch(0.34 0.09 ${hue}), oklch(0.22 0.05 ${(hue + 40) % 360}))`,
        }}
      >
        <span className="game-card-initial" aria-hidden>
          {game.title.slice(0, 1)}
        </span>
      </div>
      <div className="game-card-body">
        <h3 className="game-card-title">{game.title}</h3>
        <div className="game-card-meta">
          {game.ratingCount > 0 ? (
            <span className="game-card-rating">★ {game.ratingAvg.toFixed(1)}</span>
          ) : (
            <span className="game-card-rating muted">평가 없음</span>
          )}
          <span className="game-card-plays">{game.playCount.toLocaleString()} plays</span>
        </div>
        <div className="game-card-tags">
          {game.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="game-tag-chip">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
