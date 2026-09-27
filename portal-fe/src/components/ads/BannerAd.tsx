import { useCallback } from 'react';
import { useImpression } from '../../analytics/useImpression';
import { apiUrl, clickHref, queueImpression, type PaidAd } from './adsApi';
import './AdSlot.css';

/**
 * 유료 띠배너 — 6.4:1 이미지 한 장과, 이미지 **밖**의 「광고 · 광고주 이름」 한 줄.
 *
 * 표시를 이미지 밖에 두는 이유: 광고주 이미지가 「광고」 표시를 가리거나 흉내 낼 수 없어야 한다.
 * 링크·노출 계측은 카드(`AdCard`)와 같다 — 클릭 리다이렉터, sponsored, 새 탭, `useImpression` 기준 한 번.
 * 이미지 자리는 `aspect-ratio` 로 먼저 잡아 두어 이미지가 늦게 와도 아래가 밀리지 않는다.
 */
export default function BannerAd({ ad }: { ad: PaidAd }) {
  const token = ad.impressionToken;
  const onVisible = useCallback(() => queueImpression(token), [token]);
  const observe = useImpression<HTMLAnchorElement>(null, '', onVisible);

  return (
    <a
      ref={observe}
      className="ad-banner"
      href={clickHref(ad.clickUrl)}
      target="_blank"
      rel="sponsored nofollow noopener"
    >
      <span className="ad-banner-frame">
        <img className="ad-banner-image" src={apiUrl(ad.imageUrl)} alt={ad.title} loading="lazy" width={1280} height={200} />
      </span>
      <span className="ad-banner-meta">
        <span className="ad-banner-mark">광고</span>
        <span aria-hidden="true"> · </span>
        <span className="ad-banner-advertiser">{ad.advertiserName}</span>
      </span>
    </a>
  );
}
