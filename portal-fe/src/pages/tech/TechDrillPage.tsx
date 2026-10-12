import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import GNB from '../../components/GNB';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import { PORTAL_PAGES, breadcrumbJsonLd, portalUrl, techArticleJsonLd } from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import { layoutDiagram, type DrillDiagram } from './drillLayout';
import { STATUS_LABEL, codeUrl, openPaths, type AppliedStatus } from './drillModel.mjs';
import { DRILL_NAV, type DrillPage } from './drillPages.mjs';
import './TechDrillPage.css';

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
export interface DrillData {
  root: string;
  updated: string;
  maxDepth: number;
  sourceHash: string;
  gitSha: string;
  concepts: Record<string, Concept>;
  diagrams: Record<string, DrillDiagram>;
}

const DrillContext = createContext<DrillData | null>(null);
function useDrill(): DrillData {
  const drill = useContext(DrillContext);
  if (!drill) throw new Error('DrillContext 밖에서 그렸다');
  return drill;
}

const TABS = [
  ['concept', '개념'],
  ['applied', '현재 적용 상태'],
  ['code', '코드'],
] as const;
type Tab = (typeof TABS)[number][0];
/** 이 폭보다 좁으면 그림을 세로로 그린다 */
const VERTICAL_BELOW = 640;
/** 노드 제목은 상자에 안 들어가면 이 크기까지 줄인다 */
const LABEL_MIN_PX = 11;
/** 가로 배치는 화면에 맞춰 줄이되 이 배율 아래로는 줄이지 않고 그림 상자 안에서 가로로 넘긴다 */
const MIN_SCALE = 0.72;

function readHash(paths: Map<string, Step[]>): Step[] {
  if (typeof window === 'undefined') return [];
  const id = decodeURIComponent(window.location.hash.slice(1));
  return paths.get(id) ?? [];
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

function Diagram({ owner, picked, onPick }: { owner: string; picked?: string; onPick: (id: string) => void }) {
  const drill = useDrill();
  const [ref, width] = useWidth<HTMLDivElement>();
  const diagram = drill.diagrams[owner];
  const vertical = width < VERTICAL_BELOW;
  // 세로 배치는 줄이지 않고 화면 폭에 맞춰 접는다 — 줄이면 휴대폰에서 글자가 10px 아래로 내려가 읽기 어렵다
  const layout = useMemo(
    () => layoutDiagram(diagram, { vertical, maxWidth: vertical ? width - 8 : width }),
    [diagram, vertical, width],
  );
  const svgRef = useRef<SVGSVGElement>(null);
  // 상자 폭은 고정이라 긴 제목은 그 노드만 글자를 줄여 넣는다 — 글꼴이 늦게 오면 폭이 달라지므로 그때 한 번 더
  useLayoutEffect(() => {
    const fit = () =>
      svgRef.current?.querySelectorAll<SVGTextElement>('.td-label').forEach((t) => {
        if (typeof t.getComputedTextLength !== 'function') return;
        t.style.fontSize = '';
        const room = Number(t.dataset.room);
        const len = t.getComputedTextLength();
        if (len > room) t.style.fontSize = `${Math.max(LABEL_MIN_PX, (parseFloat(getComputedStyle(t).fontSize) * room) / len)}px`;
      });
    fit();
    document.fonts?.ready.then(fit);
  }, [layout]);
  if (layout.boxes.length === 0) return <div ref={ref} />;
  const statusOf = (id: string) => drill.concepts[id]?.applied?.status;
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
    const sub = drill.diagrams[id];
    const more = !hasDetail ? '' : sub.nodes.length > 0 ? ', 상세 다이어그램 있음' : ', 하위 개념 있음';
    const label = `${c.name}${status ? `, ${STATUS_LABEL[status]}` : ''}${more}`;
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
        <text className="td-label" x={12} y={24} data-room={w - 32}>
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
        ref={svgRef}
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
              <text x={r.lx} y={r.ly - 5} textAnchor={r.anchor ?? 'middle'}>
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

function Related({
  owner,
  picked,
  onPick,
  title = '관련 개념',
}: {
  owner: string;
  picked?: string;
  onPick: (id: string) => void;
  title?: string;
}) {
  const drill = useDrill();
  const related = drill.diagrams[owner]?.related ?? [];
  if (related.length === 0) return null;
  return (
    <div className="td-related">
      <p className="td-related-title">{title}</p>
      <ul>
        {related.map((id) => {
          const status = drill.concepts[id]?.applied?.status;
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
  const drill = useDrill();
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

/**
 * 펼친 한 단계 — 머리 → 상세 다이어그램 → 탭, 그리고 이 단계에서 연 다음 단계를 **자기 안에** 품는다.
 * 단계를 형제로 늘어놓으면 1단계 탭 뒤에 2단계 머리가 바로 붙어 경계가 안 보인다(모바일에서 특히).
 */
function Level({
  index,
  path,
  pick,
  close,
}: {
  index: number;
  path: Step[];
  pick: (level: number, owner: string) => (id: string) => void;
  close: (level: number) => void;
}) {
  const drill = useDrill();
  const [tab, setTab] = useState<Tab>('concept');
  const step = path[index];
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
  // 하위 개념이 있어도 서로 흐름이 없으면 노드가 0개다 — 그때는 그림 대신 하위 개념 목록으로 보인다
  const sub = drill.diagrams[step.id];
  const onPick = pick(index + 1, step.id);
  return (
    <section className={`td-level td-depth-${index + 1}`} id={`td-level-${index}`} aria-label={`${c.name} 상세`}>
      <div className="td-level-head">
        <span className="td-depth" aria-hidden="true">
          {index + 1}
        </span>
        <div className="td-who">
          <p className="td-kicker">
            {index + 1}단계 · {crumbs}
          </p>
          <h3>
            {c.name}
            {status && <span className={`td-pill is-${status.toLowerCase()}`}>{STATUS_LABEL[status]}</span>}
          </h3>
        </div>
        <button type="button" className="td-close" onClick={() => close(index)}>
          접기
        </button>
      </div>
      {sub && sub.nodes.length > 0 ? (
        <div className="td-sub">
          <p className="td-sub-title">
            <b>{c.name}</b> <span>상세 다이어그램</span>
          </p>
          <Diagram owner={step.id} picked={path[index + 1]?.id} onPick={onPick} />
          <Related owner={step.id} picked={path[index + 1]?.id} onPick={onPick} />
        </div>
      ) : sub ? (
        <div className="td-sub">
          <p className="td-leaf">하위 개념 사이에 흐름이 없어 그림 대신 목록으로 보인다 — 눌러서 한 단계 더 연다.</p>
          <Related owner={step.id} picked={path[index + 1]?.id} onPick={onPick} title="하위 개념" />
        </div>
      ) : (
        <p className="td-leaf">
          {index + 1 >= drill.maxDepth
            ? `상세 다이어그램은 ${drill.maxDepth}단계까지 그린다 — 여기서는 설명 · 적용 상태 · 코드만 본다.`
            : '더 나뉘는 하위 단계가 없는 개념이다 — 설명 · 적용 상태 · 코드만 있다.'}
        </p>
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
      {path[index + 1] && (
        <div className="td-children">
          <Level key={`${index + 1}:${path[index + 1].id}`} index={index + 1} path={path} pick={pick} close={close} />
        </div>
      )}
    </section>
  );
}

/**
 * `/tech/<domain>` — 분야의 일반 파이프라인 위에 이 서비스의 구현을 얹은 드릴다운.
 * 노드 · 간선 · 상태 · 코드는 전부 온톨로지에서 내보낸 데이터다(ADR-0108). 이 파일은 배치하고 그린다.
 */
export default function TechDrillPage({ page, data }: { page: DrillPage; data: DrillData }) {
  useHeritageSurface();
  useSeo({
    ...PORTAL_PAGES[page.path as keyof typeof PORTAL_PAGES],
    canonical: portalUrl(page.path),
    // 프리렌더와 같은 구성이어야 한다 — 하이드레이션이 정적 HTML 의 것을 갈아끼운다
    jsonLd: [
      techArticleJsonLd(page.path, page.title, data.updated),
      breadcrumbJsonLd('ko', [
        { name: '홈', url: portalUrl('/') },
        { name: 'IT', url: portalUrl('/tech') },
        { name: page.title, url: portalUrl(page.path) },
      ]),
    ],
  });
  const paths = useMemo(() => openPaths(data), [data]);
  const root = data.concepts[data.root];
  const [path, setPath] = useState<Step[]>(() => readHash(paths));
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
  const close = (level: number) => setPath((prev) => prev.slice(0, level));

  return (
    <DrillContext.Provider value={data}>
      <div className="td-page" data-source-hash={data.sourceHash}>
        <GNB pageLabel="IT" items={DRILL_NAV} />
        <main className="td-main">
          <p className="td-build">
            빌드 커밋 {data.gitSha} · 갱신 {data.updated}
          </p>
          <header className="td-head">
            <p className="td-eyebrow">IT · {page.area}</p>
            <h1>{page.title}</h1>
            <p className="td-lede">{root.description}</p>
          </header>

          <section className="td-board" aria-labelledby="td-board-title">
            <div className="td-board-head">
              <h2 id="td-board-title">{root.name}</h2>
              <ul className="td-legend" aria-label="상태 범례">
                {(Object.keys(STATUS_LABEL) as AppliedStatus[]).map((s) => (
                  <li key={s}>
                    <span className={`td-chip-dot is-${s.toLowerCase()}`} aria-hidden="true" />
                    {STATUS_LABEL[s]}
                  </li>
                ))}
              </ul>
            </div>
            <Diagram owner={data.root} picked={path[0]?.id} onPick={pick(0, data.root)} />
            <Related owner={data.root} picked={path[0]?.id} onPick={pick(0, data.root)} />
            <p className="td-hint">
              단계를 누르면 아래에 상세가 열린다 — 위에는 그 단계의 상세 다이어그램, 밑에는 [개념] [현재 적용 상태] [코드] 탭.
              상세 다이어그램의 노드를 누르면 그 단계 안에 한 단계 더 열린다. 겹친 상자([상세보기])는 상세 다이어그램이 있는 단계다.
            </p>
          </section>

          {path[0] && <Level key={`0:${path[0].id}`} index={0} path={path} pick={pick} close={close} />}
        </main>
      </div>
    </DrillContext.Provider>
  );
}
