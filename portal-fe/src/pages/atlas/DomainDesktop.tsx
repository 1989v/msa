import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ConceptAtlas } from '../../api/searchApi';
import { KIND_META, RELATION_LABELS } from '../../components/hierarchy/kindLabels';
import type { ConceptKind } from '../../types/graph';
import { descendantCount, layoutColumns, pathTo, type DomainTree, type LaidNode } from './atlasModel';
import { KindGlyph } from './AtlasParts';
import ConceptPanel from './ConceptPanel';
import { useRelations } from './useAtlasData';

const COL_W = 146;
const NODE_W = 130;
const NODE_H = 34;
const ROW_H = 48;
const LEFT = 24;
const TOP = 96;
const HIER = new Set(['PART_OF', 'CONTAINS']);

interface Props {
  atlas: ConceptAtlas;
  domain: string;
  tree: DomainTree;
  at: string;
  sel?: string;
  owner: Map<string, string>;
  domainNames: Map<string, string>;
}

interface Ghost {
  id: string;
  name: string;
  kind?: ConceptKind | null;
  column: number;
  row: number;
  tag?: string;
}

/**
 * 데스크탑 도메인 그래프 — 층을 열로 펼치고 지나온 길만 연다. 고른 노드의 가로지르는 관계는
 * 그 노드 주변에서만 그린다. 화면에 없는 상대는 가장 가까운 보이는 조상 아래 유령 노드로 둔다.
 */
export default function DomainDesktop({ atlas, domain, tree, at, sel, owner, domainNames }: Props) {
  const navigate = useNavigate();
  const target = tree.nodes.has(at) ? at : tree.rootId;
  const path = pathTo(tree, target);
  const laid = layoutColumns(tree, path);
  const byId = new Map(laid.map((n) => [n.id, n]));
  const selected = sel && tree.nodes.has(sel) ? sel : target;
  const relations = useRelations(selected);
  const cross = (relations.data ? [...relations.data.outgoing, ...relations.data.incoming] : []).filter((e) => !HIER.has(e.label));

  // 화면에 없는 상대 — 가장 가까운 보이는 조상의 다음 열, 그 열의 맨 아래
  const colBottom = new Map<number, number>();
  for (const n of laid) colBottom.set(n.column, Math.max(colBottom.get(n.column) ?? -1, n.row));
  const ghosts: Ghost[] = [];
  for (const e of cross) {
    if (byId.has(e.conceptId) || ghosts.some((g) => g.id === e.conceptId)) continue;
    let column = 1;
    let tag: string | undefined;
    if (tree.nodes.has(e.conceptId)) {
      const anc = pathTo(tree, e.conceptId).slice(0, -1).reverse().find((id) => byId.has(id));
      column = (byId.get(anc ?? tree.rootId)?.column ?? 0) + 1;
      tag = anc && anc !== tree.rootId ? tree.nodes.get(anc)?.name : undefined;
    } else {
      const d = owner.get(e.conceptId);
      tag = d ? domainNames.get(d) : undefined;
    }
    const row = (colBottom.get(column) ?? -1) + 1;
    colBottom.set(column, row);
    ghosts.push({ id: e.conceptId, name: e.name, kind: e.conceptKind, column, row: row + 0.5, tag });
  }

  const x = (col: number) => LEFT + col * COL_W;
  const y = (row: number) => TOP + row * ROW_H;
  const maxCol = Math.max(...laid.map((n) => n.column), ...ghosts.map((g) => g.column));
  const maxRow = Math.max(...laid.map((n) => n.row), ...ghosts.map((g) => g.row));
  // 같은 열 안에서 휘는 점선과 그 라벨이 오른쪽으로 한 칸 가까이 나간다
  const width = x(maxCol) + NODE_W * 2 + 40;
  const height = y(maxRow) + NODE_H + 96;
  const pos = (id: string): { col: number; row: number } | undefined => {
    const n = byId.get(id);
    if (n) return { col: n.column, row: n.row };
    const g = ghosts.find((gh) => gh.id === id);
    return g ? { col: g.column, row: g.row } : undefined;
  };
  const sp = pos(selected);
  const go = (id: string) => navigate(`/tech/d/${domain}?at=${encodeURIComponent(id)}&sel=${encodeURIComponent(id)}`);
  const flows = tree.cross.filter((e) => e.kind === 'FLOWS_TO' && byId.has(e.from) && byId.has(e.to));
  const expanded = path.length - 1;
  // 층이 깊으면 고른 노드가 오른쪽 밖으로 나간다 — 보이는 자리까지 가로로 민다
  const scrollRef = useRef<HTMLDivElement>(null);
  const selCol = sp?.col ?? 0;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const right = LEFT + selCol * COL_W + NODE_W * 2;
    el.scrollTo({ left: Math.max(0, right - el.clientWidth), behavior: 'auto' });
  }, [selCol, selected]);

  return (
    <div className="atlas-desk">
      <aside className="atlas-desk__rail" aria-label="도메인">
        <div className="kh-mono atlas-eyebrow">도메인 {atlas.domains.length}</div>
        {atlas.domains.map((d, i) => (
          <Link key={d.domain} to={`/tech/d/${d.domain}`} className={`atlas-desk__domain ${d.domain === domain ? 'is-current' : ''}`}>
            <span className="kh-mono">{String(i + 1).padStart(2, '0')}</span>
            <span className="atlas-desk__domain-name">{d.name}</span>
            <span className="kh-mono atlas-muted">{d.conceptCount}</span>
          </Link>
        ))}
      </aside>

      <main className="atlas-desk__stage" aria-label={`${tree.nodes.get(tree.rootId)?.name ?? domain} 계층 그래프`}>
        <div className="atlas-desk__title">
          <h1>{tree.nodes.get(tree.rootId)?.name}</h1>
          <span className="kh-mono atlas-muted">개념 {tree.nodes.size} · 펼친 가지 {expanded}</span>
        </div>
        <div className="atlas-desk__scroll" ref={scrollRef}>
          <div className="atlas-desk__canvas" style={{ width, height }}>
            <div className="kh-mono atlas-desk__cols" aria-hidden="true">
              {Array.from({ length: maxCol + 1 }, (_, c) => (
                <span key={c} style={{ left: x(c) }}>층 {c}</span>
              ))}
            </div>
            <svg className="atlas-desk__wires" width={width} height={height} aria-hidden="true">
              {laid.filter((n) => n.column > 0).map((n) => {
                const parent = byId.get(path[n.column - 1]) as LaidNode;
                const x1 = x(parent.column) + NODE_W;
                const y1 = y(parent.row) + NODE_H / 2;
                const x2 = x(n.column);
                const y2 = y(n.row) + NODE_H / 2;
                const mid = x1 + (x2 - x1) / 2;
                return (
                  <path
                    key={`w-${n.id}`}
                    d={`M${x1} ${y1} H${mid} V${y2} H${x2}`}
                    className={n.onPath ? 'atlas-wire is-path' : 'atlas-wire'}
                  />
                );
              })}
              {flows.map((f) => {
                const a = byId.get(f.from) as LaidNode;
                const b = byId.get(f.to) as LaidNode;
                if (a.column !== b.column) return null;
                const fx = x(a.column) + NODE_W - 16;
                return (
                  <path
                    key={`f-${f.from}-${f.to}`}
                    d={`M${fx} ${y(a.row) + NODE_H} V${y(b.row)}`}
                    className="atlas-wire is-flow"
                    markerEnd="url(#atlas-arrow)"
                  />
                );
              })}
              {sp && cross.map((e) => {
                const tp = pos(e.conceptId);
                if (!tp) return null;
                const x1 = x(sp.col) + NODE_W / 2;
                const y1 = y(sp.row) + NODE_H / 2;
                const x2 = x(tp.col) + NODE_W / 2;
                const y2 = y(tp.row) + NODE_H / 2;
                const bend = sp.col === tp.col ? NODE_W * 0.9 : 0;
                const cx = (x1 + x2) / 2 + bend;
                const cy = (y1 + y2) / 2 - (sp.col === tp.col ? 0 : 30);
                return (
                  <g key={`c-${e.label}-${e.conceptId}`}>
                    <path d={`M${x1 + (bend ? NODE_W / 2 : 0)} ${y1} Q${cx} ${cy} ${x2 + (bend ? NODE_W / 2 : 0)} ${y2}`} className="atlas-wire is-cross" />
                    <text x={cx + (bend ? 4 : 0)} y={cy} className="atlas-desk__wire-label">
                      {RELATION_LABELS[e.label] ?? e.label}
                    </text>
                  </g>
                );
              })}
              <defs>
                <marker id="atlas-arrow" viewBox="0 0 8 8" refX="4" refY="7" markerWidth="8" markerHeight="8" orient="auto">
                  <path d="M0 0 L4 7 L8 0" className="atlas-arrow" />
                </marker>
              </defs>
            </svg>

            {laid.map((n) => {
              const node = tree.nodes.get(n.id);
              const hasKids = (tree.children.get(n.id) ?? []).length > 0;
              const expandedHere = path.includes(n.id) && n.id !== path[path.length - 1];
              const isSel = n.id === selected;
              return (
                <button
                  key={n.id}
                  type="button"
                  className={`atlas-node ${n.onPath ? 'is-path' : ''} ${isSel ? 'is-selected' : ''} ${n.id === tree.rootId ? 'is-root' : ''}`}
                  style={{ left: x(n.column), top: y(n.row), width: NODE_W, height: NODE_H }}
                  onClick={() => go(n.id)}
                  aria-current={isSel ? 'true' : undefined}
                  title={node?.description ?? undefined}
                >
                  <KindGlyph kind={node?.kind} />
                  <span className="atlas-node__name">{node?.name ?? n.id}</span>
                  {hasKids && !expandedHere && <span className="kh-mono atlas-node__more">+{descendantCount(tree, n.id)}</span>}
                </button>
              );
            })}
            {ghosts.map((g) => (
              <Link
                key={`g-${g.id}`}
                to={`/tech/c/${encodeURIComponent(g.id)}`}
                className="atlas-node is-ghost"
                style={{ left: x(g.column), top: y(g.row) - 4, width: NODE_W, height: NODE_H + 8 }}
              >
                <KindGlyph kind={g.kind} />
                <span className="atlas-node__stack">
                  <span className="atlas-node__name">{g.name}</span>
                  {g.tag && <span className="kh-mono atlas-node__tag">{g.tag}</span>}
                </span>
              </Link>
            ))}
          </div>
        </div>
        <div className="atlas-legend">
          <span className="kh-mono atlas-eyebrow">범례</span>
          <span className="atlas-legend__kinds">
            {(Object.keys(KIND_META) as ConceptKind[]).map((k) => (
              <span key={k}><KindGlyph kind={k} /> {KIND_META[k].label}</span>
            ))}
          </span>
          <span className="atlas-legend__line"><i className="is-tree" />포함</span>
          <span className="atlas-legend__line"><i className="is-cross" />가로지름</span>
          <span className="atlas-legend__line"><i className="is-path" />지나온 길</span>
        </div>
      </main>

      <aside className="atlas-desk__panel" aria-label="고른 개념">
        {selected === tree.rootId ? (
          <div className="atlas-concept atlas-concept--panel">
            <p className="kh-mono atlas-eyebrow">도메인</p>
            <h2 className="atlas-concept__name">{tree.nodes.get(tree.rootId)?.name}</h2>
            <p className="atlas-concept__desc">{tree.nodes.get(tree.rootId)?.description}</p>
            <p className="atlas-muted">왼쪽 그래프에서 가지를 눌러 좁혀 간다. 고른 개념의 관계 · 코드 · 글이 여기 열린다.</p>
          </div>
        ) : (
          <ConceptPanel conceptId={selected} domain={domain} tree={tree} owner={owner} domainNames={domainNames} variant="panel" />
        )}
      </aside>
    </div>
  );
}
