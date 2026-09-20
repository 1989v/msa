import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import GNB from '../../components/GNB';
import Footer from '../../components/Footer';
import { fetchUnifiedSearch, type UnifiedGroup, type UnifiedResult, type UnifiedType } from '../../api/searchApi';
import { unifiedHitHref } from '../../shell/serviceHref';
import TrackedLink from '../../analytics/TrackedLink';
import { newViewId } from '../../analytics/identity';
import { installFlushOnLeave, track } from '../../analytics/tracker';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import { useSeo } from '../../seo/useSeo';
import { portalTitle } from '../../seo/copy.mjs';
import { TYPE_ENTITY, TYPE_LABELS, TYPE_ORDER } from './unifiedTypes';
import './UnifiedSearchPage.css';

/**
 * 통합 검색 `/search?q=` — 한 검색어로 모든 서비스를 묻고 **타입별 묶음**으로 보여준다 (ADR-0090 D6).
 * 타입 간 순위는 매기지 않는다 — 묶음 안에서만 순서가 있고, 결과 한 건은 그 서비스의 정규 주소로 나간다.
 * 검색 결과 페이지라 색인하지 않는다(noindex).
 */
export default function UnifiedSearchPage() {
  useHeritageSurface();
  const [params, setParams] = useSearchParams();
  const q = params.get('q')?.trim() ?? '';
  const type = params.get('type') ?? '';
  const [result, setResult] = useState<(UnifiedResult & { requestKey: string }) | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  // 상태를 effect 안에서 동기로 바꾸지 않는다 — 「무엇을 기다리는지」는 q·type 과 마지막 결과로 유도한다
  const requestKey = `${q}\u0000${type}`;
  // 한 질의 = 한 화면 한 벌. 질의나 대상이 바뀌면 다른 화면이다 (ADR-0095 viewId).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- requestKey 가 바뀔 때만 새 한 벌이다
  const viewId = useMemo(() => newViewId(), [requestKey]);
  const fresh = result !== null && result.query === q && result.requestKey === requestKey;
  const state: 'idle' | 'loading' | 'error' = !q ? 'idle' : failedFor === requestKey ? 'error' : fresh ? 'idle' : 'loading';

  useSeo({
    title: portalTitle(q ? `‘${q}’ 검색` : '통합 검색'),
    description: '관광지 · 블로그 글 · 게임 · 개념 사전 · 혜택 · 서비스 · 상품을 한 번에 찾는다.',
    noindex: true,
  });

  // 화면을 떠날 때 아직 안 보낸 노출을 흘린다 — 그 순간의 fetch 는 취소된다.
  useEffect(installFlushOnLeave, []);

  useEffect(() => {
    if (!q) return;
    let cancelled = false;
    const key = requestKey;
    fetchUnifiedSearch(q, type || undefined, undefined, type ? 20 : 5)
      .then((r) => {
        if (cancelled) return;
        setResult({ ...r, requestKey: key });
        // 질의 자체를 한 번 기록한다. **0건도 기록된다** — 노출이 한 건도 안 달린 질의가
        // 곧 미스이고, 그 목록이 사전·벡터를 더할지 정하는 근거다 (ADR-0095).
        track(
          'SEARCH',
          {
            entityType: 'SEARCH',
            entityId: q,
            screenType: 'UNIFIED_SEARCH',
            screenRef: type || r.understood.type || '',
            sectionId: 'SEARCH_GROUP',
            payload: {
              understoodType: r.understood.type,
              residual: r.understood.residual,
              requestedType: type || null,
              groups: Object.fromEntries(r.groups.map((g) => [g.type, g.total])),
            },
          },
          viewId,
        );
      })
      .catch(() => {
        if (!cancelled) setFailedFor(key);
      });
    return () => {
      cancelled = true;
    };
  }, [q, type, requestKey, viewId]);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next = String(new FormData(e.currentTarget).get('q') ?? '').trim();
    if (!next) return;
    setParams(type ? { q: next, type } : { q: next });
  };

  const selectType = (next: string) => {
    if (!q) return;
    setParams(next ? { q, type: next } : { q });
  };

  // 묶음 순서는 서버가 정한다(의도 타입 · 건수). 칩은 고정 순서로 둔다 — 눌러도 자리가 안 바뀌게
  const groups = fresh && result ? result.groups : [];

  const totalAll = groups.reduce((n, g) => n + g.total, 0);
  const intentType = result?.understood.type ?? null;

  return (
    <>
      <GNB items={[{ label: '홈', href: '/' }]} />
      <div className="usearch-page">
        <div className="usearch-inner">
          <header className="usearch-header">
            <span className="kh-section-label">Search</span>
            <form className="usearch-form" role="search" onSubmit={submit}>
              <input
                key={q}
                className="kh-field usearch-field"
                type="search"
                name="q"
                defaultValue={q}
                placeholder="관광지 · 글 · 게임 · 개념 · 혜택 · 상품을 한 번에"
                aria-label="통합 검색어"
                autoFocus={!q}
              />
              <button type="submit" className="kh-button usearch-submit">
                검색
              </button>
            </form>
            <div className="usearch-chips" role="tablist" aria-label="검색 대상">
              <button
                type="button"
                role="tab"
                aria-selected={!type}
                className={`usearch-chip ${!type ? 'is-active' : ''}`}
                onClick={() => selectType('')}
              >
                전체
              </button>
              {TYPE_ORDER.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={type === t}
                  className={`usearch-chip ${type === t ? 'is-active' : ''} ${intentType === t ? 'is-intent' : ''}`}
                  onClick={() => selectType(t)}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </header>

          {state === 'loading' && (
            <p className="kh-status" role="status">
              찾는 중…
            </p>
          )}
          {state === 'error' && (
            <p className="kh-status kh-status-error" role="alert">
              검색에 실패했습니다. 잠시 뒤 다시 시도해 주세요.
            </p>
          )}
          {state === 'idle' && q && result && groups.length === 0 && (
            <div className="kh-status" role="status">
              <span className="kh-status-title">‘{q}’ 에 맞는 것이 없습니다</span>
              <span>다른 말로 바꾸거나 대상을 「전체」로 넓혀 보세요.</span>
            </div>
          )}
          {state === 'idle' && result && groups.length > 0 && (
            <>
              <p className="usearch-summary kh-mono">
                {totalAll.toLocaleString()}건
                {result.understood.type && result.understood.residual && (
                  <>
                    {' '}
                    · {TYPE_LABELS[result.understood.type]}에서 ‘{result.understood.residual}’
                  </>
                )}
              </p>
              {groups.map((g, groupIndex) => (
                <GroupSection
                  key={g.type}
                  group={g}
                  groupIndex={groupIndex}
                  query={q}
                  viewId={viewId}
                  expanded={Boolean(type)}
                  onMore={() => selectType(g.type)}
                />
              ))}
            </>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}

function GroupSection({
  group, groupIndex, query, viewId, expanded, onMore,
}: {
  group: UnifiedGroup;
  groupIndex: number;
  query: string;
  viewId: string;
  expanded: boolean;
  onMore: () => void;
}) {
  const label = TYPE_LABELS[group.type as UnifiedType] ?? group.type;
  const remaining = group.total - group.hits.length;
  return (
    <section className="usearch-group" aria-label={label}>
      <h2 className="usearch-group-title">
        {label} <span className="kh-mono usearch-group-count">{group.total.toLocaleString()}</span>
      </h2>
      <ul className="usearch-list">
        {group.hits.map((hit, itemIndex) => (
          <li key={`${hit.type}:${hit.id}`}>
            <TrackedLink
              className="usearch-hit"
              href={unifiedHitHref(hit.type, hit.slug, hit.category)}
              viewId={viewId}
              item={{
                entityType: TYPE_ENTITY[hit.type],
                entityId: hit.id,
                screenType: 'UNIFIED_SEARCH',
                screenRef: query,
                sectionId: 'SEARCH_GROUP',
                sectionIndex: groupIndex,
                itemIndex,
              }}
            >
              {hit.thumbnailUrl && <img className="usearch-thumb" src={hit.thumbnailUrl} alt="" loading="lazy" />}
              <span className="usearch-hit-body">
                <span className="usearch-hit-title">{hit.title}</span>
                {hit.summary && <span className="usearch-hit-summary">{hit.summary}</span>}
                <span className="usearch-hit-meta kh-mono">
                  {[hit.category, hit.facets.level, hit.facets.genre].filter(Boolean).join(' · ')}
                </span>
              </span>
            </TrackedLink>
          </li>
        ))}
      </ul>
      {!expanded && remaining > 0 && (
        <button type="button" className="kh-button-ghost usearch-more" onClick={onMore}>
          {label} {remaining.toLocaleString()}건 더 보기
        </button>
      )}
    </section>
  );
}
