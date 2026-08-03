import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAdPlacement, type AdPlacement } from '../../api/gameApi';

/**
 * HOUSE 배너 슬롯 — frequency cap(서버 판정)에 걸리면 data=null 이라 아무것도 렌더하지 않는다.
 * 크리에이티브는 6초 간격 로테이션.
 */
export default function HouseBanner({ placementKey }: { placementKey: string }) {
  const [placement, setPlacement] = useState<AdPlacement | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    fetchAdPlacement(placementKey)
      .then(setPlacement)
      .catch(() => setPlacement(null));
  }, [placementKey]);

  useEffect(() => {
    const count = placement?.creatives.length ?? 0;
    if (count < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), 6000);
    return () => clearInterval(timer);
  }, [placement]);

  if (!placement || placement.creatives.length === 0) return null;
  const creative = placement.creatives[index % placement.creatives.length];

  return (
    <Link to={creative.href ?? '/'} className="house-banner" aria-label={`홍보: ${creative.title ?? ''}`}>
      <span className="house-banner-emoji" aria-hidden>
        {creative.emoji ?? '📣'}
      </span>
      <span className="house-banner-text">
        <strong>{creative.title}</strong>
        <span>{creative.body}</span>
      </span>
      <span className="house-banner-tag">AD</span>
    </Link>
  );
}
