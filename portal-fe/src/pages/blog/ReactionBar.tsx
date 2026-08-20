import type { BlogReaction } from '../../api/blogApi';
import SharePanel from './SharePanel';

interface Props {
  reaction: BlogReaction;
  canonical: string;
  title: string;
  busy: boolean;
  onToggleLike: () => void;
  onRate: (score: number) => void;
}

/**
 * 좋아요 · 평점 · 공유.
 *
 * 좋아요가 1차 액션이고 평점은 보조다 — 둘은 축이 겹치므로 같은 무게로 두면 어느 쪽도
 * 신호가 되지 못한다 (ADR-0072 §5). 둘 다 비로그인으로 동작한다.
 */
export default function ReactionBar({
  reaction,
  canonical,
  title,
  busy,
  onToggleLike,
  onRate,
}: Props) {
  return (
    <div className="blog-reactions">
      <button
        type="button"
        className={`blog-like${reaction.liked ? ' is-on' : ''}`}
        disabled={busy}
        aria-pressed={reaction.liked}
        onClick={onToggleLike}
      >
        <span aria-hidden="true">♥</span>
        <span>좋아요 {reaction.likeCount}</span>
      </button>

      <div className="blog-rating">
        <span className="blog-rating__stars" role="group" aria-label="평점">
          {[1, 2, 3, 4, 5].map((score) => (
            <button
              key={score}
              type="button"
              className={`blog-star${(reaction.myScore ?? 0) >= score ? ' is-on' : ''}`}
              disabled={busy}
              aria-label={`${score}점`}
              onClick={() => onRate(score)}
            >
              ★
            </button>
          ))}
        </span>
        <span className="kh-mono">
          {reaction.ratingCount > 0
            ? `${reaction.ratingAverage.toFixed(1)} (${reaction.ratingCount})`
            : '평가 없음'}
        </span>
      </div>

      <SharePanel url={canonical} title={title} />
    </div>
  );
}
