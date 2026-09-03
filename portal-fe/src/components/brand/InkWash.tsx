import { useEffect, useRef } from 'react';
import './InkWash.css';

/**
 * 먹 캔버스 — 포인터를 따라 한지에 먹이 번진다 (브랜드 면 전용).
 *
 * 유리(glassmorphism)가 아니라 먹(墨)이다: 액체의 부드러움은 유지하되 재료는
 * k-heritage 의 것을 쓴다. 의존성 0 의 2D 캔버스 근사 —
 *
 * - 호스트 크기의 저해상도 필드에 먹방울 스프라이트를 찍고,
 * - 매 프레임 미세 확대(번짐) + 알파 감쇠(마름)를 돌린 뒤,
 * - 업스케일 블릿한다. 저해상도 확대 자체가 자연스러운 번짐이 된다.
 *
 * 두 모드:
 * - 기본: 호스트(히어로) 안의 absolute 바탕층. 표시 캔버스 = 호스트 크기.
 * - `fullPage`: 페이지 전체가 지면이다. 필드는 페이지 좌표로 기록하고 표시
 *   캔버스는 **뷰포트 고정** — 매 프레임 스크롤 위치의 슬라이스만 그린다.
 *   먹이 화면(유리)이 아니라 지면(종이)에 남아, 스크롤하면 함께 흘러간다.
 *   레이어는 z-index -1 + 호스트 isolation 으로 배경 위·콘텐츠 아래에 깐다.
 *
 * 배터리 계약: 먹이 다 마르면 rAF 를 **완전히 멈춘다.** 포인터가 다시 깨운다.
 * 탭이 숨겨지거나 (히어로 모드에서) 호스트가 화면 밖이면 멈춘다. 정지 중
 * 스크롤은 슬라이스 한 번만 다시 그린다. reduced-motion 이면 정적 먹 자국
 * 한 장만 그리고 끝난다.
 *
 * 먹 색은 정경 토큰 `--kh-ink-wash`(RGB 세 자리)에서 읽는다 — 라이트는 기와 먹빛,
 * 다크는 흰 안개. 틴트는 표시 캔버스에서 `source-in` 으로 입히므로 테마 전환 시
 * 이미 번진 먹도 즉시 새 정경의 색이 된다.
 */

const FIELD_MAX_W = 420; // 필드 최대 가로 — 이 이상은 번짐이 아니라 해상도가 된다
const FIELD_MAX_H = 1600; // 필드 최대 세로 — 긴 페이지는 더 굵은 먹(더 큰 번짐)으로
const DECAY = 0.992; // 프레임당 마름
const BLEED = 1.0045; // 프레임당 확산
const DRY_FRAMES = 600; // 마지막 낙묵 후 이만큼 지나면 잔량 0.8% — 정지

export default function InkWash({ fullPage = false }: { fullPage?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;

    // 터치 기기는 소프트웨어 캔버스. GPU 캔버스는 컴포지터 레이어가 되고, 그 위에 그려지는 콘텐츠까지
    // "겹침" 사유로 승격시킨다(모바일 실측: 문서 높이만 한 레이어 하나가 더 생겼다). 터치에는 포인터 낙묵이
    // 없어 프레임마다 그릴 일도 없다.
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const dctx = canvas.getContext('2d', { willReadFrequently: coarse });
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

    /** 표시 캔버스 — fullPage 는 뷰포트, 아니면 호스트 크기 */
    const sizeCanvas = () => {
      const w = fullPage ? window.innerWidth : host.clientWidth;
      const h = fullPage ? window.innerHeight : host.clientHeight;
      if (w === 0 || h === 0) return false;
      // 같은 값이어도 width 재대입은 캔버스를 지운다 — 변화 없으면 건너뛴다
      if (w === canvas.width && h === canvas.height) return false;
      canvas.width = w;
      canvas.height = h;
      return true;
    };

    /** 필드 — 호스트(지면) 크기 기준. 이미 번진 먹은 새 판으로 옮겨 심는다 */
    const sizeField = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w === 0 || h === 0) return;
      const nextScale = Math.min(1 / 3, FIELD_MAX_W / w, FIELD_MAX_H / h);
      const nfw = Math.max(1, Math.round(w * nextScale));
      const nfh = Math.max(1, Math.round(h * nextScale));
      if (nfw === fw && nfh === fh) return;
      // 콘텐츠가 늦게 로드되면 페이지 키가 자란다 — 그때마다 먹을 버리면
      // 첫 낙묵이 매번 사라지므로, 기존 필드를 새 판에 옮겨 그린다.
      const old = front;
      const ratio = scale > 0 ? nextScale / scale : 1;
      const carryW = Math.round(old.width * ratio);
      const carryH = Math.round(old.height * ratio);
      front = document.createElement('canvas');
      back = document.createElement('canvas');
      front.width = back.width = nfw;
      front.height = back.height = nfh;
      if (old.width > 0 && carryW > 0) {
        front.getContext('2d')!.drawImage(old, 0, 0, carryW, carryH);
      }
      fw = nfw;
      fh = nfh;
      scale = nextScale;
    };

    sizeCanvas();
    sizeField();

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
      if (fullPage) {
        // 지면(필드)에서 지금 보이는 슬라이스만 뷰포트로
        const rect = host.getBoundingClientRect();
        dctx.drawImage(
          front,
          -rect.left * scale,
          -rect.top * scale,
          canvas.width * scale,
          canvas.height * scale,
          0,
          0,
          canvas.width,
          canvas.height,
        );
      } else {
        dctx.drawImage(front, 0, 0, canvas.width, canvas.height);
      }
      // 필드는 무채색 알파 마스크다 — 색은 여기서 입는다 (테마 전환 즉시 반영)
      dctx.globalCompositeOperation = 'source-in';
      dctx.fillStyle = `rgb(${ink})`;
      dctx.fillRect(0, 0, canvas.width, canvas.height);
      dctx.globalCompositeOperation = 'source-over';
    };

    /* ─── reduced-motion: 정적 먹 자국 한 장 ─── */
    if (reduced) {
      const w = host.clientWidth;
      // 호스트가 낮으면(히어로) 그 안으로, 높으면(페이지) 첫 화면 언저리로
      const y = Math.min(340, host.clientHeight * 0.42);
      stamp(w * 0.68, y, 90, 0.5);
      stamp(w * 0.62, y * 1.3, 60, 0.35);
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

    /* ─── 낙묵 — 포인터를 따라. 호스트 기준 좌표라 fullPage 에선 곧 지면 좌표다 ─── */
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

    /* ─── fullPage: 정지 중에도 스크롤하면 보이는 슬라이스를 갱신한다 ─── */
    let scrollRaf = 0;
    const onScroll = () => {
      if (running || scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = 0;
        present();
      });
    };
    if (fullPage) window.addEventListener('scroll', onScroll, { passive: true });

    const onWindowResize = () => {
      if (sizeCanvas() && !running) present();
    };
    if (fullPage) window.addEventListener('resize', onWindowResize);

    /* ─── 가드: 호스트 이탈·탭 숨김 시 정지 ─── */
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
      sizeCanvas();
      sizeField();
      if (!running) present();
    });
    ro.observe(host);

    /* ─── 첫 먹 — 판이 비어 보이지 않게 은은한 낙묵 하나.
     * y 는 호스트 높이에 클램프 — 낮은 히어로 호스트에서 필드 밖에 찍히면 사라진다 */
    // 가로 66% 는 데스크탑에서 히어로 판(오른쪽 칼럼) 뒤라 첫 먹이 보이지 않았다 — 카피 칼럼 쪽에 찍는다
    stamp(host.clientWidth * 0.42, Math.min(340, host.clientHeight * 0.45), 80, 0.28);
    wake();

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(scrollRaf);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('pointerleave', onLeave);
      if (fullPage) {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onWindowResize);
      }
      document.removeEventListener('visibilitychange', onVisibility);
      io.disconnect();
      mo.disconnect();
      ro.disconnect();
    };
  }, [fullPage]);

  return (
    <canvas
      ref={canvasRef}
      className={`kh-ink-wash${fullPage ? ' kh-ink-wash--page' : ''}`}
      aria-hidden="true"
    />
  );
}
