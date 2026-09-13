import { useEffect, useState, type FormEvent } from 'react';
import { fetchDisplayServices, type DisplayService } from '../../api/displayApi';
import { portalHomeHref, resolveExplorerHref, unifiedSearchHref } from '../../shell/serviceHref';
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

export default function ServiceExplorer({ onClose }: { onClose: () => void }) {
  const [services, setServices] = useState<DisplayService[] | null>(cache);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');

  // 어느 호스트에서 열든 통합 검색은 apex 의 /search 하나다 — 주소가 서비스마다 갈리지 않게
  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    window.location.assign(unifiedSearchHref(q));
  };

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

  return (
    <KhSheet label="서비스 탐색" onClose={onClose} className="kh-sheet--dialog">
      <form className="kh-explorer-search" role="search" onSubmit={submitSearch}>
        <input
          className="kh-field"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="모든 서비스에서 찾기 — 관광지 · 글 · 게임 · 개념 · 혜택 · 상품"
          aria-label="통합 검색어"
          enterKeyHint="search"
        />
      </form>
      <ul className="kh-explorer-list">
        {/* 본진 행은 고정이다 — 서브도메인 호스트에서 런처로 돌아가는 상시 통로.
            display_service 는 런처 "위에" 전시할 것만 담으므로 런처 자신이 없다. */}
        <li>
          <a className="kh-explorer-item" href={portalHomeHref()}>
            <span className="kh-explorer-label">1989v 홈</span>
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
                <span className="kh-explorer-label">{service.label}</span>
                {service.tagline && (
                  <span className="kh-explorer-tagline kh-mono">{service.tagline}</span>
                )}
              </a>
            ) : (
              <div className="kh-explorer-item is-preopen" aria-disabled="true">
                <span className="kh-explorer-label">{service.label}</span>
                <span className="kh-explorer-badge">오픈 예정</span>
              </div>
            )}
          </li>
        ))}
      </ul>
      {!services && (
        <p className="kh-explorer-status" role="status">
          {failed ? '서비스 목록을 불러오지 못했습니다.' : '불러오는 중…'}
        </p>
      )}
    </KhSheet>
  );
}
