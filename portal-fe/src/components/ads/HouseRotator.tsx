import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { isAppPath, type HouseCreative } from './adsApi';

/** 소재를 바꿔 보여 주는 간격 (ms). */
export const HOUSE_ROTATION_MS = 6_000;

/**
 * 자체 홍보(HOUSE) 소재 순환 — 판(slab) 위에 이모지·제목·문구. 페이지가 밝아도 판은 어둡다(아케이드 규칙).
 * 앱 안 경로는 SPA 이동, https 주소는 일반 링크다.
 */
export default function HouseRotator({ creatives }: { creatives: HouseCreative[] }) {
  const [index, setIndex] = useState(0);
  const count = creatives.length;

  useEffect(() => {
    if (count < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), HOUSE_ROTATION_MS);
    return () => clearInterval(timer);
  }, [count]);

  if (count === 0) return null;
  const current = index % count;
  const creative = creatives[current];
  const label = `홍보: ${creative.title}`;
  const inner: ReactNode = (
    <>
      <span className="kh-icon-box ad-house-emoji" aria-hidden="true">
        {creative.emoji ?? '📣'}
      </span>
      <span className="ad-house-text">
        <strong>{creative.title}</strong>
        <span>{creative.body}</span>
      </span>
      <span className="ad-house-tag">AD</span>
    </>
  );

  return (
    <div className="ad-house">
      {isAppPath(creative.link) ? (
        <Link to={creative.link} className="ad-house-card kh-slab" aria-label={label}>
          {inner}
        </Link>
      ) : (
        <a href={creative.link} className="ad-house-card kh-slab" aria-label={label} rel="noopener">
          {inner}
        </a>
      )}
      {count > 1 && (
        <div className="ad-house-dots" aria-hidden="true">
          {creatives.map((c, i) => (
            <span key={c.creativeId} className={i === current ? 'on' : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}
