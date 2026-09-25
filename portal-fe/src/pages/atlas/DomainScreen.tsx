import { useEffect, useMemo, useRef, useState } from 'react';
import { RELATION_LABELS } from '../../components/hierarchy/kindLabels';
import {
  descendantCount, neighbors, orderSiblings, pathFromRoot, searchConcepts,
  type Graph, type GraphDomain,
} from './atlasGraph';
import { KindGlyph, kindLabel } from './AtlasParts';
import ConceptBoard from './ConceptBoard';

interface Props {
  graph: Graph;
  domain: GraphDomain;
  sel?: string;
  descriptions: Record<string, string>;
  onSelect: (id: string | null) => void;
}

/**
 * 도메인 화면 — 병풍. 첫 층 묶음이 패널 하나씩 옆으로 늘어서 도메인 전체가 한 화면에 보인다.
 * 항목은 한 번 누르면 바로 펼치고 고른다(되묻지 않는다). 형제 사이 흐름은 1 → 2 → 3 순번으로,
 * 고른 개념의 관계는 오른쪽 판(모바일은 아래 시트)이 보인다.
 */
export default function DomainScreen({ graph, domain, sel, descriptions, onSelect }: Props) {
  const rootId = domain.rootId;
  const path = useMemo(() => (sel ? pathFromRoot(graph, rootId, sel) : []), [graph, rootId, sel]);
  const [open, setOpen] = useState<Set<string>>(() => new Set(path));
  const [allOpen, setAllOpen] = useState(false);
  // 고른 개념까지의 경로를 펼치고 고른다 — 검색이나 관계 판에서 넘어와도 자리가 보이게
  const select = (id: string) => {
    const route = pathFromRoot(graph, rootId, id).slice(0, -1);
    if (route.length) setOpen((prev) => new Set([...prev, ...route]));
    onSelect(id);
  };

  const groups = orderSiblings(graph, graph.children.get(rootId) ?? []).list;
  const related = useMemo(() => {
    const m = new Map<string, string[]>();
    if (!sel) return m;
    for (const n of neighbors(graph, sel)) {
      if (n.group === 'hier') continue;
      m.set(n.concept.id, [...(m.get(n.concept.id) ?? []), RELATION_LABELS[n.label] ?? n.label]);
    }
    return m;
  }, [graph, sel]);

  const toggle = (id: string, hasKids: boolean) => {
    if (hasKids) {
      setOpen((prev) => {
        const next = new Set(prev);
        // 이미 고른 것을 다시 누르면 접는다 — 처음 누르면 펼친다
        if (next.has(id) && sel === id) next.delete(id);
        else next.add(id);
        return next;
      });
    }
    select(id);
  };
  const expandAll = () => {
    const next = !allOpen;
    setAllOpen(next);
    setOpen(next ? new Set(domain.conceptIds.filter((id) => (graph.children.get(id) ?? []).length > 0)) : new Set(path));
  };

  const flows = domain.conceptIds.reduce((n, id) => n + (graph.out.get(id) ?? []).filter((e) => e.kind === 'FLOWS_TO').length, 0);
  const cross = domain.conceptIds.reduce(
    (n, id) => n + (graph.out.get(id) ?? []).filter((e) => e.kind !== 'FLOWS_TO' && e.kind !== 'CONTAINS').length,
    0,
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState<string | undefined>(groups[0]);
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return undefined;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setCurrent((e.target as HTMLElement).dataset.group)),
      { root, threshold: 0.6 },
    );
    root.querySelectorAll('.atlas-panel').forEach((p) => io.observe(p));
    return () => io.disconnect();
  }, [domain.key]);
  // 고른 항목이 옆 패널에 있으면 그 패널로 민다
  useEffect(() => {
    if (!sel) return;
    document.querySelector(`.atlas-row[data-id="${CSS.escape(sel)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [sel]);

  const rowProps = { graph, domainKey: domain.key, open, sel, related, onToggle: toggle };

  return (
    <main className="atlas-domain">
      <header className="atlas-domain__head">
        <div>
          <div className="kh-mono atlas-eyebrow atlas-latin">{domain.key}</div>
          <h1 className="atlas-domain__title">{domain.name}</h1>
          <p className="atlas-domain__lead">{domain.description}</p>
          <JumpSearch graph={graph} onPick={select} />
        </div>
        <div className="atlas-domain__side">
          <div className="kh-mono atlas-domain__stats">
            <span>개념 <b>{domain.conceptIds.length}</b></span>
            <span>묶음 <b>{groups.length}</b></span>
            <span>흐름 <b>{flows}</b></span>
            <span>가로지름 <b>{cross}</b></span>
          </div>
          <button type="button" className="kh-mono atlas-chip" aria-pressed={allOpen} onClick={expandAll}>
            {allOpen ? '모두 접기' : '모두 펼치기'}
          </button>
        </div>
      </header>

      <div className="kh-mono atlas-legend" aria-hidden="true">
        {(['STAGE', 'MECHANISM', 'TERM', 'TECHNOLOGY', 'PROBLEM', 'METRIC'] as const).map((k) => (
          <span key={k}><KindGlyph kind={k} />{kindLabel(k)}</span>
        ))}
        <span className="atlas-legend__flow">1 → 2 흐름 순서</span>
        <span className="atlas-legend__rel">▏관계 있음</span>
      </div>

      <nav className="atlas-strip" aria-label="묶음">
        <ol>
          {groups.map((g, i) => {
            const prev = groups[i - 1];
            const isFlow = prev && (graph.out.get(prev) ?? []).some((e) => e.kind === 'FLOWS_TO' && e.to === g);
            const c = graph.concepts.get(g);
            return (
              <li key={g}>
                {i > 0 && <span className={`kh-mono atlas-strip__sep ${isFlow ? 'is-flow' : ''}`}>{isFlow ? '→' : '·'}</span>}
                <button
                  type="button"
                  aria-current={current === g}
                  onClick={() => document.querySelector(`.atlas-panel[data-group="${CSS.escape(g)}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })}
                >
                  <KindGlyph kind={c?.kind} />
                  <span>{c?.name}</span>
                  <span className="kh-mono atlas-muted">{descendantCount(graph, g)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className={`atlas-stage ${sel ? '' : 'is-closed'}`}>
        <div className="atlas-screen-scroll" ref={scrollRef}>
          <div className="atlas-screen">
            {groups.map((g, i) => {
              const c = graph.concepts.get(g);
              const next = (graph.out.get(g) ?? []).filter((e) => e.kind === 'FLOWS_TO').map((e) => graph.concepts.get(e.to)?.name);
              return (
                <section key={g} className="atlas-panel" data-group={g}>
                  <div className="atlas-panel__head">
                    <div className="kh-mono atlas-panel__top">
                      <span className="atlas-panel__idx">{String(i + 1).padStart(2, '0')}_</span>
                      <span className="atlas-muted">{kindLabel(c?.kind)} · 하위 {descendantCount(graph, g)}</span>
                    </div>
                    <h2>
                      <button type="button" onClick={() => select(g)} aria-current={sel === g}>{c?.name}</button>
                    </h2>
                    {descriptions[g] && <p>{descriptions[g]}</p>}
                    {next.length > 0 && <div className="kh-mono atlas-panel__next">다음 → {next.join(', ')}</div>}
                  </div>
                  <Tree ids={graph.children.get(g) ?? []} {...rowProps} />
                </section>
              );
            })}
          </div>
        </div>
        {sel && graph.concepts.has(sel) && (
          <ConceptBoard
            graph={graph}
            domainKey={domain.key}
            sel={sel}
            description={descriptions[sel]}
            path={path.slice(0, -1).map((id) => graph.concepts.get(id)?.name ?? id)}
            onSelect={select}
            onClose={() => onSelect(null)}
          />
        )}
      </div>
    </main>
  );
}

interface RowProps {
  graph: Graph;
  domainKey: string;
  open: Set<string>;
  sel?: string;
  related: Map<string, string[]>;
  onToggle: (id: string, hasKids: boolean) => void;
}

function Tree({ ids, ...p }: RowProps & { ids: string[] }) {
  const { list, step } = orderSiblings(p.graph, ids);
  return (
    <ul className="atlas-tree">
      {list.map((id, k) => {
        const c = p.graph.concepts.get(id);
        const kids = p.graph.children.get(id) ?? [];
        const isOpen = kids.length > 0 && p.open.has(id);
        const rel = p.related.get(id);
        const hidden = !isOpen && kids.length > 0 && p.sel ? hiddenRelated(p.graph, id, p.related) : 0;
        const foreign = c && c.domain !== p.domainKey;
        return (
          <li key={id}>
            {k > 0 && step.has(id) && step.has(list[k - 1]) && <div className="atlas-flow-link" aria-hidden="true" />}
            <button
              type="button"
              data-id={id}
              className={`atlas-row ${p.sel === id ? 'is-selected' : ''} ${rel ? 'is-related' : ''}`}
              aria-expanded={kids.length > 0 ? isOpen : undefined}
              aria-current={p.sel === id}
              onClick={() => p.onToggle(id, kids.length > 0)}
            >
              <span className="kh-mono atlas-row__step">{step.get(id) ?? ''}</span>
              <KindGlyph kind={c?.kind} />
              <span className="atlas-row__name">{c?.name ?? id}</span>
              <span className="kh-mono atlas-row__meta">
                {hidden > 0 && <span className="atlas-row__hidden">관계 {hidden}</span>}
                {foreign && <span className="atlas-row__seal">다른 도메인</span>}
                {kids.length > 0 && (
                  <>
                    {descendantCount(p.graph, id)}
                    <span className="atlas-row__caret" aria-hidden="true">›</span>
                  </>
                )}
              </span>
              {rel && <span className="kh-mono atlas-row__rel">{rel.join(' · ')}</span>}
            </button>
            {isOpen && <Tree ids={kids} {...p} />}
          </li>
        );
      })}
    </ul>
  );
}

/** 접힌 가지 안에 숨은 관계 항목 수 — 펼치지 않아도 어디에 관계가 있는지 보인다 */
function hiddenRelated(graph: Graph, id: string, related: Map<string, string[]>): number {
  let n = 0;
  const seen = new Set<string>();
  const stack = [...(graph.children.get(id) ?? [])];
  while (stack.length > 0) {
    const cur = stack.pop() as string;
    if (seen.has(cur)) continue;
    seen.add(cur);
    if (related.has(cur)) n += 1;
    stack.push(...(graph.children.get(cur) ?? []));
  }
  return n;
}

/** 개념 바로 가기 — 빌드에 실린 이름에서 찾는다(네트워크 없음). `/` 로 연다 */
function JumpSearch({ graph, onPick }: { graph: Graph; onPick: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [cur, setCur] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const hits = useMemo(() => searchConcepts(graph, q), [graph, q]);
  const names = useMemo(() => new Map(graph.domains.map((d) => [d.key, d.name])), [graph]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === '/' && t?.tagName !== 'INPUT' && t?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        input.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const pick = (id: string) => {
    setQ('');
    input.current?.blur();
    onPick(id);
  };
  const lower = q.trim().toLowerCase();
  return (
    <div className="atlas-jump">
      <span className="kh-mono atlas-jump__key" aria-hidden="true">/</span>
      <input
        ref={input}
        type="search"
        value={q}
        placeholder="개념 바로 가기 — 예: 멱등, 사가, 벡터"
        aria-label="개념 바로 가기"
        aria-expanded={hits.length > 0}
        aria-controls="atlas-jump-list"
        role="combobox"
        autoComplete="off"
        onChange={(e) => {
          setQ(e.target.value);
          setCur(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setCur((c) => (c + (e.key === 'ArrowDown' ? 1 : hits.length - 1)) % Math.max(hits.length, 1));
          } else if (e.key === 'Enter' && hits[cur]) pick(hits[cur].id);
          else if (e.key === 'Escape') setQ('');
        }}
      />
      {q.trim() && (
        <ul id="atlas-jump-list" role="listbox" className="atlas-jump__list">
          {hits.length === 0 && <li className="atlas-muted atlas-jump__none">맞는 개념이 없다</li>}
          {hits.map((h, i) => {
            const at = h.name.toLowerCase().indexOf(lower);
            return (
              <li key={h.id}>
                <button type="button" role="option" aria-selected={i === cur} onMouseDown={(e) => { e.preventDefault(); pick(h.id); }}>
                  <KindGlyph kind={h.kind} />
                  <span>
                    {at >= 0 ? (
                      <>
                        {h.name.slice(0, at)}
                        <mark>{h.name.slice(at, at + lower.length)}</mark>
                        {h.name.slice(at + lower.length)}
                      </>
                    ) : h.name}
                  </span>
                  <span className="kh-mono atlas-jump__domain">{names.get(h.domain)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
