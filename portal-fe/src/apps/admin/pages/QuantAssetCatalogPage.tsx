import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  fetchQuantAssets,
  createQuantAsset,
  updateQuantAsset,
  deleteQuantAsset,
  type QuantAsset,
  type AssetClass,
  type AssetSource,
} from '@admin/api/quantAssets';
import { Dialog } from '@admin/components/ui/dialog';
import { Button } from '@admin/components/ui/button';
import { Input } from '@admin/components/ui/input';
import { Select } from '@admin/components/ui/select';
import { Badge } from '@admin/components/ui/badge';

const ASSET_CLASSES: AssetClass[] = ['CRYPTO', 'STOCK_KR', 'STOCK_US'];
const SOURCES: AssetSource[] = ['yfinance', 'fdr'];

const CLASS_LABEL: Record<AssetClass, string> = {
  CRYPTO: '코인',
  STOCK_KR: '국내주식',
  STOCK_US: '미국주식',
};

interface FormData {
  assetCode: string;
  assetClass: AssetClass;
  source: AssetSource;
  displayName: string;
  active: boolean;
  sortOrder: number;
}

const EMPTY_FORM: FormData = {
  assetCode: '',
  assetClass: 'CRYPTO',
  source: 'yfinance',
  displayName: '',
  active: true,
  sortOrder: 0,
};

export function QuantAssetCatalogPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'ALL' | AssetClass>('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<QuantAsset | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  const listQ = useQuery({
    queryKey: ['quant-assets'],
    queryFn: () => fetchQuantAssets(false),
  });

  const createMut = useMutation({
    mutationFn: createQuantAsset,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quant-assets'] });
      closeDialog();
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<FormData> }) =>
      updateQuantAsset(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quant-assets'] });
      closeDialog();
    },
  });
  const deleteMut = useMutation({
    mutationFn: deleteQuantAsset,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quant-assets'] }),
  });
  const toggleActiveMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      updateQuantAsset(id, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quant-assets'] }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };
  const openEdit = (asset: QuantAsset) => {
    setEditing(asset);
    setForm({
      assetCode: asset.assetCode,
      assetClass: asset.assetClass,
      source: asset.source,
      displayName: asset.displayName,
      active: asset.active,
      sortOrder: asset.sortOrder,
    });
    setDialogOpen(true);
  };
  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const submit = () => {
    if (editing) {
      updateMut.mutate({
        id: editing.id,
        input: {
          displayName: form.displayName,
          source: form.source,
          active: form.active,
          sortOrder: form.sortOrder,
        },
      });
    } else {
      createMut.mutate({
        assetCode: form.assetCode,
        assetClass: form.assetClass,
        source: form.source,
        displayName: form.displayName,
        active: form.active,
        sortOrder: form.sortOrder,
      });
    }
  };

  const items = (listQ.data ?? []).filter((a) => filter === 'ALL' || a.assetClass === filter);

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">퀀트 자산 카탈로그</h1>
          <p className="text-sm text-zinc-500 mt-1">
            ingest sidecar 가 ClickHouse 에 적재할 종목 목록. 비활성화 시 다음 cron 부터 제외.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> 종목 추가
        </Button>
      </header>

      {/* 자산군 필터 */}
      <div className="flex gap-2">
        {(['ALL', ...ASSET_CLASSES] as const).map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              filter === c
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700'
            }`}
          >
            {c === 'ALL' ? '전체' : CLASS_LABEL[c]}
          </button>
        ))}
      </div>

      {/* 테이블 */}
      <div className="rounded-md border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">티커</th>
              <th className="px-3 py-2 font-medium">표시명</th>
              <th className="px-3 py-2 font-medium">자산군</th>
              <th className="px-3 py-2 font-medium">소스</th>
              <th className="px-3 py-2 font-medium text-right">정렬</th>
              <th className="px-3 py-2 font-medium">상태</th>
              <th className="px-3 py-2 font-medium text-right">액션</th>
            </tr>
          </thead>
          <tbody>
            {listQ.isLoading && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-zinc-500">
                  로딩 중…
                </td>
              </tr>
            )}
            {listQ.isError && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-red-500">
                  조회 실패
                </td>
              </tr>
            )}
            {items.map((a) => (
              <tr
                key={a.id}
                className="border-t border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
              >
                <td className="px-3 py-2 font-mono text-xs">{a.assetCode}</td>
                <td className="px-3 py-2 font-medium">{a.displayName}</td>
                <td className="px-3 py-2">
                  <Badge variant="outline">{CLASS_LABEL[a.assetClass]}</Badge>
                </td>
                <td className="px-3 py-2 text-zinc-500">{a.source}</td>
                <td className="px-3 py-2 text-right tabular-nums">{a.sortOrder}</td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => toggleActiveMut.mutate({ id: a.id, active: !a.active })}
                    disabled={toggleActiveMut.isPending}
                    className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                      a.active
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}
                  >
                    {a.active ? '활성' : '비활성'}
                  </button>
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => openEdit(a)}
                    className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800"
                    title="수정"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`'${a.displayName}' 을 삭제하시겠습니까?`)) {
                        deleteMut.mutate(a.id);
                      }
                    }}
                    className="p-1.5 rounded hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30"
                    title="삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {!listQ.isLoading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-zinc-500">
                  등록된 종목이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onClose={closeDialog} title={editing ? '종목 수정' : '종목 추가'}>
        <div className="space-y-3 p-1">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">티커 (asset_code)</label>
            <Input
              value={form.assetCode}
              onChange={(e) => setForm({ ...form, assetCode: e.target.value })}
              placeholder="예: BTC-USD, 005930, AAPL"
              disabled={!!editing}
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">표시명</label>
            <Input
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              placeholder="예: 비트코인, 삼성전자, Apple"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">자산군</label>
              <Select
                value={form.assetClass}
                onChange={(e) =>
                  setForm({ ...form, assetClass: e.target.value as AssetClass })
                }
                disabled={!!editing}
              >
                {ASSET_CLASSES.map((c) => (
                  <option key={c} value={c}>
                    {CLASS_LABEL[c]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">소스</label>
              <Select
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value as AssetSource })}
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">정렬 순서</label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                활성
              </label>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800">
          <Button variant="ghost" onClick={closeDialog}>
            취소
          </Button>
          <Button onClick={submit} disabled={createMut.isPending || updateMut.isPending}>
            {editing ? '저장' : '추가'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
