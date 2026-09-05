import type { MouseEvent } from 'react';
import type { FavoriteTargetType } from '../../api/wishlistApi';
import { useFavorites } from './useFavorites';
import './Favorite.css';
import { buildLoginHref } from '../../auth/auth';


/**
 * 문구는 화면 언어를 따른다. **영문 면은 place 뿐**이라(ADR-0065) 나머지 호출자는
 * lang 을 넘기지 않고 국문 기본값을 쓴다 — 안 쓰는 곳까지 인자를 강제하지 않는다.
 */
export type FavoriteLang = 'ko' | 'en';

/** 대상을 부르는 말. 접근성 이름은 이것을 각 언어의 어순으로 조립한다. */
const NOUNS: Record<FavoriteLang, Record<FavoriteTargetType, string>> = {
  ko: { PRODUCT: '상품', GAME: '게임', ATTRACTION: '관광지', BLOG_POST: '글' },
  en: { PRODUCT: 'product', GAME: 'game', ATTRACTION: 'place', BLOG_POST: 'post' },
};

/**
 * 언어마다 어순이 다르다 — 「명사 + 동작」(ko) 과 「동작 + 명사」(en).
 * 한 틀에 명사만 끼우면 한쪽이 어색해지므로 언어별로 문장을 만든다.
 */
const UI: Record<FavoriteLang, {
  label: (noun: string) => string;
  undoLabel: (noun: string) => string;
  on: string; off: string; title: string; undoTitle: string;
}> = {
  ko: {
    label: (n) => `${n} 찜`,
    undoLabel: (n) => `${n} 찜 해제`,
    on: '찜함', off: '찜', title: '찜하기', undoTitle: '찜 해제',
  },
  en: {
    label: (n) => `Save ${n}`,
    undoLabel: (n) => `Remove ${n} from saved`,
    on: 'Saved', off: 'Save', title: 'Save', undoTitle: 'Remove from saved',
  },
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
  lang = 'ko',
}: {
  type: FavoriteTargetType;
  targetKey: string;
  compact?: boolean;
  lang?: FavoriteLang;
}) {
  const L = UI[lang];
  const { loggedIn, isFavorite, toggle } = useFavorites(type);
  const active = loggedIn && isFavorite(targetKey);

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    // 카드(<a>) 안에 앉는 버튼 — 하트 탭이 카드 이동으로 번지면 안 된다
    e.preventDefault();
    e.stopPropagation();
    if (!loggedIn) {
      // 로그인은 apex 한 곳이라 호스트를 넘는 이동이다 (ADR-0079)
      window.location.href = buildLoginHref();
      return;
    }
    toggle(targetKey);
  };

  return (
    <button
      type="button"
      className={`favorite-btn${compact ? ' is-compact' : ''}${active ? ' is-on' : ''}`}
      aria-pressed={active}
      aria-label={active ? L.undoLabel(NOUNS[lang][type]) : L.label(NOUNS[lang][type])}
      title={active ? L.undoTitle : L.title}
      onClick={handleClick}
    >
      <span className="favorite-btn__heart" aria-hidden="true">
        {active ? '♥' : '♡'}
      </span>
      {!compact && <span className="favorite-btn__label">{active ? L.on : L.off}</span>}
    </button>
  );
}
