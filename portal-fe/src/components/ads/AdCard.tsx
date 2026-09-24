import { useCallback } from 'react';
import { useImpression } from '../../analytics/useImpression';
import { apiUrl, clickHref, queueImpression, type PaidAd } from './adsApi';

/**
 * 유료 광고 카드 — 「광고」 인장은 늘 보이고, 카드 전체가 클릭 리다이렉터로 간다.
 *
 * 광고주가 쓴 문자열은 **텍스트 노드로만** 그린다. HTML 로 해석하면 광고주가 이 사이트에서 스크립트를 돌릴 수 있다.
 * 노출은 그린 순간이 아니라 `useImpression` 기준(면적·머무름)을 채운 순간에 한 번 알린다 — 과금 근거라서다.
 */
export default function AdCard({ ad }: { ad: PaidAd }) {
  const token = ad.impressionToken;
  const onVisible = useCallback(() => queueImpression(token), [token]);
  const observe = useImpression<HTMLAnchorElement>(null, '', onVisible);

  return (
    <a
      ref={observe}
      className="ad-card"
      href={clickHref(ad.clickUrl)}
      target="_blank"
      rel="sponsored nofollow noopener"
    >
      <img className="ad-card-image" src={apiUrl(ad.imageUrl)} alt="" loading="lazy" width={1200} height={628} />
      <span className="ad-card-body">
        <span className="ad-card-top">
          <span className="kh-seal kh-seal-ink ad-card-seal">
            <span className="kh-seal-dot" aria-hidden="true" />
            광고
          </span>
          <span className="ad-card-advertiser">{ad.advertiserName}</span>
        </span>
        <span className="ad-card-title">{ad.title}</span>
        <span className="ad-card-copy">{ad.body}</span>
        <span className="ad-card-cta" aria-hidden="true">
          자세히 보기 →
        </span>
      </span>
    </a>
  );
}
