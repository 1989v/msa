import { Link } from 'react-router-dom';
import { RELATION_LABELS } from '../../components/hierarchy/kindLabels';
import { unifiedHitHref } from '../../shell/serviceHref';
import {
  layerCounts, nextSteps, pathTo, previousSteps, type DomainTree,
} from './atlasModel';
import { KindGlyph, SectionHead, kindLabel } from './AtlasParts';
import { useConceptPosts, useRelations } from './useAtlasData';

interface Props {
  domain: string;
  tree: DomainTree;
  at: string;
  sel?: string;
  owner: Map<string, string>;
  domainNames: Map<string, string>;
  postCounts: Map<string, number>;
}

const HIER = new Set(['PART_OF', 'CONTAINS']);

/**
 * 모바일 도메인 그래프 — 한 번에 한 층. 고른 노드(`at`)의 자식을 가지로 늘어놓고,
 * 자식 하나를 고르면(`sel`) 그 자리에서 가로지르는 관계가 펼쳐진다. 좁히기는 `at` 을 옮긴다.
 */
export default function DomainMobile({ domain, tree, at, sel, owner, domainNames, postCounts }: Props) {
  const focus = tree.nodes.get(at) ?? tree.nodes.get(tree.rootId);
  const focusId = focus?.id ?? tree.rootId;
  const path = pathTo(tree, focusId);
  const kids = tree.children.get(focusId) ?? [];
  const layers = layerCounts(tree);
  const depth = focus?.depth ?? 0;
  const siblings = path.length > 1 ? (tree.children.get(path[path.length - 2]) ?? []).length : 1;
  const next = nextSteps(tree, focusId);
  const prev = previousSteps(tree, focusId);
  const selected = sel && kids.includes(sel) ? sel : undefined;
  const relations = useRelations(selected);
  const posts = useConceptPosts(focusId);
  const peak = Math.max(...layers, 1);
  const to = (atId: string, selId?: string) =>
    `/tech/d/${domain}?at=${encodeURIComponent(atId)}${selId ? `&sel=${encodeURIComponent(selId)}` : ''}`;
  const name = (id: string) => tree.nodes.get(id)?.name ?? id;
  const cross = (relations.data ? [...relations.data.outgoing, ...relations.data.incoming] : []).filter((e) => !HIER.has(e.label));

  return (
    <main className="atlas-domain-m">
      <nav className="atlas-rail-path" aria-label="지나온 길">
        <div className="kh-mono atlas-eyebrow">경로</div>
        <ol>
          {path.map((id, i) => {
            const n = tree.nodes.get(id);
            const current = i === path.length - 1;
            return (
              <li key={id} className={current ? 'is-current' : ''}>
                {current ? (
                  <span><KindGlyph kind={n?.kind} />{name(id)}</span>
                ) : (
                  <Link to={to(id)}><KindGlyph kind={n?.kind} />{name(id)}</Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <section className="atlas-layers" aria-label={`층 — 지금 ${depth}`}>
        <span className="kh-mono atlas-eyebrow">층</span>
        {layers.map((n, i) => (
          <span key={i} className={`atlas-layers__bar ${i === depth ? 'is-current' : ''}`}>
            <span style={{ height: `${4 + (n / peak) * 26}px` }} />
            <span className="kh-mono">{i}</span>
          </span>
        ))}
        <span className="atlas-layers__note">층 {depth} · 형제 {siblings}</span>
      </section>

      <section className="atlas-focus kh-seep" aria-label="고른 개념">
        <div className="atlas-focus__kind">
          <KindGlyph kind={focus?.kind} className="atlas-glyph--on-slab" />
          <span className="kh-mono">{focus?.kind ?? ''} · {kindLabel(focus?.kind)}</span>
        </div>
        <h1 className="atlas-focus__name">{focus?.name}</h1>
        {focus?.description && <p className="atlas-focus__desc">{focus.description}</p>}
        <div className="kh-mono atlas-focus__meta">
          {kids.length > 0 && <span>하위 {kids.length}</span>}
          {prev.length > 0 && <span>앞 · {prev.map(name).join(', ')}</span>}
          {next.length > 0 && <span>다음 · {next.map(name).join(', ')}</span>}
          {focusId !== tree.rootId && <Link to={`/tech/c/${encodeURIComponent(focusId)}`}>개념 열기</Link>}
        </div>
      </section>

      {kids.length > 0 && (
        <ul className="atlas-branches" aria-label="하위 개념">
          {kids.map((id) => {
            const n = tree.nodes.get(id);
            const grand = (tree.children.get(id) ?? []).length;
            const isSel = id === selected;
            return (
              <li key={id} className={isSel ? 'is-selected' : ''}>
                <Link replace to={isSel ? to(focusId) : to(focusId, id)} className="atlas-branch" aria-expanded={isSel}>
                  <KindGlyph kind={n?.kind} />
                  <span className="atlas-branch__body">
                    <span className="atlas-branch__name">{n?.name ?? id}</span>
                    {n?.description && <span className="atlas-branch__desc">{n.description}</span>}
                  </span>
                  <span className="kh-mono atlas-muted">{grand > 0 ? `하위 ${grand}` : kindLabel(n?.kind)}</span>
                </Link>
                {isSel && (
                  <div className="atlas-branch__cross">
                    {grand > 0 && (
                      <Link className="atlas-narrow" to={to(id)}>
                        <span>이 가지로 좁히기</span>
                        <span className="kh-mono">하위 {grand}</span>
                      </Link>
                    )}
                    {cross.length > 0 && <div className="kh-mono atlas-eyebrow">가로지르는 관계</div>}
                    <dl>
                      {cross.map((e) => {
                        const d = owner.get(e.conceptId);
                        return (
                          <div key={`${e.label}-${e.conceptId}`}>
                            <dt>{RELATION_LABELS[e.label] ?? e.label}</dt>
                            <dd>
                              <Link to={`/tech/c/${encodeURIComponent(e.conceptId)}`}>
                                <KindGlyph kind={e.conceptKind} />
                                {e.name}
                                {d && d !== domain && <span className="kh-mono atlas-other">{domainNames.get(d)}</span>}
                              </Link>
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {next.map((id) => (
        <Link key={id} to={to(id)} className="atlas-next">
          <span className="kh-mono atlas-eyebrow">다음 단계</span>
          <svg width="28" height="10" viewBox="0 0 28 10" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
            <path d="M0 5h25M21 1l4 4-4 4" />
          </svg>
          <KindGlyph kind={tree.nodes.get(id)?.kind} />
          <span className="atlas-next__name">{name(id)}</span>
        </Link>
      ))}

      {(posts.data?.items.length ?? 0) > 0 && (
        <section className="atlas-domain-m__posts">
          <SectionHead index={2} title="이 개념을 다룬 글" />
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

      {selected && (
        <div className="atlas-sheet" role="region" aria-label="고른 개념 미리보기">
          <span className="atlas-sheet__handle" aria-hidden="true" />
          <div className="atlas-sheet__row">
            <KindGlyph kind={tree.nodes.get(selected)?.kind} className="atlas-glyph--on-slab" />
            <span className="atlas-sheet__body">
              <span className="atlas-sheet__name">{name(selected)}</span>
              <span className="kh-mono">
                관계 {relations.data ? relations.data.outgoing.length + relations.data.incoming.length : '…'} · 코드{' '}
                {relations.data?.code?.length ?? 0} · 글 {postCounts.get(selected) ?? 0}
              </span>
            </span>
            <Link className="atlas-sheet__open" to={`/tech/c/${encodeURIComponent(selected)}`}>열기</Link>
          </div>
        </div>
      )}
    </main>
  );
}
