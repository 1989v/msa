import { useEffect, useState } from 'react';
import { reportFill, requestDecision, type HouseCreative } from '../../components/ads/adsApi';
import HouseRotator from '../../components/ads/HouseRotator';

/**
 * 자체 홍보(HOUSE) 전용 지면 — 광고 결정 응답의 HOUSE 목록을 6초마다 돌린다.
 * 같은 페이지의 다른 지면과 결정 한 번으로 묶이도록 같은 문맥 키를 받는다.
 * 목록이 비었거나 결정이 실패하면 아무것도 그리지 않는다.
 */
export default function HouseBanner({ placementKey, contextKey = '' }: { placementKey: string; contextKey?: string }) {
  const [house, setHouse] = useState<HouseCreative[]>([]);

  useEffect(() => {
    let live = true;
    void requestDecision(placementKey, contextKey).then((decision) => {
      if (!live) return;
      setHouse(decision.house);
      reportFill(placementKey, decision.house.length > 0 ? 'HOUSE' : 'EMPTY');
    });
    return () => {
      live = false;
    };
  }, [placementKey, contextKey]);

  if (house.length === 0) return null;
  return (
    <aside className="house-banner" aria-label="홍보">
      <HouseRotator creatives={house} />
    </aside>
  );
}
