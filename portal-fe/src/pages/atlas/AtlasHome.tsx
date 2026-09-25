import { Link, useNavigate } from 'react-router-dom';
import type { AtlasDomain, ConceptAtlas } from './atlasGraph';
import type { ConceptKind } from '../../types/graph';
import { ConceptSearch, KindGlyph, SectionHead } from './AtlasParts';

/**
 * 지도 위 자리 — 관계가 많은 도메인끼리 가깝게 둔 손 배치(가로 · 세로 0~1).
 * 모르는 도메인이 새로 생기면 오른쪽 아래 빈자리에 줄 세운다.
 */
const POSITIONS: Record<string, [number, number]> = {
  // 기초 — 왼쪽
  'cs-fundamentals': [0.08, 0.8],
  language: [0.1, 0.52],
  runtime: [0.2, 0.94],
  spring: [0.24, 0.3],
  concurrency: [0.27, 0.7],
  // 설계 · 저장 · 분산 — 가운데
  architecture: [0.4, 0.1],
  'commerce-catalog': [0.34, 0.5],
  data: [0.47, 0.5],
  'commerce-order': [0.61, 0.48],
  testing: [0.42, 0.9],
  distributed: [0.58, 0.72],
  ads: [0.57, 0.93],
  messaging: [0.72, 0.9],
  observability: [0.56, 0.27],
  // 인프라 · 네트워크 · 응용 — 오른쪽
  infrastructure: [0.7, 0.1],
  cloud: [0.88, 0.16],
  network: [0.92, 0.4],
  search: [0.77, 0.6],
  security: [0.91, 0.7],
  recommendation: [0.9, 0.9],
};

const STRIP_KINDS: ConceptKind[] = ['STAGE', 'MECHANISM', 'TERM', 'TECHNOLOGY', 'PROBLEM', 'METRIC'];

function Constellation({ atlas, width, height, labelScale = 1, maxLinks }: { atlas: ConceptAtlas; width: number; height: number; labelScale?: number; maxLinks: number }) {
  const navigate = useNavigate();
  const pad = 36;
  let spare = 0;
  const at = new Map(
    atlas.domains.map((d) => {
      const p = POSITIONS[d.domain] ?? [0.8 + 0.05 * (spare++ % 3), 0.9];
      return [d.domain, [pad + p[0] * (width - 2 * pad), pad + p[1] * (height - 2 * pad)] as const];
    }),
  );
  // 개념이 수백 개로 늘어도 원이 이웃을 덮지 않게 제곱근에 상한을 둔다
  const radius = (d: AtlasDomain) => (5 + Math.min(Math.sqrt(d.conceptCount), 16) * 1.3) * labelScale;
  // 강한 연결만 그린다 — 도메인이 늘면 약한 선이 지도를 실타래로 만든다. 굵기는 최대값 대비 비율
  const links = [...atlas.links].sort((a, b) => b.count - a.count).slice(0, maxLinks).reverse();
  const peak = Math.max(1, ...links.map((l) => l.count));
  return (
    <svg
      className="atlas-map"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`도메인 ${atlas.domains.length}개와 그 사이 관계 수`}
    >
      {links.map((l) => {
        const a = at.get(l.from);
        const b = at.get(l.to);
        if (!a || !b) return null;
        return (
          <g key={`${l.from}-${l.to}`}>
            <line
              x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
              className="atlas-map__link"
              style={{ strokeWidth: (0.6 + 3.4 * (l.count / peak)) * labelScale, opacity: 0.14 + 0.5 * (l.count / peak) }}
            />
            {l.count >= peak * 0.6 && labelScale >= 0.9 && (
              <text className="atlas-map__count" x={(a[0] + b[0]) / 2} y={(a[1] + b[1]) / 2 - 4} textAnchor="middle">
                {l.count}
              </text>
            )}
          </g>
        );
      })}
      {atlas.domains.map((d) => {
        const p = at.get(d.domain);
        if (!p) return null;
        const r = radius(d);
        return (
          <g
            key={d.domain}
            className="atlas-map__node"
            tabIndex={0}
            role="link"
            aria-label={`${d.name} — 개념 ${d.conceptCount}`}
            onClick={() => navigate(`/tech/d/${d.domain}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') navigate(`/tech/d/${d.domain}`);
            }}
          >
            <circle cx={p[0]} cy={p[1]} r={r} className="atlas-map__disc" />
            <circle cx={p[0]} cy={p[1]} r={Math.max(2, r * 0.28)} className="atlas-map__core" />
            <text x={p[0]} y={p[1] + r + 14 * labelScale} textAnchor="middle" className="atlas-map__name" style={{ fontSize: 12 * labelScale }}>
              {d.name}
            </text>
            <text x={p[0]} y={p[1] + r + 26 * labelScale} textAnchor="middle" className="atlas-map__num" style={{ fontSize: 9 * labelScale }}>
              {d.conceptCount}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function KindStrip({ counts }: { counts: Record<string, number> }) {
  return (
    <span className="kh-mono atlas-kinds">
      {STRIP_KINDS.filter((k) => counts[k]).map((k) => (
        <span key={k}>
          <KindGlyph kind={k} /> {counts[k]}
        </span>
      ))}
    </span>
  );
}

export default function AtlasHome({ atlas, postCounts, wide }: { atlas: ConceptAtlas; postCounts: Map<string, number>; wide: boolean }) {
  const total = atlas.domains.reduce((n, d) => n + d.conceptCount, 0);
  const code = atlas.domains.reduce((n, d) => n + d.codeRefCount, 0);
  const postsOf = (d: AtlasDomain) => d.conceptIds.filter((id) => (postCounts.get(id) ?? 0) > 0).length;
  return (
    <main className={`atlas-home ${wide ? 'is-wide' : ''}`}>
      <section className="atlas-home__intro kh-seep">
        <div className="kh-mono atlas-eyebrow atlas-latin">CONCEPT ATLAS</div>
        <h1 className="atlas-home__title">개념 아틀라스</h1>
        <p className="atlas-home__lead">
          도메인 하나를 골라 단계 · 장치 · 용어 순으로 좁혀 간다. 개념마다 이 레포의 코드와 그것을 다룬 글이 붙어 있다.
        </p>
        <div className="kh-mono atlas-stats">
          <span>도메인 {atlas.domains.length}</span>
          <span>개념 {total}</span>
          <span>코드 {code}</span>
        </div>
        <ConceptSearch />
        {wide && <DomainList atlas={atlas} postsOf={postsOf} />}
      </section>
      <section className="atlas-home__map" aria-label="도메인 지도">
        <div className="atlas-home__map-head">
          <span className="kh-mono">지도 · 선 굵기 = 도메인 사이 관계 수 (강한 연결만)</span>
          {wide && <span className="kh-mono atlas-muted">원 크기 = 개념 수</span>}
        </div>
        {wide ? (
          <Constellation atlas={atlas} width={846} height={780} labelScale={0.95} maxLinks={45} />
        ) : (
          <Constellation atlas={atlas} width={356} height={440} labelScale={0.72} maxLinks={25} />
        )}
      </section>
      {!wide && <DomainList atlas={atlas} postsOf={postsOf} />}
    </main>
  );
}

function DomainList({ atlas, postsOf }: { atlas: ConceptAtlas; postsOf: (d: AtlasDomain) => number }) {
  return (
    <section className="atlas-domains" aria-label="도메인">
      <SectionHead index={1} title="도메인" meta="기초 → 응용" />
      <ol className="atlas-domains__list">
        {atlas.domains.map((d, i) => (
          <li key={d.domain}>
            <Link to={`/tech/d/${d.domain}`} className="atlas-domain-row">
              <span className="kh-mono atlas-domain-row__index">{String(i + 1).padStart(2, '0')}</span>
              <span className="atlas-domain-row__body">
                <span className="atlas-domain-row__name">{d.name}</span>
                {d.description && <span className="atlas-domain-row__desc">{d.description}</span>}
                <KindStrip counts={d.kindCounts} />
                <span className="kh-mono atlas-muted atlas-domain-row__meta">
                  개념 {d.conceptCount} · 코드 {d.codeRefCount} · 글이 달린 개념 {postsOf(d)}
                </span>
              </span>
              <svg className="atlas-domain-row__chev" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M7.5 4.5 13 10l-5.5 5.5" />
              </svg>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
