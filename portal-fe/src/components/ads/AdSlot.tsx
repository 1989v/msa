import { useEffect, useRef } from 'react';
import { ADSENSE_CLIENT } from '../../seo/copy.mjs';
import './AdSlot.css';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

interface AdSlotProps {
  /** AdSense 콘솔에서 광고 단위를 만들면 나오는 숫자 ID (`data-ad-slot`) */
  slot: string;
  /**
   * 지면 형태. `horizontal` 은 본문 사이 띠, `rectangle` 은 사이드/카드 자리.
   * 기본값 `auto` 는 폭에 맞춰 구글이 고르되 **자리 자체는 여기가 정한다**.
   */
  shape?: 'auto' | 'horizontal' | 'rectangle';
  /** 예약 높이(px). 실제 광고가 이보다 낮아도 자리를 유지해 레이아웃이 튀지 않는다. */
  minHeight?: number;
  className?: string;
}

/**
 * AdSense 디스플레이 광고 단위 — **자리를 코드가 정한다** (ADR-0076).
 *
 * 자동 광고와의 차이가 이 컴포넌트의 존재 이유다. 자동 광고는 구글이 DOM 을 훑어
 * 스스로 끼워 넣는데, 이 사이트의 브랜드 면은 여백과 판의 어긋남으로 깊이를 만드는
 * 구조라(DESIGN.md §12) 임의로 삽입된 띠 하나가 그 규칙을 깨뜨린다. 게임 화면에서는
 * 더 나빠서, 조작 영역 위에 겹치면 정책 위반이자 플레이 방해다.
 *
 * 그래서 자동 광고는 콘솔에서 끄고 이 컴포넌트만 쓴다. 넣을 자리를 고르는 일이
 * 곧 화면 설계다.
 *
 * 게시자 ID 가 없으면(승인 전) 아무것도 그리지 않는다 — 빈 회색 상자가 남으면
 * 심사자가 보는 화면에 깨진 자리가 생긴다.
 */
export default function AdSlot({ slot, shape = 'auto', minHeight = 100, className }: AdSlotProps) {
  const insRef = useRef<HTMLModElement>(null);
  // StrictMode 는 effect 를 두 번 돌린다. 같은 <ins> 에 두 번 push 하면 AdSense 가
  // "already have ads in them" 으로 던지고 그 지면은 영영 비어 있게 된다.
  const pushed = useRef(false);

  useEffect(() => {
    if (!ADSENSE_CLIENT || !slot || pushed.current || !insRef.current) return;
    pushed.current = true;
    // 스크립트가 아직 안 왔어도 배열에 쌓아두면 로드 직후 처리된다 (AdSense 규약)
    (window.adsbygoogle = window.adsbygoogle ?? []).push({});
    // slot 이 바뀌어도 pushed 가 재진입을 막는다 — 한 <ins> 에 두 번 push 하면 AdSense 가 던진다
  }, [slot]);

  // 이력서 호스트는 index.html 단계에서 스크립트를 싣지 않으므로 여기까지 오지 않지만,
  // 그 판정이 한 곳에만 있으면 나중에 조건이 갈렸을 때 빈 지면이 남는다.
  // slot 이 비는 것은 승인 전 정상 상태다 (ADSENSE_SLOTS 참조) — 자리는 잡혀 있고 ID 만 없다.
  if (!ADSENSE_CLIENT || !slot) return null;

  return (
    <aside
      className={`ad-slot${className ? ` ${className}` : ''}`}
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
