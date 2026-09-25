import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchConceptDetail } from '../../api/searchApi';
import { RELATION_LABELS } from '../../components/hierarchy/kindLabels';
import { unifiedHitHref } from '../../shell/serviceHref';
import type { RelationEdge } from '../../types/graph';
import { KindGlyph, SectionHead, kindLabel } from './AtlasParts';
import { GITHUB_BLOB, useConceptPosts, useRelations, useSnippet } from './useAtlasData';

/** 관계 표의 줄 순서 — 속한 곳과 포함이 먼저, 가로지르는 관계가 뒤 */
const LABEL_ORDER = [
  'PART_OF', 'CONTAINS', 'FOLLOWS', 'FLOWS_TO', 'USES', 'USED_BY', 'IMPLEMENTED_BY', 'IMPLEMENTS',
  'MEASURED_BY', 'MEASURES', 'AFFECTS', 'AFFECTED_BY', 'MITIGATES', 'MITIGATED_BY', 'CAUSES', 'CAUSED_BY', 'ALTERNATIVE_TO',
];

interface Props {
  conceptId: string;
  /** 지금 보고 있는 도메인 — 경로 링크가 이 도메인 그래프로 돌아간다 */
  domain?: string;
  /** 도메인 루트에서 이 개념 바로 위까지 */
  path: { id: string; name: string }[];
  owner: (conceptId: string) => string | undefined;
  domainName: (domain: string) => string | undefined;
  variant: 'page' | 'panel';
}

export default function ConceptPanel({ conceptId, domain, path, owner, domainName, variant }: Props) {
  const relations = useRelations(conceptId);
  const detail = useQuery({
    queryKey: ['concept', 'detail', conceptId],
    queryFn: () => fetchConceptDetail(conceptId),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
  const posts = useConceptPosts(conceptId);

  if (relations.isLoading) return <div className="atlas-concept"><p className="kh-skeleton atlas-skeleton" /></div>;
  if (relations.isError || !relations.data) {
    return (
      <div className="atlas-concept">
        <p className="atlas-muted">이 개념을 찾지 못했다. <Link to="/tech">아틀라스로</Link></p>
      </div>
    );
  }
  const r = relations.data;
  const edges = [...r.outgoing, ...r.incoming].sort(
    (a, b) => LABEL_ORDER.indexOf(a.label) - LABEL_ORDER.indexOf(b.label),
  );
  const home = owner(conceptId);
  const otherDomain = (id: string) => {
    const d = owner(id);
    return d && d !== home ? domainName(d) : undefined;
  };
  let section = 0;

  return (
    <article className={`atlas-concept atlas-concept--${variant}`}>
      <header className="atlas-concept__head">
        {path.length > 0 && domain && (
          <nav className="kh-mono atlas-concept__path" aria-label="속한 경로">
            {path.map((p, i) => (
              <span key={p.id}>
                {i > 0 && <span aria-hidden="true"> / </span>}
                <Link to={`/tech/d/${domain}?sel=${encodeURIComponent(p.id)}`}>{p.name}</Link>
              </span>
            ))}
          </nav>
        )}
        <div className="atlas-concept__seal-row">
          <span className="atlas-seal">
            <KindGlyph kind={r.concept.kind} />
            <span className="kh-mono">{kindLabel(r.concept.kind)}</span>
          </span>
          <span className="kh-mono atlas-muted">{r.concept.level}</span>
          {variant === 'panel' && <span className="kh-mono atlas-muted atlas-concept__url">/tech/c/{conceptId}</span>}
        </div>
        <h1 className="atlas-concept__name">{r.concept.name}</h1>
        {detail.data && detail.data.synonyms.length > 0 && (
          <div className="kh-mono atlas-muted atlas-concept__syn">{detail.data.synonyms.join(' · ')}</div>
        )}
        {r.concept.description && <p className="atlas-concept__desc">{r.concept.description}</p>}
      </header>

      {edges.length > 0 && variant === 'page' && <EgoGraph name={r.concept.name} kind={r.concept.kind} edges={edges} otherDomain={otherDomain} />}

      {edges.length > 0 && (
        <section className="atlas-concept__section">
          <SectionHead index={++section} title="관계" />
          <dl className="atlas-relations">
            {edges.map((e) => (
              <div key={`${e.label}-${e.conceptId}`} className="atlas-relations__row">
                <dt>{RELATION_LABELS[e.label] ?? e.label}</dt>
                <dd>
                  <Link to={`/tech/c/${encodeURIComponent(e.conceptId)}`} className="atlas-relations__name">
                    <KindGlyph kind={e.conceptKind} />
                    {e.name}
                    {otherDomain(e.conceptId) && <span className="kh-mono atlas-other">{otherDomain(e.conceptId)}</span>}
                  </Link>
                  {e.reason && <span className="atlas-relations__reason">{e.reason}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {(r.code ?? []).length > 0 && (
        <section className="atlas-concept__section">
          <SectionHead index={++section} title="이 레포의 코드" />
          {(r.code ?? []).map((c) => (
            <CodeBlock key={`${c.path}#${c.symbol}`} path={c.path} symbol={c.symbol} note={c.note} />
          ))}
        </section>
      )}

      {(posts.data?.items.length ?? 0) > 0 && (
        <section className="atlas-concept__section">
          <SectionHead index={++section} title="이 개념을 다룬 글" />
          <ul className="atlas-posts">
            {posts.data?.items.map((p) => (
              <li key={p.slug}>
                <a href={unifiedHitHref('blog_post', p.slug)}>
                  <span className="atlas-posts__title">{p.title}</span>
                  <span className="kh-mono atlas-muted">{p.publishedAt?.slice(0, 10)}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {r.questions.length > 0 && (
        <section className="atlas-concept__section">
          <SectionHead index={++section} title="물을 수 있는 것" />
          <ol className="atlas-questions">
            {r.questions.map((q, i) => (
              <li key={q}>
                <span className="kh-mono">Q{i + 1}</span>
                {q}
              </li>
            ))}
          </ol>
        </section>
      )}
    </article>
  );
}

function CodeBlock({ path, symbol, note }: { path: string; symbol: string; note?: string | null }) {
  const snippet = useSnippet(path, symbol);
  const short = path.split('/').length > 3 ? `${path.split('/')[0]}/…/${path.split('/').slice(-2).join('/')}` : path;
  const href = `${GITHUB_BLOB}${path}${snippet.data ? `#L${snippet.data.startLine}` : ''}`;
  return (
    <figure className="atlas-code">
      <figcaption className="atlas-code__head">
        <span className="kh-mono atlas-code__path" title={path}>{short}</span>
        {note && <span className="atlas-code__note">{note}</span>}
      </figcaption>
      <pre className="atlas-code__body">
        <code>{snippet.data ? snippet.data.lines.join('\n') : snippet.isLoading ? ' ' : symbol}</code>
      </pre>
      <a className="atlas-code__link" href={href} target="_blank" rel="noopener noreferrer">
        <span>원본 전체 보기</span>
        <span className="kh-mono atlas-muted">GITHUB</span>
      </a>
    </figure>
  );
}

/** 한 홉 이웃 그래프 — 속한 곳은 위, 포함은 아래, 가로지르는 관계는 좌우 */
function EgoGraph({
  name, kind, edges, otherDomain,
}: {
  name: string;
  kind: RelationEdge['conceptKind'];
  edges: RelationEdge[];
  otherDomain: (id: string) => string | undefined;
}) {
  const W = 356;
  const H = 300;
  const cx = W / 2;
  const cy = H / 2;
  const up = edges.filter((e) => e.label === 'PART_OF').slice(0, 2);
  const down = edges.filter((e) => e.label === 'CONTAINS').slice(0, 3);
  const side = edges.filter((e) => e.label !== 'PART_OF' && e.label !== 'CONTAINS').slice(0, 6);
  const spots: { e: RelationEdge; x: number; y: number; dashed: boolean }[] = [];
  up.forEach((e, i) => spots.push({ e, x: cx + (i - (up.length - 1) / 2) * 140, y: 44, dashed: false }));
  down.forEach((e, i) => spots.push({ e, x: cx + (i - (down.length - 1) / 2) * 120, y: 256, dashed: false }));
  side.forEach((e, i) => {
    const left = i % 2 === 0;
    const rowIdx = Math.floor(i / 2);
    const rows = Math.ceil(side.length / 2);
    const y = cy + (rowIdx - (rows - 1) / 2) * 76;
    spots.push({ e, x: left ? 64 : W - 64, y, dashed: true });
  });
  return (
    <section className="atlas-ego" aria-label={`${name} 의 이웃`}>
      <div className="atlas-ego__head">
        <span className="kh-mono">이웃 · 한 홉</span>
        <span className="kh-mono atlas-muted">{edges.length}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${name} 과 이웃 ${edges.length}`}>
        {spots.map((s) => (
          <g key={`l-${s.e.label}-${s.e.conceptId}`}>
            <line x1={cx} y1={cy} x2={s.x} y2={s.y} className={s.dashed ? 'atlas-ego__cross' : 'atlas-ego__tree'} />
            <text x={(cx + s.x) / 2 + 6} y={(cy + s.y) / 2 - 4} className="atlas-ego__label">
              {RELATION_LABELS[s.e.label] ?? s.e.label}
            </text>
          </g>
        ))}
        {spots.map((s) => (
          <Link key={`n-${s.e.label}-${s.e.conceptId}`} to={`/tech/c/${encodeURIComponent(s.e.conceptId)}`}>
            <circle cx={s.x} cy={s.y} r={6} className={`atlas-ego__dot atlas-ego__dot--${(s.e.conceptKind ?? 'TERM').toLowerCase()}`} />
            <text x={s.x} y={s.y > cy ? s.y + 22 : s.y - 14} textAnchor="middle" className="atlas-ego__name">
              {s.e.name.length > 12 ? `${s.e.name.slice(0, 11)}…` : s.e.name}
            </text>
            {otherDomain(s.e.conceptId) && (
              <text x={s.x} y={s.y > cy ? s.y + 34 : s.y - 26} textAnchor="middle" className="atlas-ego__domain">
                {otherDomain(s.e.conceptId)}
              </text>
            )}
          </Link>
        ))}
        <rect x={cx - 18} y={cy - 18} width={36} height={36} className="atlas-ego__center" />
        <foreignObject x={cx - 8} y={cy - 8} width={16} height={16}>
          <KindGlyph kind={kind} className="atlas-glyph--on-accent" />
        </foreignObject>
      </svg>
    </section>
  );
}
