// NOVA STRIKE — gfx: 마스터 팔레트, 베이크 헬퍼, 자동 외곽선/림라이트 포스트
// 아트 디렉션: 심야 인디고 베이스 + 네온 액센트. 전 스프라이트가 같은 포스트를 통과해
// 외곽선·림라이트 문법이 통일된다.
'use strict';
(function () {
  NS.PAL = {
    ink: '#0a0c1e',
    night1: '#11142e', night2: '#1b2150', night3: '#2b3178',
    steel1: '#23263f', steel2: '#3c4265', steel3: '#5c6690', steel4: '#8b96bd', steel5: '#c3cbe8',
    white: '#f2f7ff',
    cyan1: '#1585b8', cyan2: '#38e0ff', cyan3: '#a8f6ff',
    blue1: '#1b3fa0', blue2: '#2f6fe4', blue3: '#6fb0ff',
    violet1: '#4a1d7e', violet2: '#8244d8', violet3: '#c08cff',
    magenta1: '#8c1660', magenta2: '#e63e8f', magenta3: '#ff9fd0',
    red1: '#7e1d2c', red2: '#e04545', red3: '#ff9070',
    orange1: '#8a3c12', orange2: '#f07820', orange3: '#ffc44d',
    yellow: '#ffe66d',
    green1: '#1c6e46', green2: '#3ecf6e', green3: '#a5ffb5',
  };
  const P = NS.PAL;

  NS.makeCanvas = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    return c;
  };

  const hexToRgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  };
  NS.hexToRgb = hexToRgb;
  NS.rgba = (hex, a) => {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  };

  // 자동 외곽선(외측) + 림라이트(윗면) 포스트 — 스프라이트 공통 문법
  NS.outlinePass = (canvas, opts = {}) => {
    const outline = hexToRgb(opts.outline || P.ink);
    const rim = hexToRgb(opts.rim || P.cyan3);
    const rimA = opts.rimAlpha !== undefined ? opts.rimAlpha : 0.75;
    const ow = opts.outlineW || 1;
    const w = canvas.width, h = canvas.height;
    const g = canvas.getContext('2d');
    const src = g.getImageData(0, 0, w, h);
    const out = g.createImageData(w, h);
    const s = src.data, d = out.data;
    const A = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : s[(y * w + x) * 4 + 3];
    const nearOpaque = (x, y) => {
      for (let r = 1; r <= ow; r++) {
        if (A(x - r, y) > 8 || A(x + r, y) > 8 || A(x, y - r) > 8 || A(x, y + r) > 8) return true;
        if (r > 1 && (A(x - 1, y - 1) > 8 || A(x + 1, y - 1) > 8 || A(x - 1, y + 1) > 8 || A(x + 1, y + 1) > 8)) return true;
      }
      return false;
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const a = s[i + 3];
        if (a > 8) {
          d[i] = s[i]; d[i + 1] = s[i + 1]; d[i + 2] = s[i + 2]; d[i + 3] = a;
          if (A(x, y - 1) <= 8 || A(x, y - 2) <= 8 && ow > 1) { // 윗면 림라이트
            d[i] = Math.round(NS.lerp(s[i], rim[0], rimA));
            d[i + 1] = Math.round(NS.lerp(s[i + 1], rim[1], rimA));
            d[i + 2] = Math.round(NS.lerp(s[i + 2], rim[2], rimA));
          }
        } else if (nearOpaque(x, y)) {
          d[i] = outline[0]; d[i + 1] = outline[1]; d[i + 2] = outline[2]; d[i + 3] = 255;
        }
      }
    }
    g.clearRect(0, 0, w, h);
    g.putImageData(out, 0, 0);
    return canvas;
  };

  // 베이크: 2× 슈퍼샘플로 그린 뒤 다운스케일 — 곡선/사선의 계단 도트를 제거한 클린 룩.
  // 정수 렉트(타일 등)는 무손실로 유지된다. post 는 하이레즈에서 적용(가는 외곽선).
  NS.bake = (w, h, fn, opts) => {
    const RES = 2;
    const hi = NS.makeCanvas(w * RES, h * RES);
    const hg = hi.getContext('2d');
    hg.scale(RES, RES);
    fn(hg, w, h);
    if (!opts || opts.post !== false) NS.outlinePass(hi, Object.assign({ outlineW: RES }, opts));
    const c = NS.makeCanvas(w, h);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(hi, 0, 0, w, h);
    c.hi = hi;   // 2× 원본 보존 — 메뉴 초상 등 확대 드로우용
    return c;
  };

  // 2x2 체커 디더 그라디언트 (하늘 등 대면적 — ctx.filter 금지 대체)
  NS.ditherGrad = (g, x, y, w, h, stops) => {
    const bands = stops.length - 1;
    const bandH = h / bands;
    for (let b = 0; b < bands; b++) {
      const y0 = y + b * bandH;
      g.fillStyle = stops[b];
      g.fillRect(x, y0, w, bandH);
      // 다음 밴드 색으로 디더 전이 (하단 30%)
      g.fillStyle = stops[b + 1];
      const dz = Math.max(2, bandH * 0.34);
      for (let yy = Math.floor(y0 + bandH - dz); yy < y0 + bandH; yy++) {
        for (let xx = Math.floor(x); xx < x + w; xx += 2) {
          if ((xx + yy) % 4 === 0) g.fillRect(xx, yy, 1, 1);
        }
      }
    }
  };

  // 캡슐형 리무(limb) — 벡터 스트로크 3톤 (라운드 캡, 계단 없는 클린 렌더)
  NS.limb = (g, x0, y0, x1, y1, w, base, dark, lite) => {
    const line = (ox, oy, lw, col) => {
      if (!col) return;
      g.strokeStyle = col;
      g.lineWidth = Math.max(1, lw);
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x0 + ox, y0 + oy);
      g.lineTo(x1 + ox, y1 + oy);
      g.stroke();
    };
    line(0.3, 0.5, w, dark || base);       // 하단 셰이드 (아래로 살짝)
    line(-0.2, -0.3, w - 0.9, base);       // 본체
    if (lite) line(-0.5, -w * 0.28, Math.max(1, w * 0.34), lite);  // 상단 하이라이트
  };

  // 원판(머리·관절) — 벡터 아크 3톤
  NS.orb = (g, cx, cy, r, base, dark, lite) => {
    const disc = (ox, oy, rr, col) => {
      if (!col || rr <= 0) return;
      g.fillStyle = col;
      g.beginPath();
      g.arc(cx + ox, cy + oy, rr, 0, Math.PI * 2);
      g.fill();
    };
    disc(0, 0.2, r, dark || base);
    disc(-0.2, -0.4, r - 0.7, base);
    disc(-r * 0.22, -r * 0.3, r * 0.52, lite);
  };

  // 셰이딩 박스: 3톤 (상단 lite 1px / 본체 base / 하단 dark)
  NS.box3 = (g, x, y, w, h, base, dark, lite) => {
    g.fillStyle = base; g.fillRect(x, y, w, h);
    if (dark) { g.fillStyle = dark; g.fillRect(x, y + h - Math.max(1, (h * 0.3) | 0), w, Math.max(1, (h * 0.3) | 0)); }
    if (lite) { g.fillStyle = lite; g.fillRect(x, y, w, 1); }
  };

  // 스프라이트 드로우 (flip 지원)
  NS.blit = (g, img, x, y, flip, alpha) => {
    if (alpha !== undefined && alpha < 1) g.globalAlpha = Math.max(0, alpha);
    if (flip) {
      g.save();
      g.translate(Math.round(x) + img.width, Math.round(y));
      g.scale(-1, 1);
      g.drawImage(img, 0, 0);
      g.restore();
    } else {
      g.drawImage(img, Math.round(x), Math.round(y));
    }
    if (alpha !== undefined && alpha < 1) g.globalAlpha = 1;
  };

  // 접지 그림자
  NS.groundShadow = (g, cx, footY, w) => {
    g.fillStyle = 'rgba(5,6,15,0.45)';
    const hw = Math.round(w / 2);
    g.fillRect(Math.round(cx - hw + 2), Math.round(footY), (hw - 2) * 2, 2);
    g.fillRect(Math.round(cx - hw), Math.round(footY), hw * 2, 1);
  };

  // 비네트 베이크 (radial gradient 1회 생성)
  NS.makeVignette = (w, h, strength) => {
    const c = NS.makeCanvas(w, h);
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(w / 2, h / 2, h * 0.44, w / 2, h / 2, h * 0.92);
    grad.addColorStop(0, 'rgba(5,6,15,0)');
    grad.addColorStop(1, `rgba(5,6,15,${strength})`);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    return c;
  };
})();
