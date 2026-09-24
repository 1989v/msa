import { useEffect, useRef, useState } from 'react';
import { ADSENSE_CLIENT, ADSENSE_SLOTS } from '../../seo/copy.mjs';
import { ensureAdsenseLoaded } from './adsenseLoader';
import { reportFill, requestDecision, type FillSource, type HouseCreative, type PaidAd } from './adsApi';
import AdCard from './AdCard';
import HouseRotator from './HouseRotator';
import './AdSlot.css';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export type AdPlacementKey = keyof typeof ADSENSE_SLOTS;

/** AdSense 가 `data-ad-status` 를 적기를 기다리는 상한 (ms). 차단기·로드 실패면 끝내 안 적힌다. */
export const ADSENSE_STATUS_TIMEOUT_MS = 3_000;

interface AdSlotProps {
  /** 지면 키 — ads 지면 등록부의 키이자 `ADSENSE_SLOTS` 의 키 */
  placement: AdPlacementKey;
  /** 문맥 키 — `blog:{카테고리 slug}` · `game:{장르 slug}` · `place:{광역 코드}`, 없으면 빈 값. 마운트 때 값을 쓴다 */
  contextKey?: string;
  /** false 면 결정 호출 없이 AdSense 만 — 자체 광고를 싣지 않는 지면(혜택 허브) */
  selfAds?: boolean;
  /**
   * 지면 형태. `horizontal` 은 본문 사이 띠, `rectangle` 은 사이드/카드 자리.
   * 기본값 `auto` 는 폭에 맞춰 구글이 고르되 **자리 자체는 여기가 정한다**.
   */
  shape?: 'auto' | 'horizontal' | 'rectangle';
  /** AdSense 자리의 예약 높이(px). 실제 광고가 이보다 낮아도 자리를 유지해 레이아웃이 튀지 않는다. */
  minHeight?: number;
  className?: string;
}

type Phase = 'waiting' | 'paid' | 'adsense' | 'house' | 'empty';

/**
 * 광고 지면 — **자리를 코드가 정한다** (ADR-0076, ADR-0098).
 *
 * 채움 순서: 자체 유료 광고 → AdSense(그 지면 ID 가 있을 때) → 자체 홍보(HOUSE) → 자리 숨김.
 * 결정 호출이 실패하면(오류·DECISION_TIMEOUT_MS 초과·빈 응답·형식 불일치) 유료가 없는 것으로 보고 AdSense 로 간다.
 * AdSense 가 `unfilled` 를 적거나 3초 안에 아무 상태도 안 적으면(차단기·로드 실패) HOUSE 로 간다.
 *
 * 자동 광고는 콘솔에서 끄고 이 컴포넌트만 쓴다 — 자동 광고는 DOM 을 훑어 임의로 끼워 넣어
 * 브랜드 면의 여백 규칙(DESIGN.md §12)을 깨고, 게임 화면에서는 조작 영역을 가린다.
 *
 * 결정을 기다리는 동안 자리 높이를 비워 두는 것은 **예전에도 자리를 잡던 지면(AdSense ID 가 있는 지면)만**이다.
 * ID 가 없는 지면은 전에 아무것도 그리지 않았으므로, 대기 중 높이를 잡으면 없던 밀림이 새로 생긴다.
 */
export default function AdSlot({
  placement,
  contextKey = '',
  selfAds = true,
  shape = 'auto',
  minHeight = 100,
  className,
}: AdSlotProps) {
  const slot: string = ADSENSE_SLOTS[placement];
  const hasAdsense = Boolean(ADSENSE_CLIENT && slot);
  const [phase, setPhase] = useState<Phase>(selfAds ? 'waiting' : hasAdsense ? 'adsense' : 'empty');
  const [ad, setAd] = useState<PaidAd | null>(null);
  const [house, setHouse] = useState<HouseCreative[]>([]);
  const [adsenseFilled, setAdsenseFilled] = useState(false);
  const insRef = useRef<HTMLModElement>(null);
  // StrictMode 는 effect 를 두 번 돌린다. 같은 <ins> 에 두 번 push 하면 AdSense 가
  // "already have ads in them" 으로 던지고 그 지면은 영영 비어 있게 된다.
  const pushed = useRef(false);
  const reported = useRef(false);
  // 문맥은 마운트 때 값으로 한 번 결정한다 — 이미 채운 AdSense 단위는 다시 채울 수 없다
  const contextRef = useRef(contextKey);

  useEffect(() => {
    if (!selfAds) return;
    let live = true;
    void requestDecision(placement, contextRef.current).then((decision) => {
      if (!live) return;
      setAd(decision.ad);
      setHouse(decision.house);
      if (decision.ad) setPhase('paid');
      else if (hasAdsense) setPhase('adsense');
      else setPhase(decision.house.length > 0 ? 'house' : 'empty');
    });
    return () => {
      live = false;
    };
  }, [placement, selfAds, hasAdsense]);

  // 최종 채움 출처를 지면마다 한 번 알린다(참고 통계). 자체 광고를 싣지 않는 지면은 등록부에 없어 보내지 않는다.
  const source: FillSource | null =
    phase === 'paid' ? 'PAID'
      : phase === 'house' ? 'HOUSE'
        : phase === 'empty' ? 'EMPTY'
          : phase === 'adsense' && adsenseFilled ? 'ADSENSE'
            : null;
  useEffect(() => {
    if (!selfAds || !source || reported.current) return;
    reported.current = true;
    reportFill(placement, source);
  }, [selfAds, source, placement]);

  useEffect(() => {
    if (phase !== 'adsense' || !insRef.current || pushed.current) return;
    pushed.current = true;
    // 로더는 지면이 생길 때 부른다 — 지면 없는 화면(메인 등)은 스크립트를 받지 않는다
    ensureAdsenseLoaded();
    // 스크립트가 아직 안 왔어도 배열에 쌓아두면 로드 직후 처리된다 (AdSense 규약)
    (window.adsbygoogle = window.adsbygoogle ?? []).push({});
  }, [phase]);

  useEffect(() => {
    const ins = insRef.current;
    if (phase !== 'adsense' || !selfAds || !ins) return;
    const fallback = () => setPhase(house.length > 0 ? 'house' : 'empty');
    const settle = (): boolean => {
      const status = ins.getAttribute('data-ad-status');
      if (status === null) return false;
      if (status === 'unfilled') fallback();
      else setAdsenseFilled(true);
      return true;
    };
    if (settle()) return;
    const observer = new MutationObserver(() => {
      if (!settle()) return;
      observer.disconnect();
      clearTimeout(timer);
    });
    observer.observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] });
    const timer = setTimeout(() => {
      observer.disconnect();
      fallback();
    }, ADSENSE_STATUS_TIMEOUT_MS);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [phase, selfAds, house]);

  const classes = `ad-slot${className ? ` ${className}` : ''}`;

  if (phase === 'empty') return null;
  if (phase === 'waiting') {
    // 예전에 자리를 잡던 지면만 높이를 비워 둔다 — 나머지는 결정 전까지 아무것도 그리지 않는다
    if (!hasAdsense) return null;
    return <aside className={classes} style={{ minHeight }} aria-label="광고" aria-busy="true" />;
  }
  if (phase === 'paid' && ad) {
    return (
      <aside className={classes} aria-label="광고">
        <AdCard ad={ad} />
      </aside>
    );
  }
  if (phase === 'house') {
    return (
      <aside className={classes} aria-label="광고">
        <HouseRotator creatives={house} />
      </aside>
    );
  }

  return (
    <aside
      className={classes}
      style={{ minHeight }}
      // 광고임을 기계에도 알린다 — 본문으로 읽히면 스크린리더 사용자가 문맥을 잃는다
      aria-label="광고"
    >
      <span className="ad-slot-label kh-mono">광고</span>
      <ins
        ref={insRef}
        className="adsbygoogle ad-slot-unit"
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format={shape === 'auto' ? 'auto' : shape}
        data-full-width-responsive="true"
      />
    </aside>
  );
}
