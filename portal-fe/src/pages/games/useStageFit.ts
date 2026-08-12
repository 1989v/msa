import { useCallback, useEffect, useRef, useState } from 'react';

// 잰 값이 있을 때의 하한 — 너무 크게 잡으면 작은 캔버스 아래에 빈 공간이 남는다.
const MIN_H = 200;
const MAX_H = 900;

/** 좁은 터치 화면 — 여기서는 게임에 화면을 통째로 준다(몰입 모드). */
function isImmersiveViewport() {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  return coarse && Math.min(window.innerWidth, window.innerHeight) <= 860;
}

/**
 * 게임 iframe 의 높이를 정한다. 화면 종류에 따라 **방식이 다르다**.
 *
 * ## 모바일: 재지 않는다
 *
 * 내용을 재서 높이를 정하면 되먹임이 생긴다. 게임 안의 `lib/touch.js` 는 자기 뷰포트
 * (= iframe 높이)를 보고 캔버스와 조작 영역을 배치하는데, 그 결과를 다시 재서 iframe 높이로
 * 삼으면 서로가 서로의 입력이 된다. 실측으로 두 종착점이 나왔다:
 *  - 메뉴에서 패널 높이가 iframe 을 밀어 올려 상한 900px 까지 증가 (캔버스는 217px)
 *  - 플레이 중에는 218px 로 붕괴 → 게임 쪽에서 390×218 을 **가로모드로 오인** →
 *    조작 영역을 0 으로 두고 높이에 맞춰 캔버스를 줄인 채 고정
 * "화면이 세로로 무한히 늘어난다 / 플레이 중 창이 작아진다" 가 같은 원인의 두 얼굴이었다.
 *
 * 그래서 모바일에서는 iframe 을 **뷰포트 크기 오버레이**로 띄우고(호출 쪽이 immersive 로
 * 처리) 높이 계산을 아예 하지 않는다. 게임은 확정된 크기를 받아 그 안에서만 배치한다 —
 * 의존 방향이 한쪽으로 흐르므로 진동할 여지가 없다.
 *
 * ## 데스크톱: 내용에 맞춘다
 *
 * 조작 패드가 없어 게임이 뷰포트 높이를 보지 않으므로 되먹임이 없다. 고정 높이(560px)면
 * 가로형 캔버스 위아래로 빈 공간이 남으므로 캔버스 비율·패널·흐름 내용 중 최대값을 쓴다.
 */
export function useStageFit(active: boolean) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [immersive, setImmersive] = useState(isImmersiveViewport);
  const [portrait, setPortrait] = useState(() => window.innerHeight >= window.innerWidth);

  const measure = useCallback(() => {
    const frame = ref.current;
    if (!frame) return;
    let doc: Document | null = null;
    try {
      doc = frame.contentDocument;
    } catch {
      return; // 크로스 오리진 — CSS 기본값 유지
    }
    const canvas = doc?.querySelector('canvas');
    const width = frame.clientWidth;
    if (!doc || !width) {
      setHeight(null);
      return;
    }
    // 캔버스 없는 게임(DOM 기반 데일리 퍼즐 등)도 있다 — 그때는 아래 흐름·패널 높이만 쓴다.
    const canvasFit = canvas && canvas.width && canvas.height ? width / (canvas.width / canvas.height) : 0;

    // 떠 있는 패널이 필요로 하는 높이. **scrollHeight 를 쓰는 게 핵심** — 패널은 컨테이너를
    // 덮도록 만들어져 있어(inset:0) 실제 표시 높이는 iframe 높이를 그대로 따라간다.
    // scrollHeight 는 내용이 정하는 값이라 컨테이너 높이와 무관해 고정점이 된다.
    let panelNeed = 0;
    const view = doc.defaultView;
    doc.querySelectorAll<HTMLElement>('.panel, #menu, #endPanel, [data-stage-panel]').forEach((el) => {
      if (el.hasAttribute('hidden')) return;
      // offsetParent 로 판정하면 안 된다 — position:fixed 요소는 항상 null 이다.
      const cs = view?.getComputedStyle(el);
      if (!cs || cs.display === 'none' || cs.visibility === 'hidden') return;
      if (el.scrollHeight > 0) panelNeed = Math.max(panelNeed, el.scrollHeight + 8);
    });

    // 메뉴가 곧 본문인 게임(방치형 상점 목록 등)은 캔버스·패널만 재면 모자라 내용이 잘린다.
    // body 의 **흐름 자식** 높이 합을 쓴다 — 떠 있는 요소(fixed/absolute)는 제외해야 하고,
    // scrollHeight 로 컨테이너를 재면 iframe 높이를 따라가 되먹임이 생기므로 쓰지 않는다.
    // 높이를 **더하지 않고** 가장 아래 자식의 끝을 본다 — 합산은 margin 을 놓쳐 모자란다.
    let flowNeed = 0;
    Array.from(doc.body.children).forEach((child) => {
      const el = child as HTMLElement;
      const cs = view?.getComputedStyle(el);
      if (!cs || cs.position === 'fixed' || cs.position === 'absolute' || cs.display === 'none') return;
      flowNeed = Math.max(flowNeed, el.offsetTop + el.offsetHeight + (parseFloat(cs.marginBottom) || 0));
    });
    if (flowNeed > 0) flowNeed += parseFloat(view?.getComputedStyle(doc.body).paddingBottom || '0') || 0;

    setHeight(Math.min(MAX_H, Math.max(MIN_H, Math.round(Math.max(canvasFit, panelNeed, flowNeed)))));
  }, []);

  // 회전하면 몰입 여부가 바뀔 수 있다 (태블릿 경계)
  useEffect(() => {
    const sync = () => {
      setImmersive(isImmersiveViewport());
      setPortrait(window.innerHeight >= window.innerWidth);
    };
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
    };
  }, []);

  useEffect(() => {
    if (!active || immersive) return;
    const frame = ref.current;
    if (!frame) return;
    let observer: MutationObserver | null = null;
    let timer = 0;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(measure, 120);
    };
    const onLoad = () => {
      measure();
      window.setTimeout(measure, 400);
      // 메뉴 ↔ 플레이 ↔ 결과 전환은 hidden 토글로 일어난다 — 표시가 바뀌면 다시 잰다.
      const doc = (() => {
        try {
          return frame.contentDocument;
        } catch {
          return null;
        }
      })();
      if (doc?.body) {
        observer = new MutationObserver(schedule);
        observer.observe(doc.body, { attributes: true, subtree: true, attributeFilter: ['hidden', 'style', 'class'] });
      }
    };
    frame.addEventListener('load', onLoad);
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
      frame.removeEventListener('load', onLoad);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
    };
  }, [active, immersive, measure]);

  return { ref, height: immersive ? null : height, immersive, portrait };
}
