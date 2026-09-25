import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { RELATION_LABELS } from '../../components/hierarchy/kindLabels';
import { GROUP_RANK, neighbors, type Graph, type Neighbor } from './atlasGraph';
import { KindGlyph, kindLabel } from './AtlasParts';
import GraphBoard from './GraphBoard';

interface Props {
  graph: Graph;
  domainKey: string;
  sel: string;
  description?: string;
  /** 도메인 루트에서 고른 개념 바로 위까지의 이름 */
  path: string[];
  onSelect: (id: string) => void;
  onClose: () => void;
}

type Tab = 'rel' | 'graph';
const NONE = new Set<string>();

/**
 * 고른 개념의 판 — 관계 판(들어오는 쪽 | 나가는 쪽, 관계 이름별)과 그래프 판(고른 개념 중심의 로컬 그래프).
 * 데스크탑은 병풍 오른쪽, 모바일은 아래 시트. 닫기는 × 와 Esc(크게 본 그래프가 먼저 닫힌다).
 */
export default function ConceptBoard({ graph, domainKey, sel, description, path, onSelect, onClose }: Props) {
  const c = graph.concepts.get(sel);
  const [tab, setTab] = useState<Tab>('rel');
  // 깊이는 판마다 따로 — 관계 판은 읽기(1), 그래프 판은 이웃의 이웃까지(2)
  const [depths, setDepths] = useState<Record<Tab, 1 | 2>>({ rel: 1, graph: 2 });
  // 관계 필터는 고른 개념에 묶는다 — 다른 개념으로 옮기면 저절로 풀린다
  const [filter, setFilter] = useState<{ of: string; hidden: Set<string> }>({ of: sel, hidden: new Set() });
  const hidden = filter.of === sel ? filter.hidden : NONE;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [full, setFull] = useState(false);
  // 다른 개념으로 옮기면 판을 맨 위로
  const board = useRef<HTMLElement>(null);
  useEffect(() => {
    board.current?.scrollTo({ top: 0 });
  }, [sel]);

  const all = useMemo(() => neighbors(graph, sel), [graph, sel]);
  const labels = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of all) m.set(n.label, (m.get(n.label) ?? 0) + 1);
    return [...m.entries()];
  }, [all]);
  const shown = all.filter((n) => !hidden.has(n.label));
  const depth = depths[tab];
  const names = useMemo(() => new Map(graph.domains.map((d) => [d.key, d.name])), [graph]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || (e.target as HTMLElement | null)?.tagName === 'INPUT') return;
      if (full) setFull(false);
      else onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [full, onClose]);

  if (!c) return null;
  const toggleLabel = (l: string) => {
    const next = new Set(hidden);
    if (next.has(l)) next.delete(l);
    else next.add(l);
    setFilter({ of: sel, hidden: next });
  };

  return (
    <aside ref={board} className={`atlas-board ${sheetOpen ? 'is-open' : ''}`} aria-label={`${c.name} 판`}>
      <button type="button" className="atlas-board__grip" aria-label={sheetOpen ? '판 줄이기' : '판 크게 보기'} onClick={() => setSheetOpen((v) => !v)}>
        <span />
      </button>
      <div className="kh-mono atlas-board__kind">
        <KindGlyph kind={c.kind} className="atlas-glyph--on-slab" />
        <span className="atlas-latin">{c.kind}</span>
        <span>· {kindLabel(c.kind)}</span>
        <button type="button" className="atlas-board__close" aria-label="판 닫기 (Esc)" onClick={onClose}>×</button>
      </div>
      <h2 className="atlas-board__name">{c.name}</h2>
      {description && <p className="atlas-board__desc">{description}</p>}
      {path.length > 0 && <div className="kh-mono atlas-board__path">{path.join(' › ')}</div>}

      <div className="atlas-board__tabs" role="tablist">
        {(['rel', 'graph'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className="kh-mono"
            onClick={() => {
              setTab(t);
              setSheetOpen(true);
            }}
          >
            {t === 'rel' ? '관계 판' : '그래프 판'}
          </button>
        ))}
      </div>

      <div className="atlas-board__controls">
        {labels.map(([l, n]) => (
          <button key={l} type="button" className="kh-mono atlas-pill" aria-pressed={!hidden.has(l)} onClick={() => toggleLabel(l)}>
            {RELATION_LABELS[l] ?? l}
            <span>{n}</span>
          </button>
        ))}
        <span className="atlas-depth" role="group" aria-label="깊이">
          {([1, 2] as const).map((v) => (
            <button key={v} type="button" className="kh-mono" aria-pressed={depth === v} onClick={() => setDepths((d) => ({ ...d, [tab]: v }))}>
              깊이 {v}
            </button>
          ))}
        </span>
      </div>

      {tab === 'rel' ? (
        <RelationBoard graph={graph} sel={sel} list={shown} depth={depth} domainKey={domainKey} names={names} onSelect={onSelect} />
      ) : (
        <GraphBoard graph={graph} sel={sel} depth={depth} hidden={hidden} full={full} onToggleFull={() => setFull((v) => !v)} onSelect={onSelect} />
      )}

      <Link className="kh-mono atlas-board__open" to={`/tech/c/${encodeURIComponent(sel)}`}>
        개념 열기 — 코드 · 글 · 질문 →
      </Link>
    </aside>
  );
}

const MAX_PER_GROUP = 12;

/** 관계 판 — 왼쪽 들어오는 쪽, 오른쪽 나가는 쪽(모바일은 위아래). 흐름 → 가로지름 → 포함 순 */
function RelationBoard({
  graph, sel, list, depth, domainKey, names, onSelect,
}: {
  graph: Graph;
  sel: string;
  list: Neighbor[];
  depth: 1 | 2;
  domainKey: string;
  names: Map<string, string>;
  onSelect: (id: string) => void;
}) {
  const sides = [
    { key: 'in', title: '들어오는 관계', arrow: '→ 이 개념', items: list.filter((n) => n.incoming) },
    { key: 'out', title: '나가는 관계', arrow: '이 개념 →', items: list.filter((n) => !n.incoming) },
  ];
  return (
    <div className="atlas-rel">
      {sides.map((s) => {
        const byLabel = new Map<string, Neighbor[]>();
        for (const n of s.items) byLabel.set(n.label, [...(byLabel.get(n.label) ?? []), n]);
        const groups = [...byLabel.entries()].sort((a, b) => GROUP_RANK[a[1][0].group] - GROUP_RANK[b[1][0].group]);
        return (
          <section key={s.key}>
            <div className="kh-mono atlas-rel__head">
              <b>{s.title}</b>
              <span className="atlas-rel__arrow">{s.arrow}</span>
              <span>{s.items.length}</span>
            </div>
            {s.items.length === 0 && <p className="atlas-rel__none">없음</p>}
            {groups.map(([label, items]) => (
              <div key={label} className="atlas-rel__group">
                <h3 className={`kh-mono is-${items[0].group}`}>{RELATION_LABELS[label] ?? label} {items.length}</h3>
                <ul>
                  {items.slice(0, MAX_PER_GROUP).map((n) => (
                    <li key={n.concept.id}>
                      <button type="button" onClick={() => onSelect(n.concept.id)}>
                        <KindGlyph kind={n.concept.kind} className="atlas-glyph--on-slab" />
                        <span>{n.concept.name}</span>
                        {n.concept.domain !== domainKey && <span className="kh-mono atlas-rel__seal">{names.get(n.concept.domain)}</span>}
                      </button>
                      {depth === 2 && <SecondHop graph={graph} from={n.concept.id} sel={sel} onSelect={onSelect} />}
                    </li>
                  ))}
                  {items.length > MAX_PER_GROUP && <li className="atlas-rel__none">외 {items.length - MAX_PER_GROUP}개</li>}
                </ul>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}

/** 깊이 2 — 이웃의 가로지르는 관계 몇 개를 들여 붙인다 */
function SecondHop({ graph, from, sel, onSelect }: { graph: Graph; from: string; sel: string; onSelect: (id: string) => void }) {
  const items = neighbors(graph, from).filter((m) => m.concept.id !== sel && m.group !== 'hier').slice(0, 4);
  if (items.length === 0) return null;
  return (
    <div className="atlas-rel__hop">
      {items.map((m) => (
        <button key={`${m.label}-${m.concept.id}`} type="button" onClick={() => onSelect(m.concept.id)}>
          <span className="kh-mono">{RELATION_LABELS[m.label] ?? m.label}</span>
          <span>{m.concept.name}</span>
        </button>
      ))}
    </div>
  );
}
