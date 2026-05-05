import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper, useReactTable, getCoreRowModel } from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import {
  fetchConcepts,
  createConcept,
  updateConcept,
  deleteConcept,
  submitIndexSync,
  getIndexSyncJob,
  fetchConceptByConceptId,
} from '@/api/codeDictionary';
import type { Concept, IndexSyncJob } from '@/api/codeDictionary';
import { DataTable } from '@/components/common/DataTable';
import { Pagination } from '@/components/common/Pagination';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import TreemapSection from '@/components/codeDictionary/TreemapSection';
import { cn } from '@/lib/utils';

const columnHelper = createColumnHelper<Concept>();

const CATEGORY_OPTIONS = [
  'BASICS', 'DATA_STRUCTURE', 'ALGORITHM', 'DESIGN_PATTERN', 'CONCURRENCY',
  'DISTRIBUTED_SYSTEM', 'ARCHITECTURE', 'INFRASTRUCTURE', 'DATA', 'SECURITY',
  'NETWORK', 'TESTING', 'LANGUAGE_FEATURE',
];

const LEVEL_OPTIONS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

const LEVEL_VARIANT: Record<string, 'default' | 'outline' | 'destructive'> = {
  BEGINNER: 'outline',
  INTERMEDIATE: 'default',
  ADVANCED: 'destructive',
};

interface ConceptFormData {
  conceptId: string;
  name: string;
  category: string;
  level: string;
  description: string;
  synonyms: string;
}

const EMPTY_FORM: ConceptFormData = {
  conceptId: '',
  name: '',
  category: CATEGORY_OPTIONS[0],
  level: LEVEL_OPTIONS[0],
  description: '',
  synonyms: '',
};

type TabKey = 'treemap' | 'crud';

function ConceptFormDialog({
  open,
  onClose,
  initial,
  onSubmit,
  isSubmitting,
  title,
}: {
  open: boolean;
  onClose: () => void;
  initial: ConceptFormData;
  onSubmit: (data: ConceptFormData) => void;
  isSubmitting: boolean;
  title: string;
}) {
  const [form, setForm] = useState<ConceptFormData>(initial);

  const set = (field: keyof ConceptFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <Dialog open={open} onClose={onClose} title={title} className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Concept ID</label>
          <Input value={form.conceptId} onChange={set('conceptId')} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">이름</label>
          <Input value={form.name} onChange={set('name')} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">카테고리</label>
            <Select value={form.category} onChange={set('category')} className="w-full">
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">난이도</label>
            <Select value={form.level} onChange={set('level')} className="w-full">
              {LEVEL_OPTIONS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">설명</label>
          <textarea
            value={form.description}
            onChange={set('description')}
            rows={3}
            className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">동의어 (쉼표 구분)</label>
          <Input value={form.synonyms} onChange={set('synonyms')} placeholder="예: heap, priority queue" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>취소</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? '저장 중...' : '저장'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function CodeDictionaryPage() {
  const queryClient = useQueryClient();
  // Q8: Treemap is default tab in admin (operator quick-edit flow)
  const [tab, setTab] = useState<TabKey>('treemap');
  const [page, setPage] = useState(0);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Concept | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [treemapLoadError, setTreemapLoadError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['concepts', page, filterCategory, filterLevel],
    queryFn: () => fetchConcepts(page, 20, filterCategory || undefined, filterLevel || undefined),
  });

  const concepts = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;

  const createMutation = useMutation({
    mutationFn: (form: ConceptFormData) =>
      createConcept({
        conceptId: form.conceptId,
        name: form.name,
        category: form.category,
        level: form.level,
        description: form.description,
        synonyms: form.synonyms.split(',').map((s) => s.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['concepts'] });
      void queryClient.invalidateQueries({ queryKey: ['treemap-stats'] });
      setCreateOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, form }: { id: number; form: ConceptFormData }) =>
      updateConcept(id, {
        conceptId: form.conceptId,
        name: form.name,
        category: form.category,
        level: form.level,
        description: form.description,
        synonyms: form.synonyms.split(',').map((s) => s.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['concepts'] });
      void queryClient.invalidateQueries({ queryKey: ['treemap-stats'] });
      setEditTarget(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteConcept,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['concepts'] });
      void queryClient.invalidateQueries({ queryKey: ['treemap-stats'] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: submitIndexSync,
    onSuccess: (job: IndexSyncJob) => {
      setActiveJobId(job.jobId);
      setSyncMessage(`동기화 시작: ${job.jobId.slice(0, 8)}…`);
    },
    onError: () => {
      setSyncMessage('동기화 시작 실패');
      setTimeout(() => setSyncMessage(null), 3000);
    },
  });

  const { data: activeJob } = useQuery({
    queryKey: ['index-sync', activeJobId],
    queryFn: () => getIndexSyncJob(activeJobId as string),
    enabled: !!activeJobId,
    refetchInterval: (query) => {
      const j = query.state.data;
      if (!j) return 1000;
      return j.status === 'SUCCESS' || j.status === 'FAILED' ? false : 1000;
    },
  });

  useEffect(() => {
    if (!activeJob) return;
    if (activeJob.status === 'SUCCESS') {
      setSyncMessage(`완료 — ${activeJob.indexedCount}건 (${activeJob.newIndex ?? ''})`);
      setActiveJobId(null);
      const t = setTimeout(() => setSyncMessage(null), 6000);
      return () => clearTimeout(t);
    }
    if (activeJob.status === 'FAILED') {
      setSyncMessage(`실패: ${activeJob.error ?? '알 수 없는 오류'}`);
      setActiveJobId(null);
      const t = setTimeout(() => setSyncMessage(null), 6000);
      return () => clearTimeout(t);
    }
    if (activeJob.status === 'RUNNING') {
      setSyncMessage(`진행 중 — ${activeJob.newIndex ?? ''}`);
    }
  }, [activeJob]);

  // T3.6: tile click → fetch full concept then open edit dialog
  const handleTreemapTileClick = async (conceptId: string) => {
    setTreemapLoadError(null);
    try {
      const concept = await fetchConceptByConceptId(conceptId);
      if (concept) {
        setEditTarget(concept);
      } else {
        setTreemapLoadError(`개념을 찾을 수 없습니다: ${conceptId}`);
        setTimeout(() => setTreemapLoadError(null), 3000);
      }
    } catch {
      setTreemapLoadError('개념 정보를 불러오지 못했습니다');
      setTimeout(() => setTreemapLoadError(null), 3000);
    }
  };

  const columns: ColumnDef<Concept, string>[] = [
    columnHelper.accessor('conceptId', { header: 'Concept ID' }) as ColumnDef<Concept, string>,
    columnHelper.accessor('name', { header: '이름' }) as ColumnDef<Concept, string>,
    columnHelper.accessor('category', {
      header: '카테고리',
      cell: (info) => <Badge variant="outline">{info.getValue()}</Badge>,
    }) as ColumnDef<Concept, string>,
    columnHelper.accessor('level', {
      header: '난이도',
      cell: (info) => (
        <Badge variant={LEVEL_VARIANT[info.getValue()] ?? 'default'}>{info.getValue()}</Badge>
      ),
    }) as ColumnDef<Concept, string>,
    columnHelper.accessor('synonyms', {
      header: '동의어',
      cell: (info) => {
        const synonyms = info.row.original.synonyms;
        return <span className="text-zinc-500">{synonyms.join(', ')}</span>;
      },
    }) as ColumnDef<Concept, string>,
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          variant="destructive"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`"${row.original.name}" 개념을 삭제하시겠습니까?`)) {
              deleteMutation.mutate(row.original.id);
            }
          }}
          disabled={deleteMutation.isPending}
        >
          삭제
        </Button>
      ),
    } as ColumnDef<Concept, string>,
  ];

  const table = useReactTable({
    data: concepts,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const editInitial: ConceptFormData = editTarget
    ? {
        conceptId: editTarget.conceptId,
        name: editTarget.name,
        category: editTarget.category,
        level: editTarget.level,
        description: editTarget.description,
        synonyms: editTarget.synonyms.join(', '),
      }
    : EMPTY_FORM;

  const tabBtnBase = 'ko-tab-btn inline-flex items-center justify-center rounded-md px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-2';
  const tabBtnActive = 'bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900';
  const tabBtnIdle = 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">코드 사전</h1>
        <div className="flex items-center gap-2">
          {syncMessage && (
            <span className="text-sm text-zinc-600 dark:text-zinc-400">{syncMessage}</span>
          )}
          <Button
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || !!activeJobId}
          >
            {activeJobId || syncMutation.isPending ? '재인덱싱 중...' : 'OpenSearch 재인덱싱'}
          </Button>
          {tab === 'crud' && (
            <Button onClick={() => setCreateOpen(true)}>등록</Button>
          )}
        </div>
      </div>

      <div
        role="tablist"
        aria-label="코드 사전 보기 모드"
        className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900/40"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'treemap'}
          onClick={() => setTab('treemap')}
          className={cn(tabBtnBase, tab === 'treemap' ? tabBtnActive : tabBtnIdle)}
        >
          트리맵
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'crud'}
          onClick={() => setTab('crud')}
          className={cn(tabBtnBase, tab === 'crud' ? tabBtnActive : tabBtnIdle)}
        >
          CRUD
        </button>
      </div>

      {treemapLoadError && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300"
        >
          {treemapLoadError}
        </div>
      )}

      {tab === 'treemap' ? (
        <TreemapSection onTileClick={handleTreemapTileClick} />
      ) : (
        <>
          <div className="flex gap-3">
            <Select
              value={filterCategory}
              onChange={(e) => { setFilterCategory(e.target.value); setPage(0); }}
              className="w-48"
            >
              <option value="">전체 카테고리</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
            <Select
              value={filterLevel}
              onChange={(e) => { setFilterLevel(e.target.value); setPage(0); }}
              className="w-40"
            >
              <option value="">전체 난이도</option>
              {LEVEL_OPTIONS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </Select>
          </div>

          <DataTable table={table} onRowClick={(row) => setEditTarget(row)} />
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      <ConceptFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        initial={EMPTY_FORM}
        title="개념 등록"
        onSubmit={(form) => createMutation.mutate(form)}
        isSubmitting={createMutation.isPending}
      />

      {editTarget && (
        <ConceptFormDialog
          open
          onClose={() => setEditTarget(null)}
          initial={editInitial}
          title={`개념 수정 — ${editTarget.name}`}
          onSubmit={(form) => updateMutation.mutate({ id: editTarget.id, form })}
          isSubmitting={updateMutation.isPending}
        />
      )}
    </div>
  );
}
