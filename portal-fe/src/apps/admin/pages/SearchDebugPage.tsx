import { useState } from 'react';
import {
  searchDebug,
  type DebugResponse,
  type RawQueryResponse,
  type ScoredItem,
} from '@admin/api/searchDebug';
import { Button } from '@admin/components/ui/button';
import { Input } from '@admin/components/ui/input';
import { Badge } from '@admin/components/ui/badge';

interface VariantState {
  label: string;
  query: string;
  result: DebugResponse | RawQueryResponse | null;
  loading: boolean;
  error: string | null;
}

const initialVariant = (label: string): VariantState => ({
  label,
  query: '',
  result: null,
  loading: false,
  error: null,
});

/**
 * ADR-0050 Phase 4 UI — Side-by-Side 검색 비교.
 *
 * 좌/우 두 variant 의 같은 query 결과를 좌우로 노출. 각 카드는 expand 가능한
 * score breakdown (popularity / ctr / cvr / gmv / freshness / bandit / final).
 *
 * 권한: ADMIN. Gateway X-User-Roles 기반.
 */
export function SearchDebugPage() {
  const [a, setA] = useState<VariantState>(initialVariant('Variant A (live)'));
  const [b, setB] = useState<VariantState>(initialVariant('Variant B (live)'));

  const runVariant = (state: VariantState, set: (s: VariantState) => void) => async () => {
    if (!state.query.trim()) return;
    set({ ...state, loading: true, error: null });
    try {
      const result = await searchDebug({ query: state.query, variant: state.label, topK: 20 });
      set({ ...state, result, loading: false, error: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ ...state, loading: false, error: msg });
    }
  };

  const runBoth = () => {
    runVariant(a, setA)();
    runVariant(b, setB)();
  };

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Search Debug — Side by Side</h1>
        <p className="text-sm text-muted-foreground">
          ADR-0050 Phase 4 UI · 좌/우 variant 의 동일 query 결과 비교. ADMIN 권한 필요.
        </p>
      </header>

      <div className="flex gap-2">
        <Input
          placeholder="공통 query (양쪽에 동시 적용)"
          onChange={(e) => {
            setA({ ...a, query: e.target.value });
            setB({ ...b, query: e.target.value });
          }}
          className="max-w-xl"
        />
        <Button onClick={runBoth}>Run both</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VariantPanel state={a} setState={setA} onRun={runVariant(a, setA)} />
        <VariantPanel state={b} setState={setB} onRun={runVariant(b, setB)} />
      </div>
    </div>
  );
}

function VariantPanel({
  state,
  setState,
  onRun,
}: {
  state: VariantState;
  setState: (s: VariantState) => void;
  onRun: () => void;
}) {
  return (
    <section className="border rounded-md p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{state.label}</h2>
        {state.loading && <Badge>loading</Badge>}
      </div>
      <div className="flex gap-2">
        <Input
          value={state.query}
          onChange={(e) => setState({ ...state, query: e.target.value })}
          placeholder="query"
        />
        <Button onClick={onRun} disabled={state.loading || !state.query.trim()}>
          Run
        </Button>
      </div>
      {state.error && (
        <div className="text-sm text-red-600 break-all">Error: {state.error}</div>
      )}
      {state.result && <ResultList result={state.result} />}
    </section>
  );
}

function ResultList({ result }: { result: DebugResponse | RawQueryResponse }) {
  const items = result.results ?? [];
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-2">
        {items.length} of {result.totalElements} hits
      </div>
      <ol className="space-y-2">
        {items.map((item) => (
          <li key={`${item.rank}-${item.id}`}>
            <ResultCard item={item} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function ResultCard({ item }: { item: ScoredItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-sm p-3 text-sm">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-mono text-xs text-muted-foreground mr-2">
            #{item.rank}
          </span>
          <span className="font-medium">{item.name}</span>
          {item.categoryId && (
            <span className="ml-2 text-xs text-muted-foreground">[{item.categoryId}]</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline">final {item.finalScore.toFixed(4)}</Badge>
          <Badge>es {item.esScore.toFixed(4)}</Badge>
          <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)}>
            {open ? '닫기' : '상세'}
          </Button>
        </div>
      </div>
      {open && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
          <DD label="popularityScore" value={item.features.popularityScore} />
          <DD label="ctr (smoothed)" value={item.features.ctr} />
          <DD label="ctrRaw" value={item.features.ctrRaw} />
          <DD label="cvr (smoothed)" value={item.features.cvr} />
          <DD label="cvrRaw" value={item.features.cvrRaw} />
          <DD label="gmv7d" value={item.features.gmv7d} />
          <DD label="gmv30d" value={item.features.gmv30d} />
          {item.banditSample !== null && (
            <DD label="banditSample" value={item.banditSample} />
          )}
          {item.weights && (
            <>
              <DD label="w.popularity" value={item.weights.popularity} />
              <DD label="w.ctr" value={item.weights.ctr} />
              <DD label="w.cvr" value={item.weights.cvr} />
              <DD label="w.gmv7d" value={item.weights.gmv7d} />
              <DD label="w.gmv30d" value={item.weights.gmv30d} />
              <DD label="w.freshness" value={item.weights.freshness} />
            </>
          )}
        </dl>
      )}
    </div>
  );
}

function DD({ label, value }: { label: string; value: number }) {
  return (
    <>
      <dt className="font-mono">{label}</dt>
      <dd className="text-right font-mono">{value.toFixed(4)}</dd>
    </>
  );
}
