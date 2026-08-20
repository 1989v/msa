import { useEffect, useRef } from 'react';
import './InkWash.css';

/**
 * 먹 캔버스 — 포인터를 따라 한지에 먹이 번진다 (브랜드 히어로 전용).
 *
 * 유리(glassmorphism)가 아니라 먹(墨)이다: 액체의 부드러움은 유지하되 재료는
 * k-heritage 의 것을 쓴다. 의존성 0 의 2D 캔버스 근사 —
 *
 * - 표시 크기의 1/3 저해상도 필드에 먹방울 스프라이트를 찍고,
 * - 매 프레임 미세 확대(번짐) + 알파 감쇠(마름)를 돌린 뒤,
 * - 업스케일 블릿한다. 저해상도 확대 자체가 자연스러운 번짐이 된다.
 *
 * 배터리 계약: 먹이 다 마르면 rAF 를 **완전히 멈춘다.** 포인터가 다시 깨운다.
 * 히어로가 화면 밖이거나 탭이 숨겨져도 멈춘다. reduced-motion 이면 정적 먹 자국
 * 한 장만 그리고 끝난다.
 *
 * 먹 색은 정경 토큰 `--kh-ink-wash`(RGB 세 자리)에서 읽는다 — 라이트는 기와 먹빛,
 * 다크는 흰 안개. 틴트는 표시 캔버스에서 `source-in` 으로 입히므로 테마 전환 시
 * 이미 번진 먹도 즉시 새 정경의 색이 된다.
 */

const FIELD_MAX_W = 420; // 필드 최대 가로 — 이 이상은 번짐이 아니라 해상도가 된다
const DECAY = 0.992; // 프레임당 마름
const BLEED = 1.0045; // 프레임당 확산
const DRY_FRAMES = 600; // 마지막 낙묵 후 이만큼 지나면 잔량 0.8% — 정지

export default function InkWash() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;

    const dctx = canvas.getContext('2d');
    if (!dctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ─── 먹 색 — 정경 토큰에서 ─── */
    let ink = '29 29 31';
    const readInk = () => {
      const v = getComputedStyle(document.documentElement)
        .getPropertyValue('--kh-ink-wash')
        .trim();
      if (v) ink = v;
    };
    readInk();

    /* ─── 붓 — 노이즈 구멍을 뚫은 방사형 먹방울 3종 ─── */
    const makeSprite = (size: number) => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d')!;
      const r = size / 2;
      const grad = g.createRadialGradient(r, r, r * 0.08, r, r, r);
      grad.addColorStop(0, 'rgba(0,0,0,0.6)');
      grad.addColorStop(0.62, 'rgba(0,0,0,0.26)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
      // 가장자리에 구멍을 빼서 먹 특유의 불균질을 만든다
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 10; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const d = r * (0.45 + Math.random() * 0.5);
        const x = r + Math.cos(a) * d;
        const y = r + Math.sin(a) * d;
        const rr = r * (0.08 + Math.random() * 0.16);
        const hole = g.createRadialGradient(x, y, 0, x, y, rr);
        hole.addColorStop(0, 'rgba(0,0,0,0.55)');
        hole.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = hole;
        g.beginPath();
        g.arc(x, y, rr, 0, Math.PI * 2);
        g.fill();
      }
      return c;
    };
    const sprites = [makeSprite(96), makeSprite(96), makeSprite(96)];

    /* ─── 필드 — 더블 버퍼 (자기 블릿의 미정의 동작을 피한다) ─── */
    let front = document.createElement('canvas');
    let back = document.createElement('canvas');
    let fw = 0;
    let fh = 0;
    let scale = 1 / 3;

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w === 0 || h === 0) return;
      // 크기가 그대로면 건너뛴다 — width 재대입은 같은 값이어도 캔버스를 지우므로,
      // ResizeObserver 의 초기 콜백이 첫 낙묵을 지워버린다
      if (w === canvas.width && h === canvas.height) return;
      canvas.width = w;
      canvas.height = h;
      scale = Math.min(1 / 3, FIELD_MAX_W / w);
      fw = Math.max(1, Math.round(w * scale));
      fh = Math.max(1, Math.round(h * scale));
      // 리사이즈는 판을 새로 까는 것 — 기존 먹은 버린다 (드물고, 보간 왜곡보다 낫다)
      front.width = fw;
      front.height = fh;
      back.width = fw;
      back.height = fh;
    };
    resize();

    const stamp = (x: number, y: number, radius: number, alpha: number) => {
      const g = front.getContext('2d')!;
      const sprite = sprites[(Math.random() * sprites.length) | 0];
      g.globalAlpha = alpha;
      const r = radius * scale;
      g.translate(x * scale, y * scale);
      g.rotate(Math.random() * Math.PI * 2);
      g.drawImage(sprite, -r, -r, r * 2, r * 2);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
    };

    const present = () => {
      dctx.clearRect(0, 0, canvas.width, canvas.height);
      dctx.imageSmoothingEnabled = true;
      dctx.drawImage(front, 0, 0, canvas.width, canvas.height);
      // 필드는 무채색 알파 마스크다 — 색은 여기서 입는다 (테마 전환 즉시 반영)
      dctx.globalCompositeOperation = 'source-in';
      dctx.fillStyle = `rgb(${ink})`;
      dctx.fillRect(0, 0, canvas.width, canvas.height);
      dctx.globalCompositeOperation = 'source-over';
    };

    /* ─── reduced-motion: 정적 먹 자국 한 장 ─── */
    if (reduced) {
      stamp(canvas.width * 0.68, canvas.height * 0.42, 90, 0.5);
      stamp(canvas.width * 0.62, canvas.height * 0.55, 60, 0.35);
      present();
      return;
    }

    /* ─── 루프 — 먹이 마르면 완전히 멈춘다 ─── */
    let raf = 0;
    let running = false;
    let sinceStamp = DRY_FRAMES; // 시작은 마른 상태
    let inView = true;
    let pageVisible = !document.hidden;

    const step = () => {
      const bg = back.getContext('2d')!;
      bg.clearRect(0, 0, fw, fh);
      bg.globalAlpha = DECAY;
      // 중심 기준 미세 확대 — 번짐의 근사
      const dx = (fw * (BLEED - 1)) / 2;
      const dy = (fh * (BLEED - 1)) / 2;
      bg.drawImage(front, -dx, -dy, fw * BLEED, fh * BLEED);
      bg.globalAlpha = 1;
      [front, back] = [back, front];

      present();

      sinceStamp += 1;
      if (sinceStamp >= DRY_FRAMES || !inView || !pageVisible) {
        running = false;
        return;
      }
      raf = requestAnimationFrame(step);
    };

    const wake = () => {
      sinceStamp = 0;
      if (!running && inView && pageVisible) {
        running = true;
        raf = requestAnimationFrame(step);
      }
    };

    /* ─── 낙묵 — 포인터를 따라 ─── */
    let lastX = -1;
    let lastY = -1;
    const onMove = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (lastX >= 0) {
        const v = Math.hypot(x - lastX, y - lastY);
        if (v > 2) stamp(x, y, 10 + Math.min(v, 40) * 0.7, 0.07);
      }
      lastX = x;
      lastY = y;
      wake();
    };
    const onDown = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      stamp(e.clientX - rect.left, e.clientY - rect.top, 46, 0.16);
      wake();
    };
    const onLeave = () => {
      lastX = -1;
      lastY = -1;
    };

    host.addEventListener('pointermove', onMove, { passive: true });
    host.addEventListener('pointerdown', onDown, { passive: true });
    host.addEventListener('pointerleave', onLeave, { passive: true });

    /* ─── 가드: 히어로 이탈·탭 숨김 시 정지 ─── */
    const io = new IntersectionObserver((entries) => {
      inView = entries.some((e) => e.isIntersecting);
      if (inView) wake();
    });
    io.observe(host);

    const onVisibility = () => {
      pageVisible = !document.hidden;
      if (pageVisible) wake();
    };
    document.addEventListener('visibilitychange', onVisibility);

    /* ─── 정경/테마 전환 — 먹 색 즉시 교체 ─── */
    const mo = new MutationObserver(() => {
      readInk();
      if (!running) present();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-surface'],
    });

    const ro = new ResizeObserver(() => {
      resize();
      if (!running) present();
    });
    ro.observe(host);

    /* ─── 첫 먹 — 판이 비어 보이지 않게 은은한 낙묵 하나 ─── */
    stamp(canvas.width * 0.66, canvas.height * 0.45, 80, 0.28);
    wake();

    return () => {
      cancelAnimationFrame(raf);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      io.disconnect();
      mo.disconnect();
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="kh-ink-wash" aria-hidden="true" />;
}
