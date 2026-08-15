// NOVA STRIKE — fx: 파티클, 히트스톱, 셰이크, 슬로모, 데미지 팝업, 잔상
'use strict';
(function () {
  const P = NS.PAL;
  const particles = [];
  const ghosts = [];
  const popups = [];   // ui.js 가 오버레이(고해상)에 렌더
  let shakeMag = 0, shakeDur = 0;
  let hitstopFrames = 0;
  let slowFactor = 1, slowFrames = 0, slowAcc = 0;
  let flashColor = null, flashFrames = 0, flashMax = 1;

  NS.FX = {
    reset() {
      particles.length = 0; ghosts.length = 0; popups.length = 0;
      shakeMag = 0; shakeDur = 0; hitstopFrames = 0;
      slowFactor = 1; slowFrames = 0; slowAcc = 0; flashFrames = 0;
    },
    get popups() { return popups; },

    // ── 시간 제어 ──
    hitstop(frames) { hitstopFrames = Math.max(hitstopFrames, frames); },
    get inHitstop() { return hitstopFrames > 0; },
    tickHitstop() { hitstopFrames = NS.tick(hitstopFrames); },
    slowmo(factor, frames) { slowFactor = factor; slowFrames = frames; },
    // 이번 프레임에 월드를 몇 번 갱신할지 (슬로모 구현) — 0 또는 1
    worldSteps() {
      if (hitstopFrames > 0) return 0;
      if (slowFrames > 0) {
        slowFrames--;
        if (!(slowFrames > 0)) { slowFactor = 1; slowAcc = 0; }
        slowAcc += slowFactor;
        if (slowAcc >= 1) { slowAcc -= 1; return 1; }
        return 0;
      }
      return 1;
    },

    shake(mag, dur) { shakeMag = Math.max(shakeMag, mag); shakeDur = Math.max(shakeDur, dur); },
    shakeOffset() {
      if (!(shakeDur > 0)) return { x: 0, y: 0 };
      return { x: NS.rand(-shakeMag, shakeMag), y: NS.rand(-shakeMag, shakeMag) };
    },
    flash(color, frames) { flashColor = color; flashFrames = frames; flashMax = frames; },

    // ── 스폰 ──
    p(o) { particles.push(Object.assign({ vx: 0, vy: 0, g: 0, life: 30, maxLife: 0, size: 2, color: P.white, fade: true }, o)); },
    burst(x, y, count, opts = {}) {
      for (let i = 0; i < count; i++) {
        const a = NS.rand(0, Math.PI * 2), sp = NS.rand(opts.spMin || 0.5, opts.spMax || 3);
        this.p({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opts.up || 0),
          g: opts.g !== undefined ? opts.g : 0.08,
          life: NS.randInt(opts.lifeMin || 14, opts.lifeMax || 34),
          size: NS.randInt(1, opts.size || 3),
          color: Array.isArray(opts.color) ? NS.pick(opts.color) : (opts.color || P.cyan3),
        });
      }
    },
    sparks(x, y, dir) {
      for (let i = 0; i < 6; i++) {
        this.p({
          x, y, vx: NS.rand(0.5, 3) * (dir || NS.pick([-1, 1])) + NS.rand(-0.5, 0.5),
          vy: NS.rand(-2, 0.5), g: 0.12, life: NS.randInt(8, 18),
          size: NS.randInt(1, 2), color: NS.pick([P.cyan3, P.white, P.yellow]),
        });
      }
    },
    // 파편 조각 (개체 팔레트 색으로 튀는 청크)
    debris(x, y, colors, n) {
      for (let i = 0; i < (n || 6); i++) {
        const a = NS.rand(-Math.PI, 0) - 0.4;
        this.p({
          x, y, vx: NS.rand(-2.6, 2.6), vy: NS.rand(-3.6, -1),
          g: 0.22, life: NS.randInt(26, 48), size: NS.randInt(2, 4),
          color: NS.pick(colors || [P.steel3, P.steel2, P.orange2]), fade: true,
        });
      }
    },
    explode(x, y, big, debrisColors) {
      NS.Audio.sfx(big ? 'bigExplode' : 'explode');
      // 코어 화구 + 충격파 링 + 파편 + 연기 (레이어드)
      this.p({ x, y, anim: 'explosion', life: 20, maxLife: 20, animFps: 5 });
      this.p({ x, y, anim: 'ring', life: 9, maxLife: 9, animFps: 3 });
      this.burst(x, y, big ? 22 : 10, { color: [P.orange3, P.red2, P.yellow, P.white], spMax: big ? 4.5 : 3, up: 0.5, size: big ? 4 : 3 });
      this.debris(x, y, debrisColors, big ? 10 : 6);
      for (let i = 0; i < (big ? 4 : 2); i++) {
        this.p({ x: x + NS.rand(-8, 8), y: y + NS.rand(-6, 2), anim: 'smoke', life: 26, maxLife: 26, animFps: 7, delay: 6 + i * 5, vy: -0.4, vx: NS.rand(-0.2, 0.2) });
      }
      if (big) {
        for (let i = 0; i < 4; i++) {
          const a = NS.rand(0, Math.PI * 2), d = NS.rand(8, 20);
          this.p({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, anim: 'explosion', life: 20, maxLife: 20, animFps: 5, delay: i * 4 });
        }
        this.shake(4, 18); this.hitstop(6);
      } else {
        this.shake(2, 8);
      }
    },
    hitSpark(x, y) { this.p({ x, y, anim: 'spark', life: 12, maxLife: 12, animFps: 4 }); },
    dust(x, y, dir) {
      this.p({ x, y: y - 3, anim: 'dust', life: 12, maxLife: 12, animFps: 4, vx: (dir || 0) * 0.6, vy: -0.15, flip: (dir || 1) < 0 });
    },
    casing(x, y, dir) { // 리볼버 탄피
      this.p({
        x, y, vx: -dir * NS.rand(0.8, 1.6), vy: NS.rand(-2.8, -1.8), g: 0.26,
        life: 34, size: 2, color: NS.pick([P.orange3, P.yellow, '#c0a050']), fade: true,
      });
    },
    muzzle(x, y) { this.p({ x, y, anim: 'muzzle', life: 6, maxLife: 6, animFps: 3 }); },
    ghost(img, x, y, flip) { ghosts.push({ img, x, y, flip, life: 14, maxLife: 14 }); },
    popup(x, y, text, color) { popups.push({ x, y, vy: -0.6, life: 42, maxLife: 42, text, color: color || '#ffffff' }); },

    // ── 갱신/렌더 ──
    update() {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        if (p.delay > 0) { p.delay--; continue; }
        p.x += p.vx; p.y += p.vy; p.vy += p.g;
        p.life--;
        if (!(p.life > 0)) particles.splice(i, 1);
      }
      for (let i = ghosts.length - 1; i >= 0; i--) {
        const gh = ghosts[i];
        gh.life--;
        if (!(gh.life > 0)) ghosts.splice(i, 1);
      }
      for (let i = popups.length - 1; i >= 0; i--) {
        const pu = popups[i];
        pu.y += pu.vy; pu.vy *= 0.94; pu.life--;
        if (!(pu.life > 0)) popups.splice(i, 1);
      }
      flashFrames = NS.tick(flashFrames);
      shakeDur = NS.tick(shakeDur);
      if (!(shakeDur > 0)) shakeMag = 0;
    },
    drawWorld(g, camX, camY) {
      for (const gh of ghosts) {
        g.globalAlpha = 0.35 * (gh.life / gh.maxLife);
        NS.blit(g, gh.img, gh.x - camX, gh.y - camY, gh.flip);
      }
      g.globalAlpha = 1;
      for (const p of particles) {
        if (p.delay > 0) continue;
        const x = p.x - camX, y = p.y - camY;
        if (x < -40 || x > NS.VW + 40 || y < -40 || y > NS.VH + 40) continue;
        if (p.anim) {
          const frames = NS.Sprites.fx[p.anim];
          const fi = Math.min(frames.length - 1, Math.floor((p.maxLife - p.life) / p.animFps));
          const img = frames[fi];
          NS.blit(g, img, x - img.width / 2, y - img.height / 2, p.flip);
        } else {
          g.globalAlpha = p.fade ? Math.min(1, p.life / 12) : 1;
          g.fillStyle = p.color;
          g.fillRect(Math.round(x - p.size / 2), Math.round(y - p.size / 2), p.size, p.size);
          g.globalAlpha = 1;
        }
      }
    },
    drawScreenFlash(g) {
      if (flashFrames > 0 && flashColor) {
        g.globalAlpha = 0.5 * (flashFrames / flashMax);
        g.fillStyle = flashColor;
        g.fillRect(0, 0, NS.VW, NS.VH);
        g.globalAlpha = 1;
      }
    },
  };
})();
