import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchFavorites, type FavoriteTargetType } from '../../api/wishlistApi';
import { CollectionBar, MoveToCollection } from './FavoriteCollections';
import CollectionShareBar from './CollectionShareBar';
import { useCollections, type CollectionFilter } from './useCollections';
import { buildLoginHref, isLoggedIn } from '../../auth/auth';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import { useSeo } from '../../seo/useSeo';
import FavoriteButton from './FavoriteButton';
import FavoriteCardItem from './FavoriteCardItem';
import { hydrate, type FavoriteCard } from './favoriteCards';
import Footer from '../Footer';
import './FavoritesPage.css';

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

function useFavoriteCards(type: FavoriteTargetType, filter: CollectionFilter, enabled: boolean) {
  const scope = filter.kind === 'one' ? filter.id : filter.kind;
  return useQuery({
    queryKey: ['favorites', 'list', type, scope],
    queryFn: async () => {
      const page = await fetchFavorites({
        type,
        size: 100,
        collectionId: filter.kind === 'one' ? filter.id : undefined,
        unclassified: filter.kind === 'unclassified',
      });
      const hydrated = await Promise.all(page.items.map((item) => hydrate(type, item.targetKey)));
      // 소속은 찜 레코드가 알고 대상 서비스는 모른다 — 하이드레이션 결과에 얹는다
      const cards = hydrated
        .map((card, i) => (card ? { ...card, collectionId: page.items[i].collectionId } : null))
        .filter((card): card is FavoriteCard => card !== null);
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

  // 묶음은 관광지에만 (ADR-0080 §4) — 게임·블로그 글을 여행 묶음에 넣을 이유가 없다
  const grouped = type === 'ATTRACTION';
  const [filter, setFilter] = useState<CollectionFilter>({ kind: 'all' });
  const collections = useCollections(loggedIn && grouped);
  const cards = useFavoriteCards(type, grouped ? filter : { kind: 'all' }, loggedIn);
  const sharedCollection =
    filter.kind === 'one' ? collections.data?.find((c) => c.id === filter.id) : undefined;

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

      {loggedIn && grouped && collections.data && (
        <CollectionBar
          collections={collections.data}
          filter={filter}
          onChange={setFilter}
          lang={lang}
        />
      )}

      {/* 공유는 묶음 하나를 골랐을 때만 — 「전체」·「미분류」는 공유 단위가 아니다 (ADR-0107) */}
      {loggedIn && grouped && filter.kind === 'one' && sharedCollection && (
        <CollectionShareBar key={sharedCollection.id} collection={sharedCollection} lang={lang} />
      )}

      {!loggedIn && (
        <p className="favorites-status">
          {lang === 'en' ? 'Sign in to see what you saved. ' : '로그인하면 찜한 것을 모아볼 수 있습니다. '}
          <a className="favorites-login" href={buildLoginHref()}>
            {lang === 'en' ? 'Sign in' : '로그인'}
          </a>
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
            <FavoriteCardItem key={card.targetKey} card={card}>
              {grouped && collections.data && (
                <MoveToCollection
                  type={type}
                  targetKey={card.targetKey}
                  current={card.collectionId ?? null}
                  collections={collections.data}
                  lang={lang}
                />
              )}
              <FavoriteButton type={type} targetKey={card.targetKey} compact />
            </FavoriteCardItem>
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
