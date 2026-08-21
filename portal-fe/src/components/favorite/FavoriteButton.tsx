import { useNavigate } from 'react-router-dom';
import type { MouseEvent } from 'react';
import { LOGIN_NEXT_KEY } from '../../auth/auth';
import type { FavoriteTargetType } from '../../api/wishlistApi';
import { useFavorites } from './useFavorites';
import './Favorite.css';

const isBlogHost = window.location.hostname.split('.')[0] === 'blog';

const LABELS: Record<FavoriteTargetType, string> = {
  PRODUCT: '상품 찜',
  GAME: '게임 찜',
  ATTRACTION: '관광지 찜',
  BLOG_POST: '글 찜',
};

/**
 * 찜하기 하트 (ADR-0074) — 로그인 전용. 게스트에게도 보이고, 누르면 로그인으로 보낸다
 * (`next` 로 현재 화면 복귀). 토글은 낙관적 — 실패 시 useFavorites 가 되돌린다.
 *
 * compact: 카드 모서리용. 카드 전체가 <a>/<button> 이라 클릭이 링크로 새지 않게
 * preventDefault + stopPropagation 을 건다.
 */
export default function FavoriteButton({
  type,
  targetKey,
  compact = false,
}: {
  type: FavoriteTargetType;
  targetKey: string;
  compact?: boolean;
}) {
  const navigate = useNavigate();
  const { loggedIn, isFavorite, toggle } = useFavorites(type);
  const active = loggedIn && isFavorite(targetKey);

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    // 카드(<a>) 안에 앉는 버튼 — 하트 탭이 카드 이동으로 번지면 안 된다
    e.preventDefault();
    e.stopPropagation();
    if (!loggedIn) {
      const next = window.location.pathname + window.location.search;
      if (isBlogHost) {
        // blog 호스트는 자체 로그인 화면(/login)이 있고 복귀 경로는 세션에 둔다 (BlogPostPage 와 동일)
        sessionStorage.setItem(LOGIN_NEXT_KEY, next);
        navigate('/login');
      } else {
        navigate(`/shop/login?next=${encodeURIComponent(next)}`);
      }
      return;
    }
    toggle(targetKey);
  };

  return (
    <button
      type="button"
      className={`favorite-btn${compact ? ' is-compact' : ''}${active ? ' is-on' : ''}`}
      aria-pressed={active}
      aria-label={active ? `${LABELS[type]} 해제` : LABELS[type]}
      title={active ? '찜 해제' : '찜하기'}
      onClick={handleClick}
    >
      <span className="favorite-btn__heart" aria-hidden="true">
        {active ? '♥' : '♡'}
      </span>
      {!compact && <span className="favorite-btn__label">{active ? '찜함' : '찜'}</span>}
    </button>
  );
}
