import { useCallback, useEffect, useRef, useState } from 'react';

// 잰 값이 있을 때의 하한 — 너무 크게 잡으면 작은 캔버스 아래에 빈 공간이 남는다.
const MIN_H = 200;
const MAX_H = 900;

/**
 * 게임 iframe 높이를 **내용에 맞춰** 잡는다.
 *
 * 고정 높이(560px)로 두면 세로 화면에서 가로형 캔버스가 폭에 맞춰 작아지는데 iframe 은 그대로라
 * 위아래로 큰 빈 공간이 남았다(실측 151px씩). 캔버스가 작아 보이고, 하단 조작부가 게임 화면에서
 * 멀어진다 — 모바일 피드백의 두 증상이 같은 원인이다.
 *
 * 두 가지를 함께 본다:
 *  - **캔버스**: 고유 비율(width/height 속성 — 게임 좌표계라 불변)로 `폭 / 비율` 을 계산한다.
 *    iframe 높이에 의존하지 않으므로 높이를 바꿔도 되먹임 진동이 없다.
 *  - **떠 있는 패널**(메뉴·결과 등): 캔버스보다 큰 경우가 있어 캔버스만 재면 잘린다.
 *    패널은 보였다 숨었다 하므로 MutationObserver 로 표시 변화를 따라간다.
 *
 * 비율을 못 읽으면(캔버스 없는 DOM 게임, 크로스 오리진) null 을 돌려 CSS 기본 높이를 쓰게 둔다.
 */
export function useStageFit(active: boolean) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState<number | null>(null);

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
    // 조작부가 실제로 비워 둔 높이를 그대로 읽는다 — 상수로 추정하면 조작부가 없는 게임에서
    // 빈 공간이 남고, 있는 게임에서는 잘린다. lib/touch.js 가 --vt-pad-h 로 알려준다.
    const padH = parseFloat(
      doc.defaultView?.getComputedStyle(doc.documentElement).getPropertyValue('--vt-pad-h') || '0',
    ) || 0;
    // 캔버스 없는 게임(DOM 기반 데일리 퍼즐 등)도 있다 — 그때는 아래 흐름·패널 높이만 쓴다.
    const canvasFit =
      canvas && canvas.width && canvas.height ? width / (canvas.width / canvas.height) + padH : 0;

    // 떠 있는 패널이 필요로 하는 높이. **scrollHeight 를 쓰는 게 핵심** — 패널은 컨테이너를
    // 덮도록 만들어져 있어(inset:0) 실제 표시 높이는 iframe 높이를 그대로 따라간다.
    // 그 값으로 iframe 높이를 정하면 잴 때마다 커지는 되먹임이 생긴다.
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

  useEffect(() => {
    if (!active) return;
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
  }, [active, measure]);

  return { ref, height };
}
