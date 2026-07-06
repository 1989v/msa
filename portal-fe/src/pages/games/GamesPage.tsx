import { useEffect, useMemo, useState } from 'react';
import {
  fetchGameCollections,
  fetchGameTags,
  listGames,
  type GameCollection,
  type GameSummary,
  type GameSortKey,
  type GameTag,
} from '../../api/gameApi';
import GameCard from './GameCard';
import './Games.css';

const SORTS: { key: GameSortKey; label: string }[] = [
  { key: 'trending', label: '인기' },
  { key: 'new', label: '신작' },
  { key: 'top', label: '평점' },
];

export default function GamesPage() {
  const [collections, setCollections] = useState<GameCollection[]>([]);
  const [tags, setTags] = useState<GameTag[]>([]);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sort, setSort] = useState<GameSortKey>('trending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.allSettled([fetchGameCollections(), fetchGameTags()]).then(([c, t]) => {
      if (c.status === 'fulfilled') setCollections(c.value.filter((col) => col.games.length > 0));
      if (t.status === 'fulfilled') setTags(t.value);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(false);
    listGames({ tag: activeTag ?? undefined, sort, size: 48 })
      .then((page) => setGames(page.content))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [activeTag, sort]);

  // 필터가 걸리면 큐레이션 행 대신 그리드만 노출
  const showCollections = useMemo(() => !activeTag && sort === 'trending', [activeTag, sort]);

  return (
    <div className="games-page">
      <header className="games-header">
        <h1 className="games-title">Games</h1>
        <p className="games-subtitle">코드베이스 개념으로 만든 미니게임 아케이드</p>
      </header>

      <div className="games-toolbar" role="toolbar" aria-label="게임 필터">
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
        <div className="games-tags">
          <button
            className={`game-tag-filter ${activeTag === null ? 'active' : ''}`}
            onClick={() => setActiveTag(null)}
          >
            전체
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
                <GameCard key={game.slug} game={game} />
              ))}
            </div>
          </section>
        ))}

      <section className="games-all" aria-label="전체 게임">
        <h2 className="games-collection-title">{activeTag ? `#${activeTag}` : '전체 게임'}</h2>
        {loading && <p className="games-status">불러오는 중…</p>}
        {error && <p className="games-status">게임 목록을 불러오지 못했습니다.</p>}
        {!loading && !error && games.length === 0 && <p className="games-status">조건에 맞는 게임이 없습니다.</p>}
        <div className="games-grid">
          {games.map((game) => (
            <GameCard key={game.slug} game={game} />
          ))}
        </div>
      </section>
    </div>
  );
}
