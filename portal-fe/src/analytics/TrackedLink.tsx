import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { TrackedItem } from './events';
import { track } from './tracker';
import { useImpression } from './useImpression';

/**
 * 노출·클릭을 함께 기록하는 링크 (ADR-0095).
 *
 * 둘을 한 곳에 두는 이유: 노출만 붙이고 클릭을 빠뜨리면 CTR 이 **분자만 0** 이 되어
 * 「노출은 많은데 클릭이 없다」로 잘못 읽힌다. 섹션마다 따로 달면 한쪽을 잊는다.
 */
export default function TrackedLink({
  to, href, item, viewId, className, children,
}: {
  /** 같은 SPA 안의 경로 */
  to?: string;
  /** 다른 호스트로 나가는 주소 (통합 검색 결과처럼). `to` 대신 이걸 주면 평범한 `<a>` 로 그린다 */
  href?: string;
  item: TrackedItem;
  viewId: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useImpression<HTMLAnchorElement>(item, viewId);
  const click = () => track('CLICK', item, viewId);
  // 라우터 Link 는 절대 URL 을 같은 앱 경로로 읽어 버린다 — 바깥 주소는 `<a>` 여야 한다.
  if (href !== undefined) {
    return (
      <a ref={ref} className={className} href={href} onClick={click}>
        {children}
      </a>
    );
  }
  return (
    <Link ref={ref} className={className} to={to!} onClick={click} viewTransition>
      {children}
    </Link>
  );
}
