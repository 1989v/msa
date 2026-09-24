import { useEffect, useState } from 'react';
import { fetchConceptRelations } from '../../api/searchApi';
import type { ConceptRelations, RelationEdge } from '../../types/graph';
import { KIND_META, RELATION_LABELS } from './kindLabels';
import './RelationsPanel.css';

interface RelationsPanelProps {
  conceptId: string;
  onSelectConcept: (conceptId: string) => void;
}

/** 관계 이름별로 묶는다 — 같은 이름이 나가는·들어오는 양쪽에서 섞이지 않게 방향도 키에 넣는다 */
function group(edges: RelationEdge[], direction: 'out' | 'in'): [string, RelationEdge[]][] {
  const map = new Map<string, RelationEdge[]>();
  for (const e of edges) {
    const key = `${direction}:${e.label}`;
    map.set(key, [...(map.get(key) ?? []), e]);
  }
  return [...map.entries()];
}

/**
 * 개념 상세 서랍의 「관계」 절 — 온톨로지 이웃을 관계별로 묶고 근거·질문을 붙인다.
 * 계층 응답 밖(다른 루트)의 간선도 여기서 보인다. 온톨로지에 없는 개념이면 아무것도 그리지 않는다.
 */
export default function RelationsPanel({ conceptId, onSelectConcept }: RelationsPanelProps) {
  const [loaded, setLoaded] = useState<{ id: string; data: ConceptRelations | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchConceptRelations(conceptId)
      .then((r) => !cancelled && setLoaded({ id: conceptId, data: r }))
      .catch(() => !cancelled && setLoaded({ id: conceptId, data: null }));
    return () => {
      cancelled = true;
    };
  }, [conceptId]);

  const data = loaded?.id === conceptId ? loaded.data : null;
  if (!data) return null;

  const groups = [...group(data.outgoing, 'out'), ...group(data.incoming, 'in')];
  const kind = data.concept.kind ? KIND_META[data.concept.kind] : null;
  if (!kind && groups.length === 0 && data.evidence.length === 0 && data.questions.length === 0) return null;

  return (
    <section className="detail-panel-section rel-section" aria-label="관계">
      <h3>
        관계
        {kind && (
          <span className="rel-kind" style={{ color: kind.color }}>
            <span aria-hidden="true">{kind.glyph}</span> {kind.label}
          </span>
        )}
      </h3>
      {groups.map(([key, edges]) => (
        <div key={key} className="rel-group">
          <h4 className="rel-label">{RELATION_LABELS[edges[0].label] ?? edges[0].label}</h4>
          <ul className="rel-list">
            {edges.map((e) => {
              const k = e.conceptKind ? KIND_META[e.conceptKind] : null;
              return (
                <li key={`${key}:${e.conceptId}`}>
                  <button type="button" className="rel-link" onClick={() => onSelectConcept(e.conceptId)}>
                    {k && (
                      <span aria-hidden="true" className="rel-glyph" style={{ color: k.color }}>
                        {k.glyph}
                      </span>
                    )}
                    {e.name}
                  </button>
                  {e.reason && <span className="rel-reason">{e.reason}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {data.evidence.length > 0 && (
        <div className="rel-group">
          <h4 className="rel-label">근거</h4>
          <ul className="rel-list">
            {data.evidence.map((ev) => (
              <li key={`${ev.kind}:${ev.ref}`}>
                <span className="rel-ref">{ev.ref}</span>
                {ev.note && <span className="rel-reason">{ev.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.questions.length > 0 && (
        <div className="rel-group">
          <h4 className="rel-label">물을 수 있는 것</h4>
          <ul className="rel-list rel-questions">
            {data.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
