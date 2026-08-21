import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { fetchFavorites, type FavoriteTargetType } from '../../api/wishlistApi';
import { fetchGameDetail } from '../../api/gameApi';
import { fetchPost } from '../../api/blogApi';
import { fetchAttraction } from '../../api/placeApi';
import { titleParts } from '../../pages/place/placeView';
import { fetchProduct } from '../../api/shopApi';
import { isLoggedIn } from '../../auth/auth';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import { BLOG_ORIGIN } from '../../seo/copy.mjs';
import { isApexProd } from '../../shell/serviceHref';
import { useSeo } from '../../seo/useSeo';
import { formatWon } from '../../pages/shopFormat';
import FavoriteButton from './FavoriteButton';
import Footer from '../Footer';
import './FavoritesPage.css';

/** 하이드레이션된 카드 한 장 — 타입이 달라도 목록은 같은 모양으로 그린다 */
interface FavoriteCard {
  targetKey: string;
  title: string;
  meta: string;
  imageUrl: string | null;
  href: string;
  /** apex 에 라우트가 없는 대상(blog)은 절대 URL 로 나간다 */
  external: boolean;
}

const HOST_TYPE: Record<string, FavoriteTargetType> = {
  game: 'GAME',
  place: 'ATTRACTION',
  blog: 'BLOG_POST',
};

const TAB_TYPES: FavoriteTargetType[] = ['GAME', 'ATTRACTION', 'BLOG_POST', 'PRODUCT'];

const TYPE_LABELS_KO: Record<FavoriteTargetType, string> = {
  GAME: '게임',
  ATTRACTION: '관광지',
  BLOG_POST: '블로그 글',
  PRODUCT: '상품',
};

const TYPE_LABELS_EN: Record<FavoriteTargetType, string> = {
  GAME: 'Games',
  ATTRACTION: 'Attractions',
  BLOG_POST: 'Blog posts',
  PRODUCT: 'Products',
};

/**
 * 대상 상세는 각 서비스 공개 API 로 키별 조회한다 (ADR-0074 — wishlist 는 키만 안다).
 * 실패(삭제·비공개 전환)는 null 로 접어 목록에서 건너뛴다.
 */
async function hydrate(type: FavoriteTargetType, key: string): Promise<FavoriteCard | null> {
  try {
    switch (type) {
      case 'GAME': {
        const game = await fetchGameDetail(key);
        return {
          targetKey: key,
          title: game.title,
          meta: `${game.playCount.toLocaleString()} plays`,
          imageUrl: game.thumbnailUrl || null,
          href: `/games/${key}`,
          external: false,
        };
      }
      case 'ATTRACTION': {
        const attraction = await fetchAttraction(key);
        // 원어 병기명은 제목에 괄호로 합치지 않는다 — titleParts 계약 (place t1/t2)
        const { primary, secondary } = titleParts(attraction);
        return {
          targetKey: key,
          title: primary,
          meta: [secondary, attraction.address ?? attraction.category]
            .filter(Boolean)
            .join(' · '),
          imageUrl: attraction.imageUrl,
          href: `/attractions/${key}`,
          external: false,
        };
      }
      case 'BLOG_POST': {
        const detail = await fetchPost(key);
        return {
          targetKey: key,
          title: detail.post.title,
          meta: `${detail.post.categoryName} · ${detail.post.author.displayName}`,
          imageUrl: detail.post.coverImageUrl,
          // blog 의 짧은 주소(/posts/:slug)는 apex 프로덕션에 라우트가 없다 (canonical 분리)
          href: isApexProd ? `${BLOG_ORIGIN}/posts/${key}` : `/posts/${key}`,
          external: isApexProd,
        };
      }
      case 'PRODUCT': {
        const product = await fetchProduct(key);
        return {
          targetKey: key,
          title: product.name,
          meta: formatWon(product.price),
          imageUrl: null,
          href: `/shop/products/${key}`,
          external: false,
        };
      }
    }
  } catch {
    return null;
  }
}

function useFavoriteCards(type: FavoriteTargetType, enabled: boolean) {
  return useQuery({
    queryKey: ['favorites', 'list', type],
    queryFn: async () => {
      const page = await fetchFavorites({ type, size: 100 });
      const hydrated = await Promise.all(page.items.map((item) => hydrate(type, item.targetKey)));
      const cards = hydrated.filter((card): card is FavoriteCard => card !== null);
      return { cards, missing: page.items.length - cards.length };
    },
    enabled,
  });
}

export default function FavoritesPage() {
  useHeritageSurface();
  const { pathname } = useLocation();
  const lang = pathname.startsWith('/en') ? 'en' : 'ko';
  const subdomain = window.location.hostname.split('.')[0];
  const hostType: FavoriteTargetType | null = HOST_TYPE[subdomain] ?? null;
  const [tab, setTab] = useState<FavoriteTargetType>(hostType ?? 'GAME');
  const type = hostType ?? tab;
  const loggedIn = isLoggedIn();
  const labels = lang === 'en' ? TYPE_LABELS_EN : TYPE_LABELS_KO;

  const cards = useFavoriteCards(type, loggedIn);

  useSeo({
    title: lang === 'en' ? 'My favorites' : '내 찜',
    lang,
    noindex: true, // 개인 화면 — 색인 대상 아님
  });

  return (
    <div className={`favorites-page${subdomain === 'game' ? ' kh-arcade' : ''}`}>
      <header className="favorites-head kh-section-head">
        <h1 className="favorites-title">
          {lang === 'en' ? 'My favorites' : '내 찜'}
          {hostType && <span className="favorites-scope kh-mono">{labels[hostType]}</span>}
        </h1>
      </header>

      {/* 호스트가 정해지지 않은 apex/개발 환경에서만 타입 탭을 보인다 */}
      {!hostType && (
        <nav className="favorites-tabs" aria-label={lang === 'en' ? 'Favorite types' : '찜 종류'}>
          {TAB_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className={`favorites-tab${tab === t ? ' is-active' : ''}`}
              aria-pressed={tab === t}
              onClick={() => setTab(t)}
            >
              {labels[t]}
            </button>
          ))}
        </nav>
      )}

      {!loggedIn && (
        <p className="favorites-status">
          {lang === 'en' ? 'Sign in to see what you saved. ' : '로그인하면 찜한 것을 모아볼 수 있습니다. '}
          <Link
            className="favorites-login"
            to={`/shop/login?next=${encodeURIComponent(pathname)}`}
          >
            {lang === 'en' ? 'Sign in' : '로그인'}
          </Link>
        </p>
      )}

      {loggedIn && cards.isLoading && (
        <p className="favorites-status">{lang === 'en' ? 'Loading…' : '불러오는 중…'}</p>
      )}

      {loggedIn && cards.isError && (
        <p className="favorites-status">
          {lang === 'en' ? 'Could not load favorites — try again later.' : '찜 목록을 불러오지 못했습니다 — 잠시 후 다시 시도해 주세요.'}
        </p>
      )}

      {loggedIn && cards.data && cards.data.cards.length === 0 && (
        <p className="favorites-status">
          {lang === 'en'
            ? `No saved ${labels[type].toLowerCase()} yet — tap the heart to save one.`
            : `아직 찜한 ${labels[type]}이(가) 없습니다 — 하트를 눌러 담아 보세요.`}
        </p>
      )}

      {loggedIn && cards.data && cards.data.cards.length > 0 && (
        <ul className="favorites-grid">
          {cards.data.cards.map((card) => (
            <li key={card.targetKey} className="favorites-card kh-slab">
              {card.external ? (
                <a className="favorites-card__link" href={card.href}>
                  <FavoriteCardBody card={card} />
                </a>
              ) : (
                <Link className="favorites-card__link" to={card.href} viewTransition>
                  <FavoriteCardBody card={card} />
                </Link>
              )}
              <span className="favorites-card__action">
                <FavoriteButton type={type} targetKey={card.targetKey} compact />
              </span>
            </li>
          ))}
        </ul>
      )}

      {loggedIn && cards.data && cards.data.missing > 0 && (
        <p className="favorites-note kh-mono">
          {lang === 'en'
            ? `${cards.data.missing} saved item(s) are no longer available.`
            : `${cards.data.missing}개 항목은 더 이상 제공되지 않아 보이지 않습니다.`}
        </p>
      )}

      <Footer />
    </div>
  );
}

function FavoriteCardBody({ card }: { card: FavoriteCard }) {
  return (
    <>
      {card.imageUrl && <img className="favorites-card__cover" src={card.imageUrl} alt="" loading="lazy" />}
      <span className="favorites-card__title">{card.title}</span>
      {card.meta && <span className="favorites-card__meta kh-mono">{card.meta}</span>}
    </>
  );
}
