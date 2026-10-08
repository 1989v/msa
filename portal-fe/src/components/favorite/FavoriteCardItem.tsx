import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { HydratedCard } from './favoriteCards';
import './FavoritesPage.css';

/**
 * 찜 카드 한 장 — 내 찜 목록과 공유 묶음 수신 화면이 같이 쓴다.
 * `children` 은 카드 모서리 동작 자리(묶음 이동·별)다.
 */
export default function FavoriteCardItem({ card, children }: { card: HydratedCard; children?: ReactNode }) {
  return (
    <li className="favorites-card kh-slab">
      {card.external ? (
        <a className="favorites-card__link" href={card.href}>
          <FavoriteCardBody card={card} />
        </a>
      ) : (
        <Link className="favorites-card__link" to={card.href} viewTransition>
          <FavoriteCardBody card={card} />
        </Link>
      )}
      <span className="favorites-card__action">{children}</span>
    </li>
  );
}

function FavoriteCardBody({ card }: { card: HydratedCard }) {
  return (
    <>
      {card.imageUrl && <img className="favorites-card__cover" src={card.imageUrl} alt="" loading="lazy" />}
      <span className="favorites-card__title">{card.title}</span>
      {card.meta && <span className="favorites-card__meta kh-mono">{card.meta}</span>}
    </>
  );
}
