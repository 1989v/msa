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
  to, item, viewId, className, children,
}: {
  to: string;
  item: TrackedItem;
  viewId: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useImpression<HTMLAnchorElement>(item, viewId);
  return (
    <Link
      ref={ref}
      className={className}
      to={to}
      onClick={() => track('CLICK', item, viewId)}
    >
      {children}
    </Link>
  );
}
