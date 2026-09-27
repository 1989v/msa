import { useEffect, useState } from 'react';
import { reportFill, requestDecision, type HouseCreative, type PaidAd } from '../../components/ads/adsApi';
import BannerAd from '../../components/ads/BannerAd';
import HouseRotator from '../../components/ads/HouseRotator';

/**
 * 게임 목록 위 띠 지면 — 유료 띠배너 우승자가 있으면 그것을, 없으면 결정 응답의 HOUSE 목록을 6초마다 돌린다.
 * 이 지면은 띠배너만 받으므로 카드 우승자는 그릴 틀이 없어 HOUSE 로 간다.
 * 같은 페이지의 다른 지면과 결정 한 번으로 묶이도록 같은 문맥 키를 받는다.
 * 둘 다 없거나 결정이 실패하면 아무것도 그리지 않는다.
 */
export default function HouseBanner({ placementKey, contextKey = '' }: { placementKey: string; contextKey?: string }) {
  const [ad, setAd] = useState<PaidAd | null>(null);
  const [house, setHouse] = useState<HouseCreative[]>([]);

  useEffect(() => {
    let live = true;
    void requestDecision(placementKey, contextKey).then((decision) => {
      if (!live) return;
      const banner = decision.ad?.format === 'BANNER' ? decision.ad : null;
      setAd(banner);
      setHouse(decision.house);
      reportFill(placementKey, banner ? 'PAID' : decision.house.length > 0 ? 'HOUSE' : 'EMPTY');
    });
    return () => {
      live = false;
    };
  }, [placementKey, contextKey]);

  // 유료와 홍보를 기계에도 다르게 알린다 — 유료 광고를 「홍보」로 읽히게 두지 않는다
  if (ad) {
    return (
      <aside className="house-banner" aria-label="광고">
        <BannerAd ad={ad} />
      </aside>
    );
  }
  if (house.length === 0) return null;
  return (
    <aside className="house-banner" aria-label="홍보">
      <HouseRotator creatives={house} />
    </aside>
  );
}
