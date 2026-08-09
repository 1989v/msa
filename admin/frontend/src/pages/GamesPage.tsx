import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper, useReactTable, getCoreRowModel } from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import { ExternalLink } from 'lucide-react';
import {
  fetchAdminGames,
  fetchAdminGame,
  fetchGameTags,
  updateGameMetadata,
  updateGameTags,
  changeGameStatus,
  GENRES,
  GAME_STATUSES,
} from '@/api/games';
import type {
  AdminGameSummary,
  AdminGameDetail,
  GameMetadataInput,
  GameSort,
  GameStatus,
  GameStatusAction,
  Genre,
} from '@/api/games';
import { CollectionsPanel } from '@/pages/games/CollectionsPanel';
import { DataTable } from '@/components/common/DataTable';
import { Pagination } from '@/components/common/Pagination';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;
const GAME_HOST = 'https://game.1989v.com';

const STATUS_LABEL: Record<GameStatus, string> = {
  DRAFT: '초안',
  REVIEW: '검수',
  BETA: '베타',
  PUBLISHED: '공개',
  SUSPENDED: '숨김',
};

const STATUS_BADGE: Record<GameStatus, string> = {
  DRAFT: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  REVIEW: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  BETA: 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300',
  PUBLISHED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  SUSPENDED: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
};

interface Transition {
  action: GameStatusAction;
  label: string;
}

/**
 * 도메인 Game 상태머신을 그대로 옮긴 표. 여기 없는 조합은 UI 에서 아예 제시하지 않는다
 * (서버가 InvalidGameStatusException 으로 거절하기 전에 막는다).
 */
const TRANSITIONS: Record<GameStatus, Transition[]> = {
  DRAFT: [{ action: 'SUBMIT_REVIEW', label: '검수 요청' }],
  REVIEW: [{ action: 'LAUNCH_BETA', label: '베타 오픈' }],
  BETA: [
    { action: 'PUBLISH', label: '정식 공개' },
    { action: 'SUSPEND', label: '숨김' },
  ],
  PUBLISHED: [{ action: 'SUSPEND', label: '숨김' }],
  SUSPENDED: [{ action: 'RESUME', label: '공개 복귀' }],
};

/** 목록 행의 한 번 클릭 토글 — PUBLISHED ⇄ SUSPENDED 만 해당한다 */
function rowToggle(status: GameStatus): Transition | null {
  if (status === 'PUBLISHED') return { action: 'SUSPEND', label: '숨김' };
  if (status === 'SUSPENDED') return { action: 'RESUME', label: '공개' };
  return null;
}

function previewUrl(slug: string): string {
  return `${GAME_HOST}/games/${slug}`;
}

const columnHelper = createColumnHelper<AdminGameSummary>();

function SeoNotice() {
  return (
    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
      SEO 프리렌더는 portal-fe 재배포 전까지 반영되지 않습니다 — 목록/상세 API 는 즉시 바뀝니다.
    </p>
  );
}

interface GameDraft {
  form: GameMetadataInput;
  tags: string[];
}

function GameEditDialog({ slug, onClose }: { slug: string; onClose: () => void }) {
  const { data: detail } = useQuery({
    queryKey: ['admin-game', slug],
    queryFn: () => fetchAdminGame(slug),
  });

  return (
    <Dialog open onClose={onClose} title={`게임 수정 — ${slug}`} className="max-w-2xl">
      {detail ? (
        <GameEditForm detail={detail} onClose={onClose} />
      ) : (
        <p className="py-8 text-center text-sm text-zinc-500">불러오는 중...</p>
      )}
    </Dialog>
  );
}

/**
 * 상세가 도착한 뒤에 마운트되므로 폼 초기값을 그 자리에서 잡는다. 이후 재조회(상태 전이 등)로
 * `detail` 이 갱신돼도 편집 중인 입력은 그대로 유지된다.
 */
function GameEditForm({ detail, onClose }: { detail: AdminGameDetail; onClose: () => void }) {
  const slug = detail.slug;
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<GameDraft>(() => ({
    form: {
      title: detail.title,
      description: detail.description,
      titleEn: detail.titleEn ?? '',
      descriptionEn: detail.descriptionEn ?? '',
      thumbnailUrl: detail.thumbnailUrl,
      genre: detail.genre,
    },
    tags: detail.tags,
  }));
  const [error, setError] = useState<string | null>(null);

  const { data: tagOptions = [] } = useQuery({
    queryKey: ['game-tags'],
    queryFn: fetchGameTags,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-games'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-game', slug] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      await updateGameMetadata(slug, draft.form);
      const changed =
        draft.tags.length !== detail.tags.length || draft.tags.some((t) => !detail.tags.includes(t));
      if (changed) await updateGameTags(slug, draft.tags);
    },
    onSuccess: () => {
      // 낙관적 갱신 대신 재조회 — 서버가 정규화한 값(공백 → null 등)을 그대로 반영한다
      refresh();
      onClose();
    },
    onError: () => setError('저장에 실패했습니다'),
  });

  const statusMutation = useMutation({
    mutationFn: (action: GameStatusAction) => changeGameStatus(slug, action),
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: () => setError('상태 변경에 실패했습니다'),
  });

  const set = <K extends keyof GameMetadataInput>(field: K) => (value: GameMetadataInput[K]) =>
    setDraft((prev) => ({ ...prev, form: { ...prev.form, [field]: value } }));

  const toggleTag = (tagSlug: string) =>
    setDraft((prev) => ({
      ...prev,
      tags: prev.tags.includes(tagSlug)
        ? prev.tags.filter((t) => t !== tagSlug)
        : [...prev.tags, tagSlug],
    }));

  const { form, tags } = draft;
  // 카탈로그 태그 목록에 없더라도 이미 붙어 있는 태그는 해제할 수 있어야 한다
  const tagChoices = [
    ...tagOptions,
    ...tags.filter((t) => !tagOptions.some((o) => o.slug === t)).map((t) => ({ slug: t, name: t })),
  ];

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        saveMutation.mutate();
      }}
    >
      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Badge className={STATUS_BADGE[detail.status]}>{STATUS_LABEL[detail.status]}</Badge>
        {TRANSITIONS[detail.status].map((t) => (
          <Button
            key={t.action}
            type="button"
            variant="outline"
            size="sm"
            disabled={statusMutation.isPending}
            onClick={() => statusMutation.mutate(t.action)}
          >
            {t.label}
          </Button>
        ))}
        <a
          href={previewUrl(detail.slug)}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-sm text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-300"
        >
          미리보기 <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1" htmlFor="game-title">제목 (ko)</label>
          <Input id="game-title" value={form.title} onChange={(e) => set('title')(e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1" htmlFor="game-title-en">제목 (en)</label>
          <Input id="game-title-en" value={form.titleEn} onChange={(e) => set('titleEn')(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1" htmlFor="game-desc">설명 (ko)</label>
        <textarea
          id="game-desc"
          value={form.description}
          onChange={(e) => set('description')(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1" htmlFor="game-desc-en">설명 (en)</label>
        <textarea
          id="game-desc-en"
          value={form.descriptionEn}
          onChange={(e) => set('descriptionEn')(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1" htmlFor="game-thumb">썸네일 URL</label>
          <Input id="game-thumb" value={form.thumbnailUrl} onChange={(e) => set('thumbnailUrl')(e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1" htmlFor="game-genre">장르</label>
          <Select
            id="game-genre"
            value={form.genre}
            onChange={(e) => set('genre')(e.target.value as Genre)}
            className="w-full"
          >
            {GENRES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <span className="block text-xs font-medium text-zinc-500 mb-1">태그</span>
        <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
          {tagChoices.map((t) => (
            <label key={t.slug} className="inline-flex items-center gap-1 text-xs">
              <input type="checkbox" checked={tags.includes(t.slug)} onChange={() => toggleTag(t.slug)} />
              {t.name}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1" htmlFor="game-entry">
          entry URL (읽기 전용)
        </label>
        <Input id="game-entry" value={detail.entryUrl} readOnly disabled />
      </div>

      <SeoNotice />

      <CollectionsPanel />

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onClose}>취소</Button>
        <Button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? '저장 중...' : '저장'}
        </Button>
      </div>
    </form>
  );
}

export function GamesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<GameStatus | ''>('');
  const [genre, setGenre] = useState<Genre | ''>('');
  const [sort, setSort] = useState<GameSort>('updated');
  const [editSlug, setEditSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['admin-games', page, q, status, genre, sort],
    queryFn: () => fetchAdminGames({ page, size: PAGE_SIZE, q, status, genre, sort }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ slug, action }: { slug: string; action: GameStatusAction }) =>
      changeGameStatus(slug, action),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-games'] });
    },
    onError: () => setError('상태 변경에 실패했습니다'),
  });

  const games = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;

  const columns: ColumnDef<AdminGameSummary, string>[] = [
    columnHelper.accessor('thumbnailUrl', {
      header: '',
      cell: (info) => (
        <img
          src={info.getValue()}
          alt=""
          className="h-9 w-16 rounded object-cover bg-zinc-100 dark:bg-zinc-800"
        />
      ),
    }) as ColumnDef<AdminGameSummary, string>,
    columnHelper.accessor('title', {
      header: '제목',
      cell: (info) => (
        <div className="min-w-40">
          <div className="font-medium">{info.getValue()}</div>
          <div className="text-xs text-zinc-500">{info.row.original.titleEn ?? '— (en 미입력)'}</div>
        </div>
      ),
    }) as ColumnDef<AdminGameSummary, string>,
    columnHelper.accessor('slug', {
      header: '슬러그',
      cell: (info) => <span className="font-mono text-xs text-zinc-500">{info.getValue()}</span>,
    }) as ColumnDef<AdminGameSummary, string>,
    columnHelper.accessor('status', {
      header: '상태',
      cell: (info) => {
        const value = info.getValue() as GameStatus;
        return <Badge className={STATUS_BADGE[value]}>{STATUS_LABEL[value]}</Badge>;
      },
    }) as ColumnDef<AdminGameSummary, string>,
    columnHelper.accessor('genre', { header: '장르' }) as ColumnDef<AdminGameSummary, string>,
    columnHelper.accessor('tags', {
      header: '태그',
      cell: (info) => (
        <span className="text-xs text-zinc-500">{info.row.original.tags.join(', ') || '—'}</span>
      ),
    }) as ColumnDef<AdminGameSummary, string>,
    columnHelper.accessor('playCount', {
      header: '플레이',
      cell: (info) => <span className="tabular-nums">{Number(info.getValue()).toLocaleString()}</span>,
    }) as ColumnDef<AdminGameSummary, string>,
    columnHelper.accessor('updatedAt', {
      header: '수정일',
      cell: (info) => (
        <span className="text-xs text-zinc-500">
          {new Date(info.getValue()).toLocaleDateString('ko-KR')}
        </span>
      ),
    }) as ColumnDef<AdminGameSummary, string>,
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const toggle = rowToggle(row.original.status);
        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!toggle || toggleMutation.isPending}
              title={toggle ? undefined : '공개/숨김 토글은 공개·숨김 상태에서만 가능합니다'}
              onClick={(e) => {
                e.stopPropagation();
                if (toggle) toggleMutation.mutate({ slug: row.original.slug, action: toggle.action });
              }}
            >
              {toggle?.label ?? '공개'}
            </Button>
            <a
              href={previewUrl(row.original.slug)}
              target="_blank"
              rel="noreferrer"
              aria-label={`${row.original.title} 미리보기`}
              className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        );
      },
    }) as ColumnDef<AdminGameSummary, string>,
  ];

  const table = useReactTable({
    data: games,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">게임 카탈로그</h1>
        <span className="text-sm text-zinc-500">총 {data?.totalElements ?? 0}종</span>
      </div>

      <SeoNotice />

      <CollectionsPanel />

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </div>
      )}

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(searchInput);
          setPage(0);
        }}
      >
        <Input
          placeholder="제목 · 슬러그 검색..."
          aria-label="게임 검색"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="max-w-xs"
        />
        <Button type="submit" variant="outline" size="sm">검색</Button>
        <Select
          aria-label="상태 필터"
          value={status}
          onChange={(e) => { setStatus(e.target.value as GameStatus | ''); setPage(0); }}
          className="w-36"
        >
          <option value="">전체 상태</option>
          {GAME_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </Select>
        <Select
          aria-label="장르 필터"
          value={genre}
          onChange={(e) => { setGenre(e.target.value as Genre | ''); setPage(0); }}
          className="w-36"
        >
          <option value="">전체 장르</option>
          {GENRES.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </Select>
        <Select
          aria-label="정렬"
          value={sort}
          onChange={(e) => { setSort(e.target.value as GameSort); setPage(0); }}
          className={cn('w-36')}
        >
          <option value="updated">최근 수정순</option>
          <option value="created">등록순</option>
          <option value="title">제목순</option>
          <option value="playCount">플레이순</option>
        </Select>
      </form>

      <DataTable table={table} onRowClick={(row) => setEditSlug(row.slug)} />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {editSlug && <GameEditDialog slug={editSlug} onClose={() => setEditSlug(null)} />}
    </div>
  );
}
