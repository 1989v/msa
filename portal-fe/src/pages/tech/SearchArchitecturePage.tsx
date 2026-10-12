import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import GNB from '../../components/GNB';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import { PORTAL_PAGES, breadcrumbJsonLd, portalUrl, techArticleJsonLd } from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import { layoutDiagram, type DrillDiagram } from './drillLayout';
import { STATUS_LABEL, codeUrl, openPaths, type AppliedStatus } from './drillModel.mjs';
import generated from './generated/search-drill.json';
import './SearchArchitecturePage.css';

const NAV = [
  { label: '아틀라스', href: '/tech' },
  { label: '검색 아키텍처', href: '/tech/search' },
  { label: '홈', href: '/' },
];

interface CodeRef {
  path: string;
  start: number;
  end: number;
  note?: string;
  snippet: string;
}
interface Concept {
  name: string;
  kind: string;
  description: string;
  applied?: { status: AppliedStatus; summary?: string; facts?: { label: string; value: string }[] };
  code?: CodeRef[];
}
interface Step {
  owner: string;
  id: string;
}

const drill = generated as unknown as {
  root: string;
  updated: string;
  sourceHash: string;
  gitSha: string;
  concepts: Record<string, Concept>;
  diagrams: Record<string, DrillDiagram>;
};
const PATHS: Map<string, Step[]> = openPaths(drill);
const ROOT = drill.concepts[drill.root];
const TABS = [
  ['concept', '개념'],
  ['applied', '현재 적용 상태'],
  ['code', '코드'],
] as const;
type Tab = (typeof TABS)[number][0];
/** 이 폭보다 좁으면 그림을 세로로 그린다 */
const VERTICAL_BELOW = 640;
/** 화면에 맞춰 줄이되 이 배율 아래로는 줄이지 않고 그림 상자 안에서 가로로 넘긴다 */
const MIN_SCALE = 0.72;

function readHash(): Step[] {
  if (typeof window === 'undefined') return [];
  const id = decodeURIComponent(window.location.hash.slice(1));
  return PATHS.get(id) ?? [];
}

/** 상자 폭 — 처음 한 번은 레이아웃 전이라 창 폭으로 짐작한다 */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 1200 : Math.min(window.innerWidth, 1200)));
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth || width);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return [ref, width] as const;
}

function statusOf(id: string): AppliedStatus | undefined {
  return drill.concepts[id]?.applied?.status;
}

function Diagram({ owner, picked, onPick }: { owner: string; picked?: string; onPick: (id: string) => void }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const diagram = drill.diagrams[owner];
  const vertical = width < VERTICAL_BELOW;
  const layout = useMemo(() => layoutDiagram(diagram, { vertical, maxWidth: width }), [diagram, vertical, width]);
  if (layout.boxes.length === 0) return <div ref={ref} />;
  const fit = Math.max(Math.min(layout.width, width - 8), Math.round(layout.width * MIN_SCALE));
  const marker = `td-arrow-${owner}`;
  const key = (id: string) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPick(id);
    }
  };
  const node = (id: string, x: number, y: number, w: number, h: number, hasDetail: boolean) => {
    const c = drill.concepts[id];
    const status = statusOf(id);
    const label = `${c.name}${status ? `, ${STATUS_LABEL[status]}` : ''}${hasDetail ? ', 상세 다이어그램 있음' : ''}`;
    return (
      <g
        key={id}
        className={`td-node${status === 'NONE' ? ' is-none' : ''}${id === picked ? ' is-picked' : ''}`}
        transform={`translate(${x},${y})`}
        role="button"
        tabIndex={0}
        aria-label={label}
        aria-expanded={id === picked}
        onClick={() => onPick(id)}
        onKeyDown={key(id)}
      >
        {hasDetail && <rect className="td-stack" x={5} y={5} width={w} height={h} rx={4} />}
        <rect className="td-box" width={w} height={h} rx={4} />
        {status && <circle className={`td-dot is-${status.toLowerCase()}`} cx={w - 12} cy={13} r={4} />}
        <text className="td-label" x={12} y={24}>
          {c.name}
        </text>
        <text className="td-kind" x={12} y={43}>
          {status ? STATUS_LABEL[status] : '기록 없음'}
        </text>
        {hasDetail && (
          <text className="td-more" x={w} y={h + 16} textAnchor="end">
            [상세보기]
          </text>
        )}
      </g>
    );
  };
  return (
    <div className="td-canvas" ref={ref}>
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height + 12}`}
        width={fit}
        height={Math.round(((layout.height + 12) * fit) / layout.width)}
        role="group"
        aria-label={`${drill.concepts[owner].name} 다이어그램`}
      >
        <defs>
          <marker id={marker} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="td-arrowhead" />
          </marker>
        </defs>
        {layout.routes.map((r) => (
          <g key={`${r.from}>${r.to}`} className="td-edge">
            <path d={r.d} markerEnd={`url(#${marker})`} />
            {r.label && (
              <text x={r.lx} y={r.ly - 5} textAnchor="middle">
                {r.label}
              </text>
            )}
          </g>
        ))}
        {layout.boxes.map((b) =>
          b.lanes.length === 0 ? (
            node(b.id, b.x, b.y, b.w, b.h, Boolean(drill.diagrams[b.id]))
          ) : (
            <g key={b.id} className="td-group">
              <rect className="td-frame" x={b.x} y={b.y} width={b.w} height={b.h} rx={6} />
              <text
                className={`td-group-head${b.id === picked ? ' is-picked' : ''}`}
                x={b.x + 12}
                y={b.y + 19}
                role="button"
                tabIndex={0}
                aria-label={`${drill.concepts[b.id].name}${statusOf(b.id) ? `, ${STATUS_LABEL[statusOf(b.id)!]}` : ''}, 묶음`}
                onClick={() => onPick(b.id)}
                onKeyDown={key(b.id)}
              >
                {drill.concepts[b.id].name} ↗
              </text>
              {b.lanes.map((l) => node(l.id, l.x, l.y, l.w, l.h, Boolean(drill.diagrams[l.id])))}
            </g>
          ),
        )}
      </svg>
    </div>
  );
}

function Related({ owner, picked, onPick }: { owner: string; picked?: string; onPick: (id: string) => void }) {
  const related = drill.diagrams[owner]?.related ?? [];
  if (related.length === 0) return null;
  return (
    <div className="td-related">
      <p className="td-related-title">관련 개념</p>
      <ul>
        {related.map((id) => {
          const status = statusOf(id);
          return (
            <li key={id}>
              <button type="button" className={`td-chip${id === picked ? ' is-picked' : ''}`} aria-expanded={id === picked} onClick={() => onPick(id)}>
                {status && <span className={`td-chip-dot is-${status.toLowerCase()}`} aria-hidden="true" />}
                {drill.concepts[id].name}
                {status && <span className="td-visually-hidden">, {STATUS_LABEL[status]}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TabBody({ c, tab }: { c: Concept; tab: Tab }) {
  if (tab === 'concept') return <p>{c.description}</p>;
  if (tab === 'applied') {
    if (!c.applied) return <p className="td-empty">이 서비스의 적용 기록이 없다.</p>;
    return (
      <>
        {c.applied.summary && <p>{c.applied.summary}</p>}
        {c.applied.facts && c.applied.facts.length > 0 && (
          <dl className="td-facts">
            {c.applied.facts.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </>
    );
  }
  if (!c.code || c.code.length === 0) return <p className="td-empty">연결된 코드가 없다.</p>;
  return (
    <>
      {c.code.map((ref) => (
        <figure key={`${ref.path}:${ref.start}`} className="td-code">
          <figcaption>
            <a href={codeUrl(ref, drill.gitSha)} target="_blank" rel="noopener noreferrer">
              {ref.path.split('/').pop()} <span className="td-lines">L{ref.start}–{ref.end}</span> · GitHub ↗
            </a>
            <span className="td-path">{ref.path}</span>
            {ref.note && <span className="td-note">{ref.note}</span>}
          </figcaption>
          <pre>
            <code>
              {ref.snippet.split('\n').map((line, i) => (
                <span key={i} className="td-line">
                  <span className="td-ln" aria-hidden="true">
                    {ref.start + i}
                  </span>
                  {line}
                  {'\n'}
                </span>
              ))}
            </code>
          </pre>
        </figure>
      ))}
    </>
  );
}

function Level({
  index,
  step,
  path,
  picked,
  onPick,
  onClose,
}: {
  index: number;
  step: Step;
  path: Step[];
  picked?: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>('concept');
  const c = drill.concepts[step.id];
  const status = c.applied?.status;
  const tabsRef = useRef<HTMLDivElement>(null);
  const move = (e: KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length][0];
    setTab(next);
    tabsRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${next}"]`)?.focus();
  };
  const crumbs = path.slice(0, index + 1).map((s) => drill.concepts[s.id].name).join(' › ');
  return (
    <section className="td-level" id={`td-level-${index}`} aria-label={`${c.name} 상세`}>
      <div className="td-level-head">
        <div className="td-who">
          <p className="td-kicker">
            {index + 1}단계 · {crumbs}
          </p>
          <h3>
            {c.name}
            {status && <span className={`td-pill is-${status.toLowerCase()}`}>{STATUS_LABEL[status]}</span>}
          </h3>
        </div>
        <button type="button" className="td-close" onClick={onClose}>
          접기
        </button>
      </div>
      {drill.diagrams[step.id] && (
        <div className="td-sub">
          <p className="td-sub-title">
            <b>{c.name}</b> <span>상세 다이어그램</span>
          </p>
          <Diagram owner={step.id} picked={picked} onPick={onPick} />
          <Related owner={step.id} picked={picked} onPick={onPick} />
        </div>
      )}
      <div className="td-tabs" role="tablist" aria-label={`${c.name} 상세 탭`} ref={tabsRef}>
        {TABS.map(([k, label], i) => (
          <button
            key={k}
            type="button"
            role="tab"
            id={`td-tab-${index}-${k}`}
            data-tab={k}
            aria-selected={tab === k}
            aria-controls={`td-panel-${index}`}
            tabIndex={tab === k ? 0 : -1}
            onClick={() => setTab(k)}
            onKeyDown={(e) => move(e, i)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="td-panel" role="tabpanel" id={`td-panel-${index}`} aria-labelledby={`td-tab-${index}-${tab}`}>
        <TabBody c={c} tab={tab} />
      </div>
    </section>
  );
}

/**
 * `/tech/search` — 검색 일반 파이프라인 위에 이 서비스의 구현을 얹은 드릴다운.
 * 노드 · 간선 · 상태 · 코드는 전부 온톨로지에서 내보낸 데이터다(ADR-0108). 이 파일은 배치하고 그린다.
 */
export default function SearchArchitecturePage() {
  useHeritageSurface();
  useSeo({
    ...PORTAL_PAGES['/tech/search'],
    canonical: portalUrl('/tech/search'),
    // 프리렌더와 같은 구성이어야 한다 — 하이드레이션이 정적 HTML 의 것을 갈아끼운다
    jsonLd: [
      techArticleJsonLd(drill.updated),
      breadcrumbJsonLd('ko', [
        { name: '홈', url: portalUrl('/') },
        { name: 'IT', url: portalUrl('/tech') },
        { name: '검색 아키텍처', url: portalUrl('/tech/search') },
      ]),
    ],
  });
  const [path, setPath] = useState<Step[]>(readHash);
  const scrollTo = useRef<number | null>(null);

  useEffect(() => {
    const last = path.at(-1);
    try {
      window.history.replaceState(null, '', last ? `#${last.id}` : window.location.pathname + window.location.search);
    } catch {
      // 기록을 못 바꿔도 화면은 그대로 쓴다
    }
    if (scrollTo.current == null) return;
    const el = document.getElementById(`td-level-${scrollTo.current}`);
    scrollTo.current = null;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el?.scrollIntoView?.({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }, [path]);

  /** 그림 주인(owner)의 그림에서 id 를 골랐다 — 그 단계부터 다시 펼친다. 같은 것을 다시 누르면 접는다 */
  const pick = (level: number, owner: string) => (id: string) => {
    setPath((prev) => {
      const same = prev[level]?.owner === owner && prev[level]?.id === id;
      const next = prev.slice(0, level);
      if (same) return next;
      scrollTo.current = level;
      return [...next, { owner, id }];
    });
  };

  return (
    <div className="td-page" data-source-hash={drill.sourceHash}>
      <GNB pageLabel="IT" items={NAV} />
      <main className="td-main">
        <p className="td-build">
          빌드 커밋 {drill.gitSha} · 갱신 {drill.updated}
        </p>
        <header className="td-head">
          <p className="td-eyebrow">IT · 검색</p>
          <h1>검색 아키텍처</h1>
          <p className="td-lede">{ROOT.description}</p>
        </header>

        <section className="td-board" aria-labelledby="td-board-title">
          <div className="td-board-head">
            <h2 id="td-board-title">{ROOT.name}</h2>
            <ul className="td-legend" aria-label="상태 범례">
              {(Object.keys(STATUS_LABEL) as AppliedStatus[]).map((s) => (
                <li key={s}>
                  <span className={`td-chip-dot is-${s.toLowerCase()}`} aria-hidden="true" />
                  {STATUS_LABEL[s]}
                </li>
              ))}
            </ul>
          </div>
          <Diagram owner={drill.root} picked={path[0]?.id} onPick={pick(0, drill.root)} />
          <Related owner={drill.root} picked={path[0]?.id} onPick={pick(0, drill.root)} />
          <p className="td-hint">
            단계를 누르면 아래에 상세가 열린다 — 위에는 그 단계의 상세 다이어그램, 밑에는 [개념] [현재 적용 상태] [코드] 탭.
            상세 다이어그램의 노드를 누르면 한 단계 더 열린다. 겹친 상자([상세보기])는 상세 다이어그램이 있는 단계다.
          </p>
        </section>

        <div className="td-levels">
          {path.map((step, i) => (
            <Level
              key={`${i}:${step.id}`}
              index={i}
              step={step}
              path={path}
              picked={path[i + 1]?.id}
              onPick={pick(i + 1, step.id)}
              onClose={() => setPath((prev) => prev.slice(0, i))}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
