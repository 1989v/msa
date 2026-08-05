import { useEffect, useMemo, useState } from 'react';
import {
  fetchGameCollections,
  fetchGameTags,
  listGames,
  genreLabel,
  getGameLang,
  setGameLang,
  GENRE_LABELS,
  type GameCollection,
  type GameGenre,
  type GameLang,
  type GameSummary,
  type GameSortKey,
  type GameTag,
} from '../../api/gameApi';
import GameCard from './GameCard';
import HouseBanner from './HouseBanner';
import './Games.css';

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

/** 큐레이션 행 간 중복 제거 — 한 게임은 첫 노출 행에만 남기고, 비어버린 행은 숨긴다 */
function dedupeCollections(collections: GameCollection[]): GameCollection[] {
  const seen = new Set<string>();
  return collections
    .map((col) => {
      const games = col.games.filter((g) => !seen.has(g.slug));
      games.forEach((g) => seen.add(g.slug));
      return { ...col, games };
    })
    .filter((col) => col.games.length > 0);
}

export default function GamesPage() {
  const [collections, setCollections] = useState<GameCollection[]>([]);
  const [tags, setTags] = useState<GameTag[]>([]);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [genre, setGenre] = useState<GameGenre | null>(null);
  const [sort, setSort] = useState<GameSortKey>('trending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lang, setLang] = useState<GameLang>(getGameLang());

  const L = UI[lang];
  const SORTS: { key: GameSortKey; label: string }[] = [
    { key: 'trending', label: L.sortTrending },
    { key: 'new', label: L.sortNew },
    { key: 'top', label: L.sortTop },
  ];

  useEffect(() => {
    Promise.allSettled([fetchGameCollections(), fetchGameTags()]).then(([c, t]) => {
      if (c.status === 'fulfilled') setCollections(dedupeCollections(c.value));
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

  function switchLang(next: GameLang) {
    setGameLang(next);
    setLang(next);
  }

  return (
    <div className="games-page">
      <header className="games-header">
        <h1 className="games-title">
          Games
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
        <div className="games-genres" role="group" aria-label={L.genreLabel}>
          <button
            className={`game-genre-btn ${genre === null ? 'active' : ''}`}
            onClick={() => setGenre(null)}
          >
            {L.all}
          </button>
          {GENRES.map((key) => (
            <button
              key={key}
              className={`game-genre-btn ${genre === key ? 'active' : ''}`}
              onClick={() => setGenre(genre === key ? null : key)}
            >
              {genreLabel(key, lang)}
            </button>
          ))}
        </div>
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
                  {genreLabel(section.key, lang)}
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
    </div>
  );
}
