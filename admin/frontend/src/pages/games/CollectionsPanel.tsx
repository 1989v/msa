import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import {
  fetchAdminGames,
  fetchCollections,
  updateCollection,
  type AdminCollection,
  type AdminGameSummary,
  type CollectionType,
} from '@/api/games';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const TYPE_LABEL: Record<CollectionType, string> = {
  MANUAL: '직접 선택',
  TRENDING: '자동 · 인기순',
  NEW: '자동 · 최신순',
  TAG_BASED: '자동 · 태그',
};

/** MANUAL 은 목록 전체가 선택이고, 자동 산출 컬렉션은 선택분이 맨 앞 고정이다. */
function pickHelp(type: CollectionType, tagSlug: string | null): string {
  if (type === 'MANUAL') return '고른 순서 그대로 노출됩니다.';
  const basis = type === 'TRENDING' ? '플레이 통계' : type === 'NEW' ? '출시일' : `태그 #${tagSlug ?? '—'}`;
  return `${basis}로 자동 구성됩니다. 아래에서 고른 게임만 맨 앞에 고정됩니다.`;
}

interface RowProps {
  collection: AdminCollection;
  games: AdminGameSummary[];
  onError: (message: string | null) => void;
}

function CollectionRow({ collection, games, onError }: RowProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(collection.title);
  const [order, setOrder] = useState(String(collection.displayOrder));
  const [picked, setPicked] = useState<number[]>(collection.gameIds);
  const [search, setSearch] = useState('');

  const byId = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);
  const candidates = useMemo(() => {
    const term = search.trim().toLowerCase();
    return games
      .filter((g) => !picked.includes(g.id))
      .filter((g) => !term || g.title.toLowerCase().includes(term) || g.slug.includes(term))
      .slice(0, 12);
  }, [games, picked, search]);

  const dirty =
    title !== collection.title ||
    order !== String(collection.displayOrder) ||
    picked.join(',') !== collection.gameIds.join(',');

  const save = useMutation({
    mutationFn: () =>
      updateCollection(collection.slug, {
        title,
        displayOrder: Number(order),
        gameIds: picked,
      }),
    onSuccess: () => {
      onError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-collections'] });
    },
    onError: () => onError(`'${collection.title}' 저장에 실패했습니다`),
  });

  const toggleActive = useMutation({
    mutationFn: () => updateCollection(collection.slug, { active: !collection.active }),
    onSuccess: () => {
      onError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-collections'] });
    },
    onError: () => onError(`'${collection.title}' 노출 전환에 실패했습니다`),
  });

  function move(index: number, delta: number) {
    const next = [...picked];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setPicked(next);
  }

  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <button
          type="button"
          className="flex-1 text-left font-medium"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {collection.title}
          <span className="ml-2 font-mono text-xs text-zinc-500">{collection.slug}</span>
        </button>
        <Badge className="bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {TYPE_LABEL[collection.type]}
        </Badge>
        <span className="text-xs text-zinc-500">순서 {collection.displayOrder}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => toggleActive.mutate()}
          disabled={toggleActive.isPending}
        >
          {collection.active ? '노출 중' : '숨김'}
        </Button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-zinc-200 px-3 py-3 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">{pickHelp(collection.type, collection.tagSlug)}</p>

          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-zinc-500">
              제목
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-56" />
            </label>
            <label className="text-xs text-zinc-500">
              노출 순서
              <Input
                type="number"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                className="mt-1 w-24"
              />
            </label>
          </div>

          <div>
            <div className="mb-1 text-xs text-zinc-500">
              {collection.type === 'MANUAL' ? '노출 게임' : '앞에 고정할 게임'} ({picked.length})
            </div>
            {picked.length === 0 ? (
              <p className="text-xs text-zinc-400">선택 없음</p>
            ) : (
              <ol className="space-y-1">
                {picked.map((id, index) => (
                  <li
                    key={id}
                    className="flex items-center gap-2 rounded border border-zinc-200 px-2 py-1 text-sm dark:border-zinc-800"
                  >
                    <span className="w-6 text-xs tabular-nums text-zinc-500">{index + 1}</span>
                    <span className="flex-1">{byId.get(id)?.title ?? `#${id} (목록 밖)`}</span>
                    <button
                      type="button"
                      aria-label="위로"
                      onClick={() => move(index, -1)}
                      className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="아래로"
                      onClick={() => move(index, 1)}
                      className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="제거"
                      onClick={() => setPicked(picked.filter((v) => v !== id))}
                      className="text-zinc-500 hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div>
            <Input
              placeholder="게임 검색 후 클릭해 추가..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {candidates.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setPicked([...picked, g.id])}
                  className="rounded-full border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  + {g.title}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setTitle(collection.title);
                setOrder(String(collection.displayOrder));
                setPicked(collection.gameIds);
              }}
              disabled={!dirty}
            >
              되돌리기
            </Button>
            <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
              저장
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CollectionsPanel() {
  const [error, setError] = useState<string | null>(null);

  const { data: collections } = useQuery({
    queryKey: ['admin-collections'],
    queryFn: fetchCollections,
  });
  // 게임 선택지는 한 번에 받아 클라이언트에서 거른다 — 카탈로그가 수십 종 규모라 페이징이 불필요하다.
  const { data: gamePage } = useQuery({
    queryKey: ['admin-games', 'all-for-collections'],
    queryFn: () => fetchAdminGames({ page: 0, size: 200, sort: 'title' }),
  });

  const games = gamePage?.content ?? [];

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">목록 구성</h2>
        <span className="text-xs text-zinc-500">게임 목록 페이지의 섹션 순서와 노출 게임</span>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </div>
      )}

      <div className="space-y-2">
        {(collections ?? []).map((c) => (
          <CollectionRow key={c.slug} collection={c} games={games} onError={setError} />
        ))}
      </div>
    </section>
  );
}
