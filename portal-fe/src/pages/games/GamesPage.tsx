import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  fetchGameCollections,
  fetchGameTags,
  listGames,
  genreLabel,
  setGameLang,
  GENRE_LABELS,
  type GameCollection,
  type GameGenre,
  type GameLang,
  type GameSummary,
  type GameSortKey,
  type GameTag,
} from '../../api/gameApi';
import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  gamePath,
  gameUrl,
  genreFromSlug,
  genreMeta,
  genreSlug,
  hreflangAlternates,
  hubMeta,
  itemListJsonLd,
} from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import GameCard from './GameCard';
import HouseBanner from './HouseBanner';
import LeaderboardRail from './LeaderboardRail';
import './Games.css';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import GNB from '../../components/GNB';
import Footer from '../../components/Footer';
import AdSlot from '../../components/ads/AdSlot';
import { ADSENSE_SLOTS } from '../../seo/copy.mjs';

const UI = {
  ko: {
    subtitle: '코드베이스 개념으로 만든 미니게임 아케이드',
    sortTrending: '인기', sortNew: '신작', sortTop: '평점',
    all: '전체', allGames: '전체 게임',
    loading: '불러오는 중…', error: '게임 목록을 불러오지 못했습니다.', empty: '조건에 맞는 게임이 없습니다.',
    filterLabel: '게임 필터', genreLabel: '장르 카테고리', allLabel: '전체 게임',
  },
  en: {
    subtitle: 'A mini-game arcade built from codebase concepts',
    sortTrending: 'Trending', sortNew: 'New', sortTop: 'Top Rated',
    all: 'All', allGames: 'All Games',
    loading: 'Loading…', error: 'Could not load the game list.', empty: 'No games match the filter.',
    filterLabel: 'Game filters', genreLabel: 'Genre categories', allLabel: 'All games',
  },
} as const;

/** 카테고리 섹션 노출 순서 — 명확한 분류 축 (task: 카테고리 명확화) */
const GENRE_ORDER: GameGenre[] = [
  'DEFENSE', 'ACTION', 'STRATEGY', 'RPG', 'ARCADE', 'PUZZLE', 'VERSUS', 'CASUAL', 'EDUCATION',
];

const GENRES = Object.keys(GENRE_LABELS) as GameGenre[];

/** 허브 경로 — game 서브도메인에서는 루트가, 그 외 호스트에서는 /games 가 허브다 */
const HUB_SUB = window.location.hostname.split('.')[0] === 'game' ? '' : '/games';

/**
 * 행 간 중복 제거는 백엔드(GameQueryService)가 한다 — 노출 순서가 아니라
 * MANUAL → NEW → TAG_BASED → TRENDING 우선순위로 배정해, '지금 인기'가 신작을 먼저
 * 집어가 '새로 나온 게임'에 남은 옛 게임이 실리는 문제를 피한다(TRENDING 은 다음 인기
 * 게임으로 뒤를 채울 수 있는 유일한 행이라 맨 나중). 빈 행도 서버가 이미 뺀다 —
 * 여기 필터는 구버전 응답에 대한 방어일 뿐이다.
 */
function visibleCollections(collections: GameCollection[]): GameCollection[] {
  return collections.filter((col) => col.games.length > 0);
}

export default function GamesPage() {
  useHeritageSurface();
  const { pathname } = useLocation();
  const { genre: genreParam } = useParams();
  const navigate = useNavigate();
  const [collections, setCollections] = useState<GameCollection[]>([]);
  const [tags, setTags] = useState<GameTag[]>([]);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sort, setSort] = useState<GameSortKey>('trending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // 언어와 장르는 URL 이 원본 — 검색엔진이 색인할 수 있는 상태만 주소로 승격한다.
  // (정렬·태그는 같은 게임 목록의 재배열이라 중복 콘텐츠가 되므로 로컬 상태로 둔다)
  const lang: GameLang = pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'ko';
  const genre = genreFromSlug(genreParam) as GameGenre | null;

  const L = UI[lang];
  const SORTS: { key: GameSortKey; label: string }[] = [
    { key: 'trending', label: L.sortTrending },
    { key: 'new', label: L.sortNew },
    { key: 'top', label: L.sortTop },
  ];

  useEffect(() => {
    Promise.allSettled([fetchGameCollections(), fetchGameTags()]).then(([c, t]) => {
      if (c.status === 'fulfilled') setCollections(visibleCollections(c.value));
      if (t.status === 'fulfilled') setTags(t.value);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(false);
    listGames({ tag: activeTag ?? undefined, genre: genre ?? undefined, sort, size: 48 })
      .then((page) => setGames(page.content))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [activeTag, genre, sort]);

  // 필터가 걸리면 큐레이션 행 대신 그리드만 노출
  const showCollections = useMemo(
    () => !activeTag && !genre && sort === 'trending',
    [activeTag, genre, sort],
  );

  // 무필터 기본 화면은 장르 섹션으로 그룹핑해 카테고리를 명확히 보여준다
  const genreSections = useMemo(() => {
    if (activeTag || genre) return null;
    const byGenre = new Map<GameGenre, GameSummary[]>();
    games.forEach((g) => {
      const list = byGenre.get(g.genre) ?? [];
      list.push(g);
      byGenre.set(g.genre, list);
    });
    return GENRE_ORDER.filter((key) => byGenre.has(key)).map((key) => ({
      key,
      games: byGenre.get(key)!,
    }));
  }, [activeTag, genre, games]);

  const seoSub = genre ? `/games/genre/${genreSlug(genre)}` : '';
  const meta = genre ? genreMeta(lang, genre, games) : hubMeta(lang, games.length);
  const canonical = gameUrl(lang, seoSub);
  useSeo({
    // 목록이 오기 전에는 프리렌더된 메타를 유지한다 — "게임 0종" 스냅샷이 색인되면 안 된다
    title: loading && games.length === 0 ? '' : meta.title,
    description: meta.description,
    canonical,
    lang,
    alternates: hreflangAlternates(seoSub),
    jsonLd: [
      collectionPageJsonLd(lang, meta, canonical),
      ...(games.length > 0 ? [itemListJsonLd(lang, games.slice(0, 30))] : []),
      ...(genre
        ? [
            breadcrumbJsonLd(lang, [
              { name: lang === 'en' ? 'Games' : '게임', url: gameUrl(lang) },
              { name: meta.heading, url: canonical },
            ]),
          ]
        : []),
    ],
  });

  function switchLang(next: GameLang) {
    // iframe 게임(public/games/lib/i18n.js)이 같은 localStorage 키를 읽는다
    setGameLang(next);
    const sub = genre
      ? `/games/genre/${genreSlug(genre)}`
      : pathname.endsWith('/games')
        ? '/games'
        : '';
    navigate(gamePath(next, sub));
  }

  return (
    <>
      {/* 머리띠는 컨테이너 **밖**에 둔다 — 안에 넣으면 max-width 에 갇혀 전폭이 아니게 된다.
          메뉴는 비운다: 게임 안의 이동은 아래 툴바가 맡고, 게임 호스트에서는 같은 경로가
          다른 화면을 가리키므로 링크를 섞으면 어긋난다. */}
      <GNB items={[]} />
      <div className="games-page kh-arcade">
      {/* 내 찜 진입 — 상세 페이지 topbar 와 같은 자리 (ADR-0074) */}
      <div className="games-topbar">
        <Link className="games-favorites-link" to={lang === 'en' ? '/en/favorites' : '/favorites'} viewTransition>
          {lang === 'en' ? 'My favorites' : '내 찜'}
        </Link>
      </div>
      <header className="games-header">
        <h1 className="games-title">
          {meta.heading}
          <span className="games-lang-toggle" role="group" aria-label="Language">
            {(['ko', 'en'] as GameLang[]).map((key) => (
              <button
                key={key}
                className={`games-lang-btn ${lang === key ? 'active' : ''}`}
                onClick={() => switchLang(key)}
              >
                {key === 'ko' ? '한' : 'EN'}
              </button>
            ))}
          </span>
        </h1>
        <p className="games-subtitle">{L.subtitle}</p>
      </header>

      {/* 기록이 있는 게임이 하나도 없으면 스스로 아무것도 그리지 않는다 */}
      <LeaderboardRail lang={lang} />

      <HouseBanner placementKey="game-list-banner" />

      <div className="games-toolbar" role="toolbar" aria-label={L.filterLabel}>
        <div className="games-sorts">
          {SORTS.map((s) => (
            <button
              key={s.key}
              className={`games-sort-btn ${sort === s.key ? 'active' : ''}`}
              onClick={() => setSort(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
        {/* 장르는 링크 — 크롤러가 장르 랜딩 페이지를 따라갈 수 있어야 한다 (버튼은 못 따라감) */}
        <nav className="games-genres" aria-label={L.genreLabel}>
          <Link
            className={`game-genre-btn ${genre === null ? 'active' : ''}`}
            to={gamePath(lang, HUB_SUB)}
          >
            {L.all}
          </Link>
          {GENRES.map((key) => (
            <Link
              key={key}
              className={`game-genre-btn ${genre === key ? 'active' : ''}`}
              to={genre === key ? gamePath(lang, HUB_SUB) : gamePath(lang, `/games/genre/${genreSlug(key)}`)}
            >
              {genreLabel(key, lang)}
            </Link>
          ))}
        </nav>
        <div className="games-tags">
          <button
            className={`game-tag-filter ${activeTag === null ? 'active' : ''}`}
            onClick={() => setActiveTag(null)}
          >
            {L.all}
          </button>
          {tags.map((tag) => (
            <button
              key={tag.slug}
              className={`game-tag-filter ${activeTag === tag.slug ? 'active' : ''}`}
              onClick={() => setActiveTag(activeTag === tag.slug ? null : tag.slug)}
            >
              {tag.name}
            </button>
          ))}
        </div>
      </div>

      {showCollections &&
        collections.map((collection) => (
          <section key={collection.slug} className="games-collection" aria-label={collection.title}>
            <h2 className="games-collection-title">{collection.title}</h2>
            <div className="games-row">
              {collection.games.map((game) => (
                <GameCard key={game.slug} game={game} lang={lang} />
              ))}
            </div>
          </section>
        ))}

      <section className="games-all" aria-label={L.allLabel}>
        {loading && <p className="games-status">{L.loading}</p>}
        {error && <p className="games-status">{L.error}</p>}
        {!loading && !error && games.length === 0 && <p className="games-status">{L.empty}</p>}

        {genreSections
          ? genreSections.map((section) => (
              <div key={section.key} className="games-genre-section">
                <h2 className="games-collection-title">
                  <Link to={gamePath(lang, `/games/genre/${genreSlug(section.key)}`)}>
                    {genreLabel(section.key, lang)}
                  </Link>
                  <span className="games-genre-count">{section.games.length}</span>
                </h2>
                <div className="games-grid">
                  {section.games.map((game) => (
                    <GameCard key={game.slug} game={game} lang={lang} />
                  ))}
                </div>
              </div>
            ))
          : (
            <>
              <h2 className="games-collection-title">
                {activeTag ? `#${activeTag}` : genre ? genreLabel(genre, lang) : L.allGames}
              </h2>
              <div className="games-grid">
                {games.map((game) => (
                  <GameCard key={game.slug} game={game} lang={lang} />
                ))}
              </div>
            </>
          )}
      </section>

      {/* 목록 끝. 게임 프레임(iframe) 안에는 두지 않는다 — 조작 방해이자 정책 위반 (ADR-0076) */}
      <AdSlot slot={ADSENSE_SLOTS.gameHubEnd} shape="horizontal" minHeight={90} />

      <Footer />
      </div>
    </>
  );
}
