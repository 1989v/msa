import AppInstallMenu from '../components/shell/AppInstallMenu';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { unifiedHref } from '../api/unifiedSearchApi';
import type { UnifiedHit } from '../api/unifiedSearchApi';
import ThemeToggle from '../components/ThemeToggle';
import { useHeritageSurface } from '../hooks/useHeritageSurface';
import { useUnifiedSearch } from '../hooks/useUnifiedSearch';
import { useSeo } from '../seo/useSeo';
import './UnifiedSearchPage.css';

const TYPE_LABELS: Record<string, string> = { game: '게임', attraction: '장소', cafe_drink: '카페 음료', blog_post: '블로그 글', concept: '개념', deal_offer: '혜택', product: '상품', service: '서비스' };
const typeLabel = (type: string) => TYPE_LABELS[type] ?? type;
const validPage = (value: string | null) => /^\d+$/.test(value ?? '') ? Math.min(199, Number(value)) : 0;

export default function UnifiedSearchPage({ navigate = (href: string) => window.location.assign(href) }: { navigate?: (href: string) => void }) {
  useHeritageSurface();
  useSeo({ title: '검색 | 1989v', description: '게임, 장소, 카페 음료를 검색하고 바로 이동하세요.', canonical: 'https://1989v.com/search', noindex: true });
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [all, setAll] = useState(params.get('all') === '1');
  const [page, setPage] = useState(validPage(params.get('page')));
  const [requestNonce, setRequestNonce] = useState(0);
  const queryString = params.toString();
  const search = useUnifiedSearch(q, { all, page, requestKey: queryString, nonce: requestNonce });
  const { result, status, selected, setSelected, invalidate } = search;
  useEffect(() => {
    setQ(params.get('q') ?? '');
    setAll(params.get('all') === '1'); setPage(validPage(params.get('page')));
    // URL changes, including Back/Forward, restore the complete search state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);
  const fullResults = (nextPage = 0) => {
    if (!q.trim()) return;
    invalidate(); setRequestNonce(previous => previous + 1); setAll(true); setPage(nextPage);
    setParams({ q: q.trim(), all: '1', ...(nextPage ? { page: String(nextPage) } : {}) });
  };
  const open = (hit: UnifiedHit) => navigate(unifiedHref(hit));
  const { activeId } = search;
  return <main className="unified-search">
    <header><a className="unified-brand" href="/" aria-label="1989v 홈">1989v<span className="kh-mono"> / SEARCH</span></a><AppInstallMenu /><ThemeToggle /></header>
    <section aria-labelledby="unified-title">
      <p className="unified-eyebrow">찾고, 바로 가기</p><h1 className="kh-display" id="unified-title">무엇을 찾으세요?</h1>
      <p className="unified-intro">게임, 장소, 카페 음료까지 한 번에 찾아보세요.</p>
      <label className="unified-input-label" htmlFor="unified-query">검색어</label>
      <input className="kh-field" id="unified-query" role="combobox" aria-autocomplete="list" aria-expanded={!!result?.hits.length} aria-controls={search.listId} aria-activedescendant={activeId}
        autoComplete="off" placeholder="게임명, 장소명, 음료명" maxLength={120} value={q}
        onCompositionStart={search.onCompositionStart} onCompositionEnd={search.onCompositionEnd}
        onChange={event => { invalidate(); setQ(event.target.value); setAll(false); setPage(0); }}
        onKeyDown={event => search.onKeyDown(event, open, () => { invalidate(); setQ(''); })} />
      <div className="unified-toolbar"><button className="kh-button kh-button-ghost" type="button" disabled={!q.trim()} onClick={() => fullResults()}>전체 결과 보기</button></div>
      <div role="status" aria-live="polite">
        {status === 'idle' && '이름을 입력하면 바로 갈 수 있는 결과를 보여드립니다.'}
        {status === 'loading' && '검색 중…'}
        {status === 'error' && '검색을 불러오지 못했습니다. 잠시 후 다시 입력해 주세요.'}
        {status === 'ready' && (result?.hits.length ? `${all ? result.total : result.hits.length}개 결과 · 방향키로 선택하고 Enter로 이동` : '검색 결과가 없습니다.')}
      </div>
      <ul id={search.listId} role="listbox" aria-label="검색 결과" aria-busy={status === 'loading'}>
        {result?.hits.map((hit, index) => <li id={search.hitId(index)} key={hit.id} role="option" aria-selected={selected === index}>
          <a href={unifiedHref(hit)} onClick={event => { event.preventDefault(); open(hit); }} onMouseEnter={() => setSelected(index)}>
            <span className="unified-hit-type">{typeLabel(hit.type)}</span><strong>{hit.title}</strong><small>{hit.summary}</small><span aria-hidden="true">↗</span>
          </a>
        </li>)}
      </ul>
      {all && result && <nav aria-label="검색 결과 페이지"><button className="kh-button kh-button-ghost" disabled={page === 0} onClick={() => fullResults(page - 1)}>이전</button><span>{page + 1} 페이지</span><button className="kh-button kh-button-ghost" disabled={(result.totalPages !== undefined ? page + 1 >= result.totalPages : (page + 1) * result.size >= result.total) || page >= 199} onClick={() => fullResults(page + 1)}>다음</button></nav>}
      <p className="unified-install">브라우저의 ‘홈 화면에 추가’ 또는 ‘앱 설치’로 검색을 바로 여세요. 검색에는 인터넷 연결이 필요합니다.</p>
    </section>
  </main>;
}
