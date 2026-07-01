import { useEffect, useState } from 'react';
import {
  searchDebugFields,
  searchRawQuery,
  type FieldMeta,
  type FunctionScoreSpec,
  type RawQueryResponse,
} from '@admin/api/searchDebug';
import { Button } from '@admin/components/ui/button';
import { Input } from '@admin/components/ui/input';
import { Badge } from '@admin/components/ui/badge';

interface ToggleState {
  enabled: boolean;
  weight: number;
  origin?: string;
  scale?: string;
  offset?: string;
  decay?: number;
}

/**
 * ADR-0050 Phase 4 UI — Query Builder.
 *
 * GET /api/v1/search/debug/fields 로 ProductEsDocument 필드 메타를 가져와
 * 각 필드별 토글 + weight 슬라이더 UI 생성. raw-query API 로 발사한 결과를
 * inline 표시.
 *
 * 권한: ADMIN.
 */
export function SearchQueryBuilderPage() {
  const [fields, setFields] = useState<FieldMeta[]>([]);
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(20);
  const [toggles, setToggles] = useState<Record<string, ToggleState>>({});
  const [result, setResult] = useState<RawQueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    searchDebugFields()
      .then((fs) => {
        setFields(fs);
        const init: Record<string, ToggleState> = {};
        fs.forEach((f) => {
          if (f.supportedFunctions.includes('fieldValueFactor') || f.supportedFunctions.includes('gauss')) {
            init[f.name] = { enabled: false, weight: 1.0 };
            if (f.supportedFunctions.includes('gauss')) {
              init[f.name].origin = 'now';
              init[f.name].scale = '14d';
              init[f.name].offset = '0d';
              init[f.name].decay = 0.5;
            }
          }
        });
        setToggles(init);
      })
      .catch((err) => setError(String(err)));
  }, []);

  const updateToggle = (field: string, patch: Partial<ToggleState>) =>
    setToggles((prev) => ({ ...prev, [field]: { ...prev[field], ...patch } }));

  const buildFunctionScores = (): FunctionScoreSpec[] => {
    const out: FunctionScoreSpec[] = [];
    for (const f of fields) {
      const t = toggles[f.name];
      if (!t?.enabled) continue;
      if (f.supportedFunctions.includes('gauss')) {
        out.push({
          type: 'gauss',
          field: f.name,
          weight: t.weight,
          origin: t.origin,
          scale: t.scale,
          offset: t.offset,
          decay: t.decay,
        });
      } else {
        out.push({ type: 'fieldValueFactor', field: f.name, weight: t.weight });
      }
    }
    return out;
  };

  const run = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await searchRawQuery({
        query,
        topK,
        functionScores: buildFunctionScores(),
      });
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Search Query Builder</h1>
        <p className="text-sm text-muted-foreground">
          ADR-0050 Phase 4 UI · 인덱스 필드별 function_score 토글로 ad-hoc 쿼리 생성. ADMIN 필요.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex gap-2 items-center">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="query" className="max-w-xl" />
          <label className="text-sm">topK
            <Input
              type="number"
              value={topK}
              onChange={(e) => setTopK(Math.max(1, Number(e.target.value || 20)))}
              className="ml-2 inline-block w-20"
            />
          </label>
          <Button onClick={run} disabled={loading || !query.trim()}>Run</Button>
        </div>
        {error && <div className="text-sm text-red-600 break-all">Error: {error}</div>}
      </section>

      <section className="border rounded-md p-4 space-y-2">
        <h2 className="font-semibold">Function Score Toggles</h2>
        {fields.length === 0 && <div className="text-sm text-muted-foreground">필드 메타 로딩 중...</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {fields.map((f) => {
            const supported = f.supportedFunctions.includes('fieldValueFactor') || f.supportedFunctions.includes('gauss');
            const t = toggles[f.name];
            if (!supported || !t) {
              return (
                <div key={f.name} className="border rounded-sm p-2 text-xs text-muted-foreground">
                  {f.name} <span className="font-mono">({f.type})</span> — supports: {f.supportedFunctions.join(', ')}
                </div>
              );
            }
            return (
              <div key={f.name} className="border rounded-sm p-3 space-y-2 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={t.enabled} onChange={(e) => updateToggle(f.name, { enabled: e.target.checked })} />
                  <span className="font-medium">{f.name}</span>
                  <Badge variant="outline">{f.type}</Badge>
                </label>
                {t.enabled && (
                  <div className="grid grid-cols-2 gap-2 pl-6">
                    <label>weight
                      <Input
                        type="number"
                        step="0.1"
                        value={t.weight}
                        onChange={(e) => updateToggle(f.name, { weight: Number(e.target.value) })}
                      />
                    </label>
                    {f.supportedFunctions.includes('gauss') && (
                      <>
                        <label>scale<Input value={t.scale ?? ''} onChange={(e) => updateToggle(f.name, { scale: e.target.value })} /></label>
                        <label>decay<Input type="number" step="0.05" value={t.decay ?? 0.5} onChange={(e) => updateToggle(f.name, { decay: Number(e.target.value) })} /></label>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {result && (
        <section className="border rounded-md p-4 space-y-2">
          <h2 className="font-semibold">Results ({result.results.length} of {result.totalElements})</h2>
          <ol className="space-y-1 text-sm">
            {result.results.map((item) => (
              <li key={`${item.rank}-${item.id}`} className="flex items-center justify-between border-b pb-1">
                <div>
                  <span className="font-mono text-xs text-muted-foreground mr-2">#{item.rank}</span>
                  <span>{item.name}</span>
                  {item.categoryId && <span className="ml-2 text-xs text-muted-foreground">[{item.categoryId}]</span>}
                </div>
                <Badge>es {item.esScore.toFixed(4)}</Badge>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

// 향후: 결과를 SearchDebugPage 의 좌/우 variant 에 push 하는 share button — Phase 4 후속.
