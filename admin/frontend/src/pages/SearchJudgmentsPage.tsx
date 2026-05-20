import { useEffect, useState } from 'react';
import {
  listJudgments,
  upsertJudgment,
  distinctQueries,
  type JudgmentRow,
} from '@/api/searchJudgments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const RELEVANCE_LABEL: Record<number, string> = {
  0: 'Irrelevant',
  1: 'Click',
  2: 'Cart/Wish',
  3: 'Order',
};

/**
 * ADR-0050 Phase 4 — Judgment 라벨링 페이지.
 *
 * 약지도(weak supervision) 가 자동 생성한 raw label 위에, 운영자가 수동으로 0~3 relevance 를
 * 보정한다. source='manual' 로 upsert.
 *
 * 권한: ADMIN.
 */
export function SearchJudgmentsPage() {
  const [filter, setFilter] = useState('');
  const [rows, setRows] = useState<JudgmentRow[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 신규 라벨 입력 폼
  const [newQuery, setNewQuery] = useState('');
  const [newProductId, setNewProductId] = useState('');
  const [newRelevance, setNewRelevance] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await listJudgments({ query: filter || undefined, limit: 200 });
      setRows(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!filter.trim()) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      distinctQueries(filter).then(setSuggestions).catch(() => setSuggestions([]));
    }, 200);
    return () => clearTimeout(t);
  }, [filter]);

  const handleUpsert = async () => {
    if (!newQuery.trim() || !newProductId.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await upsertJudgment({
        query: newQuery,
        productId: newProductId,
        relevance: newRelevance,
      });
      setNewProductId('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const inlineUpdate = async (row: JudgmentRow, relevance: number) => {
    try {
      await upsertJudgment({ query: row.query, productId: row.productId, relevance });
      setRows((prev) =>
        prev.map((r) =>
          r.query === row.query && r.productId === row.productId
            ? { ...r, relevance, source: 'manual' }
            : r
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">검색 평가 라벨</h1>
        <p className="text-sm text-muted-foreground">
          ADR-0050 Phase 4 · 약지도 자동 생성 라벨 위에 운영자 보정. NDCG/MRR/MAP 평가 잡 입력.
        </p>
      </header>

      <section className="border rounded-md p-4 space-y-2">
        <h2 className="font-semibold">신규 / 보정 라벨</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <label className="text-sm">query
            <Input value={newQuery} onChange={(e) => setNewQuery(e.target.value)} placeholder="예: 무선이어폰" />
          </label>
          <label className="text-sm">productId
            <Input value={newProductId} onChange={(e) => setNewProductId(e.target.value)} placeholder="예: 12345" />
          </label>
          <label className="text-sm">relevance
            <select
              value={newRelevance}
              onChange={(e) => setNewRelevance(Number(e.target.value))}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            >
              {[0, 1, 2, 3].map((r) => (
                <option key={r} value={r}>
                  {r} — {RELEVANCE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <Button onClick={handleUpsert} disabled={submitting || !newQuery.trim() || !newProductId.trim()}>
            {submitting ? '저장 중…' : 'Upsert'}
          </Button>
        </div>
      </section>

      <section className="border rounded-md p-4 space-y-2">
        <h2 className="font-semibold">기존 라벨</h2>
        <div className="flex gap-2 items-center relative">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="query 필터 (LIKE %…%)"
            className="max-w-md"
          />
          <Button onClick={refresh} disabled={loading}>
            {loading ? '조회 중…' : '조회'}
          </Button>
          {suggestions.length > 0 && filter.trim() && (
            <ul className="absolute top-full mt-1 left-0 w-80 bg-background border rounded-md shadow-md text-sm z-10">
              {suggestions.slice(0, 8).map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    onClick={() => { setFilter(s); setSuggestions([]); }}
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <div className="text-sm text-red-600 break-all">Error: {error}</div>}

        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2">query</th>
              <th>productId</th>
              <th>source</th>
              <th>relevance</th>
              <th>weight</th>
              <th>ts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.query}::${r.productId}`} className="border-t">
                <td className="py-2 font-mono text-xs">{r.query}</td>
                <td className="font-mono text-xs">{r.productId}</td>
                <td>
                  <Badge variant={r.source === 'manual' ? 'default' : 'outline'}>{r.source}</Badge>
                </td>
                <td>
                  <select
                    value={r.relevance}
                    onChange={(e) => inlineUpdate(r, Number(e.target.value))}
                    className="border rounded px-2 py-1 text-xs bg-background"
                  >
                    {[0, 1, 2, 3].map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </td>
                <td>{r.weight.toFixed(2)}</td>
                <td className="text-xs text-muted-foreground">{r.createdAt}</td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">데이터 없음</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
