import { useEffect, useState } from 'react';
import { fetchDisplayServices, type DisplayService } from '../../api/displayApi';
import { portalHomeHref, resolveExplorerHref } from '../../shell/serviceHref';
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
