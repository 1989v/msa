import { useEffect, useState } from 'react';
import { fetchDisplayServices, type DisplayService } from '../../api/displayApi';
import { portalHomeHref, resolveExplorerHref, unifiedSearchHref } from '../../shell/serviceHref';
import { unifiedHref, type UnifiedHit } from '../../api/unifiedSearchApi';
import { useUnifiedSearch } from '../../hooks/useUnifiedSearch';
import KhSheet from '../shell/KhSheet';
import './ServiceExplorer.css';

/**
 * 서비스 탐색 오버레이 — 지금 화면 위로 떠서 내 다른 서비스로 건너가는 문.
 *
 * 목록은 메인 타일과 같은 원천(DB `display_service`, OPEN/PREOPEN)이다 — 하드코딩하면
 * 서비스를 열고 닫을 때마다 화면이 DB 와 어긋난다. 주소는 resolveExplorerHref 를 거쳐
 * 어느 프로덕션 호스트에서든 정규 origin 으로 나간다 (ADR-0066 개정 함정 회피).
 *
 * 모바일은 바텀시트, 데스크탑은 가운데 다이얼로그 — KhSheet 의 `kh-sheet--dialog`
 * 변형 하나로 CSS 가 가른다. 실패해도 화면을 막지 않는다(짧은 상태 문구만).
 */

/* 첫 열림에만 부른다 — 탐색은 세션 중 여러 번 열리는데 목록은 사실상 정적이다 */
let cache: DisplayService[] | null = null;

export default function ServiceExplorer({ onClose, lang = 'ko', navigate = (href: string) => window.location.assign(href) }: { onClose: () => void; lang?: 'ko' | 'en'; navigate?: (href: string) => void }) {
  const [services, setServices] = useState<DisplayService[] | null>(cache);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');

  const search = useUnifiedSearch(query);
  const open = (hit: UnifiedHit) => navigate(unifiedHref(hit));
  const hasSearch = !!query.trim() && !search.dismissed;
  useEffect(() => {
    if (search.activeId) document.getElementById(search.activeId)?.scrollIntoView?.({ block: 'nearest' });
  }, [search.activeId]);
  const typeLabels: Record<string, string> = lang === 'en'
    ? { game: 'Game', attraction: 'Place', cafe_drink: 'Cafe drink', blog_post: 'Blog', concept: 'Concept', deal_offer: 'Deal', product: 'Product', service: 'Service' }
    : { game: '게임', attraction: '장소', cafe_drink: '카페 음료', blog_post: '블로그', concept: '개념', deal_offer: '혜택', product: '상품', service: '서비스' };

  useEffect(() => {
    if (cache) return;
    let cancelled = false;
    fetchDisplayServices()
      .then((data) => {
        cache = data;
        if (!cancelled) setServices(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const englishNames: Record<string, string> = { game: 'Free web games', games: 'Free web games', place: 'Explore Korea', blog: 'Blog', rank: 'Rankings', deal: 'Deals', tech: 'Code dictionary', shop: 'Shop', quant: 'Trading', gifticon: 'Gift cards', commerce: 'Commerce', portfolio: 'Portfolio', ads: 'Ad network', fulfillment: 'Fulfillment' };
  const label = (service: DisplayService) => lang === 'en' ? englishNames[service.code] ?? service.code : service.label;
  return (
    <KhSheet label={lang === 'en' ? 'Explore services' : '서비스 탐색'} onClose={onClose} className="kh-sheet--dialog">
      <form className="kh-explorer-search" role="search" onSubmit={event => { event.preventDefault(); search.activate(open); }}>
        <input
          className="kh-field"
          type="search"
          value={query}
          role="combobox"
          autoComplete="off"
          maxLength={120}
          aria-autocomplete="list"
          aria-expanded={!!search.result?.hits.length}
          aria-controls={search.listId}
          aria-activedescendant={search.activeId}
          onChange={event => { search.invalidate(); setQuery(event.target.value); }}
          onCompositionStart={search.onCompositionStart}
          onCompositionEnd={search.onCompositionEnd}
          onKeyDown={event => search.onKeyDown(event, open, () => {
            if (hasSearch) { event.preventDefault(); event.stopPropagation(); search.dismiss(); }
          })}
          placeholder={lang === 'en' ? 'Search all services' : '모든 서비스에서 찾기 — 관광지 · 글 · 게임 · 개념 · 혜택 · 상품'}
          aria-label={lang === 'en' ? 'Search all services' : '통합 검색어'}
          enterKeyHint="search"
        />
        {hasSearch && <p className="kh-explorer-search-status" role="status" aria-live="polite">
          {search.status === 'loading' && (lang === 'en' ? 'Searching…' : '검색 중…')}
          {search.status === 'error' && (lang === 'en' ? 'Could not load results. Try again.' : '검색을 불러오지 못했습니다. 다시 입력해 주세요.')}
          {search.status === 'ready' && (search.result?.hits.length
            ? (lang === 'en' ? 'Use arrow keys to select, Enter to open.' : '방향키로 선택하고 Enter로 이동')
            : (lang === 'en' ? 'No results found.' : '검색 결과가 없습니다.'))}
        </p>}
        <ul id={search.listId} className="kh-explorer-suggestions" role="listbox" aria-label={lang === 'en' ? 'Search results' : '검색 결과'} aria-busy={search.status === 'loading'}>
          {search.result?.hits.map((hit, index) => <li key={hit.id} id={search.hitId(index)} role="option" aria-selected={search.selected === index}>
            <a href={unifiedHref(hit)} tabIndex={-1} onMouseEnter={() => search.setSelected(index)} onClick={event => { event.preventDefault(); open(hit); }}>
              <span className="kh-explorer-result-type">{typeLabels[hit.type] ?? hit.type}</span>
              <strong>{hit.title}</strong><small>{hit.summary}</small>
            </a>
          </li>)}
        </ul>
        {query.trim() && <a className="kh-explorer-all" href={`${unifiedSearchHref(query.trim())}&all=1`}>{lang === 'en' ? 'View all results' : '전체 결과 보기'}</a>}
      </form>
      <ul className="kh-explorer-list">
        {/* 본진 행은 고정이다 — 서브도메인 호스트에서 런처로 돌아가는 상시 통로.
            display_service 는 런처 "위에" 전시할 것만 담으므로 런처 자신이 없다. */}
        <li>
          <a className="kh-explorer-item" href={portalHomeHref()}>
            <span className="kh-explorer-label">{lang === 'en' ? '1989v home' : '1989v 홈'}</span>
            <span className="kh-explorer-tagline kh-mono">service launcher</span>
          </a>
        </li>
        {services?.map((service) => (
          <li key={service.code}>
            {service.status === 'OPEN' && service.href ? (
              <a
                className="kh-explorer-item"
                href={resolveExplorerHref(service.code, service.href)}
              >
                <span className="kh-explorer-label">{label(service)}</span>
                {lang === 'ko' && service.tagline && (
                  <span className="kh-explorer-tagline kh-mono">{service.tagline}</span>
                )}
              </a>
            ) : (
              <div className="kh-explorer-item is-preopen" aria-disabled="true">
                <span className="kh-explorer-label">{label(service)}</span>
                <span className="kh-explorer-badge">{lang === 'en' ? 'Coming soon' : '오픈 예정'}</span>
              </div>
            )}
          </li>
        ))}
      </ul>
      {!services && (
        <p className="kh-explorer-status" role="status">
          {lang === 'en' ? (failed ? 'Could not load services.' : 'Loading…') : (failed ? '서비스 목록을 불러오지 못했습니다.' : '불러오는 중…')}
        </p>
      )}
    </KhSheet>
  );
}
