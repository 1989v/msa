// NOVA STRIKE — level: 타일맵, 충돌, 카메라, 테마별 타일셋/패럴랙스 배경 베이크
'use strict';
(function () {
  const P = NS.PAL;
  const T = NS.TILE;
  const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

  // ── 테마 정의 ──────────────────────────────────────────
  NS.THEMES = {
    magma: {
      key: 'magma', name: '마그마 제련구역',
      block: { base: '#54303a', dark: '#331c26', lite: '#8a5152', deco: '#f07820', top: '#a86a55', topL: '#e0a080' },
      hazard: 'lava', ambient: 'ember',
      skyStops: ['#1a0b14', '#33101a', '#571c1e', '#7e2a1c'],
    },
    cryo: {
      key: 'cryo', name: '빙결 연구동',
      block: { base: '#2e4a72', dark: '#1b2c4c', lite: '#5c85b8', deco: '#38e0ff', top: '#7fb2d8', topL: '#d8f4ff' },
      hazard: 'none', ambient: 'snow',
      skyStops: ['#070a20', '#0c1534', '#12254c', '#1b3a60'],
    },
    storm: {
      key: 'storm', name: '폭풍 공중정원',
      block: { base: '#3d3a5e', dark: '#232140', lite: '#6a659a', deco: '#c08cff', top: '#5e796e', topL: '#9fd8b8' },
      hazard: 'pit', ambient: 'rain',
      skyStops: ['#12102a', '#1e1840', '#2c2258', '#43307e'],
    },
    core: {
      key: 'core', name: '코어 스파이어',
      block: { base: '#31284e', dark: '#1c1633', lite: '#5a4a86', deco: '#e63e8f', top: '#6a5aa0', topL: '#a893d8' },
      hazard: 'none', ambient: 'data',
      skyStops: ['#04030d', '#0a0618', '#140a28', '#1e1038'],
    },
  };

  // ── 타일셋 베이크 ──────────────────────────────────────
  function bakeTileset(theme) {
    const B = theme.block;
    const ts = {};
    const rng = NS.makeRng(theme.key.length * 7919 + 17);
    // 상단 타일 (지표) — 변형 3종
    ts.top = [0, 1, 2].map(v => NS.bake(T, T, (g) => {
      R(g, 0, 0, T, T, B.base);
      R(g, 0, 0, T, 4, B.top); R(g, 0, 0, T, 1, B.topL);
      R(g, 0, T - 4, T, 4, B.dark);
      if (v === 1) { R(g, 3, 6, 2, 2, B.dark); R(g, 10, 9, 3, 2, B.dark); }
      if (v === 2) { R(g, 6, 7, 4, 1, B.lite); R(g, 2, 10, 2, 2, B.dark); R(g, 12, 5, 2, 1, B.lite); }
      R(g, (v * 5 + 2) % 12, 2, 1, 1, B.topL);
    }, { post: false }));
    // 내부 타일 — 변형 3종
    ts.inner = [0, 1, 2].map(v => NS.bake(T, T, (g) => {
      R(g, 0, 0, T, T, B.base);
      R(g, 0, 0, T, 1, NS.rgba(B.lite, 0.4));
      R(g, 0, T - 3, T, 3, B.dark);
      if (v === 0) { R(g, 2, 4, 5, 4, B.dark); R(g, 3, 5, 3, 2, B.base); }
      if (v === 1) { R(g, 9, 3, 4, 4, B.dark); R(g, 4, 10, 6, 2, B.dark); R(g, 10, 4, 2, 2, NS.rgba(B.deco, 0.5)); }
      if (v === 2) { R(g, 3, 3, 2, 2, B.lite); R(g, 11, 9, 3, 3, B.dark); }
      // 리벳
      if (rng() > 0.4) { R(g, 1, 1, 1, 1, B.lite); R(g, 14, 1, 1, 1, B.lite); }
    }, { post: false }));
    // 원웨이 플랫폼
    ts.oneway = NS.bake(T, T, (g) => {
      R(g, 0, 0, T, 5, B.lite); R(g, 0, 0, T, 1, B.topL);
      R(g, 0, 4, T, 2, B.dark);
      R(g, 2, 2, 2, 1, B.topL); R(g, 12, 2, 2, 1, B.topL);
      R(g, 1, 6, 2, 3, B.dark); R(g, 13, 6, 2, 3, B.dark);
    }, { post: false });
    // 가시
    ts.spike = NS.bake(T, T, (g) => {
      R(g, 0, 13, T, 3, B.dark);
      for (let i = 0; i < 4; i++) {
        const x = i * 4;
        R(g, x + 1, 6, 2, 8, P.steel4);
        R(g, x + 1, 4, 1, 3, P.steel5);
        R(g, x + 1, 3, 1, 1, P.white);
        R(g, x + 2, 8, 1, 6, P.steel2);
      }
    }, { post: false });
    ts.spikeDown = NS.bake(T, T, (g) => {
      g.save(); g.translate(0, T); g.scale(1, -1); g.drawImage(ts.spike, 0, 0); g.restore();
    }, { post: false });
    // 컨베이어 (2프레임 × 좌우)
    const conv = (dir, f) => NS.bake(T, T, (g) => {
      R(g, 0, 0, T, T, B.dark);
      R(g, 0, 0, T, 6, P.steel2); R(g, 0, 0, T, 1, P.steel4);
      const off = (f * 4 * dir + T * 2) % 8;
      for (let x = -8; x < T + 8; x += 8) {
        R(g, x + off, 1, 4, 4, P.steel3);
        R(g, x + off, 1, 4, 1, P.steel5);
      }
      R(g, 0, 6, T, 2, B.dark);
      R(g, 2, 9, 3, 3, P.steel2); R(g, 11, 9, 3, 3, P.steel2);
    }, { post: false });
    ts.convL = [conv(-1, 0), conv(-1, 1)];
    ts.convR = [conv(1, 0), conv(1, 1)];
    // 얼음 (미끄럼)
    ts.ice = [0, 1].map(v => NS.bake(T, T, (g) => {
      R(g, 0, 0, T, T, '#4a7ec2');
      R(g, 0, 0, T, 4, '#8fc6ea'); R(g, 0, 0, T, 1, '#e8fbff');
      R(g, 0, T - 3, T, 3, '#2c4a86');
      R(g, v ? 9 : 3, 6, 4, 1, '#c8ecff');
      R(g, v ? 4 : 10, 9, 2, 3, '#c8ecff');
    }, { post: false }));
    // 부서지는 블록
    ts.crack = NS.bake(T, T, (g) => {
      R(g, 0, 0, T, T, B.base);
      R(g, 0, 0, T, 2, B.lite); R(g, 0, T - 2, T, 2, B.dark);
      R(g, 7, 2, 1, 5, B.dark); R(g, 5, 6, 4, 1, B.dark); R(g, 9, 7, 1, 5, B.dark);
      R(g, 4, 10, 1, 3, B.dark); R(g, 11, 3, 1, 3, B.dark);
      R(g, 6, 5, 1, 1, B.lite);
    }, { post: false });
    // 용암 표면/내부 (2프레임)
    ts.lava = [0, 1].map(f => NS.bake(T, T, (g) => {
      R(g, 0, 0, T, T, P.orange2);
      R(g, 0, 6, T, 10, P.red2);
      R(g, 0, 12, T, 4, P.red1);
      for (let x = 0; x < T; x += 4) {
        const h = ((x / 4 + f) % 2) ? 3 : 1;
        R(g, x, 0, 4, h, P.yellow);
      }
      R(g, f ? 3 : 10, 4, 3, 2, P.orange3);
      R(g, f ? 11 : 4, 8, 2, 2, P.orange3);
    }, { post: false }));
    ts.lavaInner = NS.bake(T, T, (g) => {
      R(g, 0, 0, T, T, P.red1);
      R(g, 3, 4, 3, 2, P.red2); R(g, 10, 10, 4, 2, P.red2);
    }, { post: false });
    // 붕괴 발판 (2프레임 — 온전/흔들림)
    ts.crumble = [0, 1].map(f => NS.bake(T, T, (g) => {
      const oy = f ? 1 : 0;
      R(g, 1, 2 + oy, 14, 5, B.lite); R(g, 1, 2 + oy, 14, 1, B.topL);
      R(g, 1, 5 + oy, 14, 2, B.dark);
      R(g, 3, 7 + oy, 2, 2, B.dark); R(g, 11, 7 + oy, 2, 2, B.dark);
      R(g, 7, 3 + oy, 1, 3, B.dark);
    }, { post: false }));
    return ts;
  }

  // ── 배경 베이크 (4층: 하늘/원경/중경/근경) ─────────────
  function bakeBackground(theme) {
    const bg = {};
    const W = 960, H = 270;
    // 하늘
    bg.sky = NS.makeCanvas(NS.VW, NS.VH);
    {
      const g = bg.sky.getContext('2d');
      NS.ditherGrad(g, 0, 0, NS.VW, NS.VH, theme.skyStops);
      const rng = NS.makeRng(theme.key.charCodeAt(0) * 131);
      if (theme.key === 'magma') {
        // 지평선 용광 발광
        for (let i = 0; i < 5; i++) R(g, 0, 200 + i * 8, NS.VW, 4, NS.rgba('#f07820', 0.10 + i * 0.05));
        for (let i = 0; i < 26; i++) R(g, rng() * NS.VW, 30 + rng() * 130, 1, 1, NS.rgba('#ffc44d', 0.5)); // 불티빛
      } else if (theme.key === 'cryo') {
        for (let i = 0; i < 60; i++) R(g, rng() * NS.VW, rng() * 180, 1, 1, NS.rgba('#e8fbff', 0.35 + rng() * 0.5));
        // 오로라 커튼
        for (let i = 0; i < 3; i++) {
          const bx = 60 + i * 150 + rng() * 40;
          for (let x = 0; x < 90; x += 3) {
            const h = 40 + Math.sin(x * 0.16 + i) * 16;
            R(g, bx + x, 24 + Math.sin(x * 0.09) * 10, 2, h, NS.rgba(i % 2 ? '#38e0ff' : '#3ecf6e', 0.09));
          }
        }
      } else if (theme.key === 'storm') {
        for (let i = 0; i < 30; i++) R(g, rng() * NS.VW, rng() * 90, 1, 1, NS.rgba('#e8e4ff', 0.4));
        // 소용돌이 구름 밴드
        for (let i = 0; i < 4; i++) {
          const y = 60 + i * 44;
          for (let x = 0; x < NS.VW; x += 6) {
            R(g, x, y + Math.sin(x * 0.05 + i * 2) * 8, 6, 10, NS.rgba('#43307e', 0.35));
            R(g, x, y + Math.sin(x * 0.05 + i * 2) * 8, 6, 2, NS.rgba('#6a4ab0', 0.3));
          }
        }
      } else { // core — 거대 코어 눈 + 디지털 성야
        for (let i = 0; i < 70; i++) R(g, rng() * NS.VW, rng() * NS.VH, 1, 1, NS.rgba(rng() > 0.5 ? '#38e0ff' : '#e63e8f', 0.25 + rng() * 0.4));
        for (let r = 60; r > 0; r -= 6) {
          R(g, 240 - r, 100 - r * 0.5, r * 2, r, NS.rgba('#e63e8f', 0.05));
        }
        NS.orb(g, 240, 100, 16, '#8c1660', '#4a0d36', '#e63e8f');
        NS.orb(g, 240, 100, 7, '#e63e8f', '#8c1660', '#ff9fd0');
        R(g, 238, 97, 3, 3, '#ffffff');
      }
    }
    // 원경 (parallax 0.15)
    bg.far = NS.makeCanvas(W, H);
    {
      const g = bg.far.getContext('2d');
      const rng = NS.makeRng(theme.key.charCodeAt(1) * 733);
      if (theme.key === 'magma') {
        for (let x = 0; x < W;) {
          const bw = 40 + rng() * 70, bh = 60 + rng() * 90;
          R(g, x, H - bh, bw, bh, '#241016');
          R(g, x, H - bh, bw, 2, '#3d1c22');
          for (let wy = H - bh + 8; wy < H - 10; wy += 12)
            for (let wx = x + 5; wx < x + bw - 6; wx += 10)
              if (rng() > 0.55) R(g, wx, wy, 3, 4, rng() > 0.3 ? '#f07820' : '#7e2a1c');
          x += bw + 12 + rng() * 30;
        }
      } else if (theme.key === 'cryo') {
        for (let x = 0; x < W;) {
          const bw = 90 + rng() * 120, bh = 50 + rng() * 70;
          // 빙하 능선
          for (let i = 0; i < bw; i += 4) {
            const hh = bh * (1 - Math.abs(i / bw - 0.5) * 1.7) + rng() * 6;
            if (hh > 0) { R(g, x + i, H - hh, 4, hh, '#16224a'); R(g, x + i, H - hh, 4, 2, '#2c4a86'); }
          }
          x += bw * 0.7;
        }
      } else if (theme.key === 'storm') {
        for (let x = 20; x < W;) {
          const bw = 50 + rng() * 60;
          const by = 120 + rng() * 80;
          // 부유섬
          R(g, x, by, bw, 14, '#1e1838'); R(g, x + 4, by + 14, bw - 8, 8, '#161028');
          R(g, x, by, bw, 3, '#332a58');
          R(g, x + bw / 2 - 4, by - 26, 8, 26, '#1e1838'); R(g, x + bw / 2 - 4, by - 26, 8, 2, '#332a58');
          x += bw + 40 + rng() * 60;
        }
      } else {
        for (let x = 0; x < W;) {
          const bw = 30 + rng() * 40, bh = 90 + rng() * 130;
          R(g, x, H - bh, bw, bh, '#0e0a20');
          for (let wy = H - bh + 6; wy < H - 6; wy += 8)
            if (rng() > 0.5) R(g, x + 4, wy, bw - 8, 1, NS.rgba('#38e0ff', 0.25));
          R(g, x, H - bh, bw, 1, '#2c2258');
          x += bw + 8 + rng() * 20;
        }
      }
    }
    // 중경 (parallax 0.35)
    bg.mid = NS.makeCanvas(W, H);
    {
      const g = bg.mid.getContext('2d');
      const rng = NS.makeRng(theme.key.charCodeAt(2) * 977);
      if (theme.key === 'magma') {
        for (let x = 0; x < W;) {
          const bw = 26 + rng() * 30, bh = 100 + rng() * 110;
          R(g, x, H - bh, bw, bh, '#38181e');
          R(g, x, H - bh, bw, 3, '#5c2c30'); R(g, x, H - bh, 3, bh, '#502428');
          // 굴뚝 + 배관 (건물 폭 안쪽으로만)
          R(g, x + bw / 2 - 3, H - bh - 18, 6, 18, '#2c1218');
          R(g, x + bw / 2 - 4, H - bh - 22, 8, 5, '#502428');
          for (let py = H - bh + 12; py < H - 20; py += 26) {
            R(g, x + 2, py, bw - 4, 4, '#241016');
            R(g, x + 2, py, bw - 4, 1, NS.rgba('#f07820', 0.55));
            R(g, x + 1, py, 2, 5, '#2c1218'); R(g, x + bw - 3, py, 2, 5, '#2c1218'); // 브래킷
          }
          x += bw + 30 + rng() * 40;
        }
      } else if (theme.key === 'cryo') {
        for (let x = 10; x < W;) {
          const bw = 54 + rng() * 40;
          const bh = 70 + rng() * 50;
          // 돔 연구동
          NS.orb(g, x + bw / 2, H - bh, bw / 2, '#1e3358', '#14224a', '#3a5c92');
          R(g, x, H - bh, bw, bh, '#1e3358');
          R(g, x, H - bh, bw, 2, '#3a5c92');
          for (let wy = H - bh + 10; wy < H - 8; wy += 14)
            for (let wx = x + 6; wx < x + bw - 8; wx += 12)
              if (rng() > 0.4) R(g, wx, wy, 4, 6, rng() > 0.35 ? '#38e0ff' : '#12254c');
          R(g, x + bw / 2 - 1, H - bh - bw / 2 - 16, 2, 16, '#3a5c92');
          R(g, x + bw / 2 - 1, H - bh - bw / 2 - 16, 2, 2, '#a8f6ff');
          x += bw + 36 + rng() * 40;
        }
      } else if (theme.key === 'storm') {
        for (let x = 0; x < W;) {
          // 공중정원 콜로네이드
          const bw = 120 + rng() * 60, by = 150 + rng() * 40;
          R(g, x, by, bw, 10, '#2c2450'); R(g, x, by, bw, 2, '#4a3c7e');
          for (let cx = x + 8; cx < x + bw - 8; cx += 22) {
            R(g, cx, by + 10, 6, 60, '#241e42'); R(g, cx, by + 10, 2, 60, '#3a2f66');
            R(g, cx - 2, by + 8, 10, 4, '#3a2f66');
          }
          // 풍력 터빈
          const tx = x + bw + 16;
          R(g, tx, by - 40, 4, 100, '#241e42');
          NS.orb(g, tx + 2, by - 42, 4, '#4a3c7e', '#2c2450', '#6a5a9e');
          x += bw + 70 + rng() * 50;
        }
      } else {
        for (let x = 0; x < W;) {
          const bw = 40 + rng() * 30, bh = 130 + rng() * 90;
          R(g, x, H - bh, bw, bh, '#171030');
          R(g, x, H - bh, bw, 2, '#3d2a68');
          for (let wy = H - bh + 8; wy < H; wy += 6) {
            if (rng() > 0.6) R(g, x + 3, wy, bw - 6, 2, NS.rgba('#e63e8f', 0.3));
            else if (rng() > 0.5) R(g, x + 3, wy, bw - 6, 1, NS.rgba('#38e0ff', 0.35));
          }
          // 수직 에너지 도관
          R(g, x + bw + 4, 0, 3, H, '#171030');
          R(g, x + bw + 5, 0, 1, H, NS.rgba('#38e0ff', 0.5));
          x += bw + 24 + rng() * 26;
        }
      }
    }
    // 근경 (parallax 0.6) — 실루엣 디테일
    bg.near = NS.makeCanvas(W, H);
    {
      const g = bg.near.getContext('2d');
      const rng = NS.makeRng(theme.key.charCodeAt(3) * 389);
      if (theme.key === 'magma') {
        for (let x = 0; x < W;) {
          // 거더/체인
          R(g, x, 0, 8, 140 + rng() * 60, '#1c0c12');
          R(g, x, 0, 2, 200, '#2c141a');
          for (let cy = 20; cy < 120; cy += 8) R(g, x + 14, cy, 2, 4, '#1c0c12');
          x += 90 + rng() * 100;
        }
        for (let x = 30; x < W; x += 170) {
          R(g, x, 188, 120, 9, '#160a0e');
          R(g, x, 188, 120, 2, '#2c141a');
          R(g, x + 4, 190, 112, 1, NS.rgba('#f07820', 0.35));
          for (let bx = x; bx < x + 120; bx += 24) R(g, bx, 195, 3, 6, '#160a0e'); // 서포트
        }
      } else if (theme.key === 'cryo') {
        for (let x = 0; x < W;) {
          const ph = 60 + rng() * 100;
          // 얼음 기둥
          for (let i = 0; i < 14; i += 3) {
            R(g, x + i, H - ph + i * 2, 3, ph - i * 2, i < 6 ? '#1b2c5c' : '#24407a');
          }
          R(g, x + 2, H - ph + 2, 2, ph * 0.6, NS.rgba('#a8f6ff', 0.3));
          x += 110 + rng() * 120;
        }
      } else if (theme.key === 'storm') {
        // 케이블 + 깃발
        for (let x = 0; x < W; x += 240) {
          for (let i = 0; i < W / 4; i += 4) {
            const sag = Math.sin(i / (W / 4) * Math.PI) * 30;
            R(g, x + i, 40 + sag, 3, 2, '#191434');
          }
        }
        for (let x = 40; x < W;) {
          R(g, x, 90 + rng() * 60, 3, 120, '#191434');
          R(g, x + 3, 92 + rng() * 30, 16, 10, '#2c2154');
          x += 150 + rng() * 130;
        }
      } else {
        for (let x = 0; x < W;) {
          // 헥사 패널 클러스터
          const bx = x, by = 60 + rng() * 140;
          for (let i = 0; i < 4; i++) {
            const hx = bx + (i % 2) * 14, hy = by + Math.floor(i / 2) * 12;
            R(g, hx, hy, 12, 10, '#120c26');
            R(g, hx, hy, 12, 1, NS.rgba('#e63e8f', 0.5));
            R(g, hx, hy + 9, 12, 1, NS.rgba('#0a0616', 0.8));
          }
          x += 130 + rng() * 110;
        }
      }
    }
    return bg;
  }

  // ── 타일 타입 ──────────────────────────────────────────
  const SOLID = new Set(['#', '%', '<', '>', 'I', 'B']);
  NS.TileType = { SOLID, ONEWAY: '=', SPIKE: '^', SPIKE_D: 'v', LAVA: '~', LAVA_IN: '-', CRUMBLE: 'c' };

  // ── 레벨 상태 ──────────────────────────────────────────
  const Level = {
    grid: null, w: 0, h: 0, pxW: 0, pxH: 0,
    theme: null, tiles: null, bg: null, vignette: null,
    camX: 0, camY: 0, camBounds: null, frame: 0,
    ambientTimer: 0, lightning: 0, lavaRise: null,
    crumbles: [],  // {tx,ty,timer,respawn}

    load(theme, rows) {
      this.theme = theme;
      this.tiles = bakeTileset(theme);
      this.bg = bakeBackground(theme);
      if (!this.vignette) this.vignette = NS.makeVignette(NS.VW, NS.VH, 0.55);
      this.grid = rows.map(r => r.split(''));
      this.h = this.grid.length;
      this.w = this.grid[0].length;
      this.pxW = this.w * T; this.pxH = this.h * T;
      this.camX = 0; this.camY = 0;
      this.camBounds = null;
      this.frame = 0; this.lightning = 0; this.lavaRise = null;
      this.crumbles = [];
    },

    at(tx, ty) {
      if (tx < 0 || tx >= this.w) return '#';
      if (ty < 0) return '.';
      if (ty >= this.h) return '.';
      return this.grid[ty][tx];
    },
    set(tx, ty, ch) {
      if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return;
      this.grid[ty][tx] = ch;
    },
    solidAt(px, py) {
      const ch = this.at(Math.floor(px / T), Math.floor(py / T));
      return SOLID.has(ch);
    },
    charAt(px, py) { return this.at(Math.floor(px / T), Math.floor(py / T)); },

    // 사각형과 겹치는 위험 타일 검사 → 'spike' | 'lava' | null
    hazardIn(x, y, w, h) {
      const x0 = Math.floor(x / T), x1 = Math.floor((x + w - 1) / T);
      const y0 = Math.floor(y / T), y1 = Math.floor((y + h - 1) / T);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        const ch = this.at(tx, ty);
        if (ch === '^' || ch === 'v') {
          // 가시는 히트박스 축소 (타일 중앙 8px 대역)
          const sx = tx * T + 2, sw = T - 4;
          const sy = ch === '^' ? ty * T + 5 : ty * T, sh = 11;
          if (NS.aabb(x, y, w, h, sx, sy, sw, sh)) return 'spike';
        } else if (ch === '~' || ch === '-') {
          if (NS.aabb(x, y, w, h, tx * T, ty * T + 4, T, T - 4)) return 'lava';
        }
      }
      // 상승 용암선
      if (this.lavaRise && y + h > this.lavaRise.y) return 'lava';
      return null;
    },

    conveyorAt(px, py) {
      const ch = this.charAt(px, py);
      return ch === '<' ? -0.7 : ch === '>' ? 0.7 : 0;
    },
    iceAt(px, py) { return this.charAt(px, py) === 'I'; },

    breakTile(tx, ty) {
      if (this.at(tx, ty) === 'B') {
        this.set(tx, ty, '.');
        NS.FX.burst(tx * T + 8, ty * T + 8, 8, { color: [this.theme.block.base, this.theme.block.lite], g: 0.2, spMax: 2.5 });
        NS.Audio.sfx('explode');
        return true;
      }
      return false;
    },

    // 붕괴 발판: 밟으면 타이머 후 소멸 → 수 초 후 재생
    touchCrumble(tx, ty) {
      const ch = this.at(tx, ty);
      if (ch !== 'c') return;
      if (this.crumbles.some(c => c.tx === tx && c.ty === ty)) return;
      this.crumbles.push({ tx, ty, timer: 24, respawn: 0 });
    },
    updateCrumbles() {
      for (const c of this.crumbles) {
        if (c.timer > 0) {
          c.timer--;
          if (!(c.timer > 0)) {
            this.set(c.tx, c.ty, '!');   // '!' = 소멸 상태 마커
            c.respawn = 210;
            NS.FX.burst(c.tx * T + 8, c.ty * T + 8, 6, { color: [this.theme.block.lite], g: 0.25 });
          }
        } else if (c.respawn > 0) {
          c.respawn--;
          if (!(c.respawn > 0)) this.set(c.tx, c.ty, 'c');
        }
      }
      this.crumbles = this.crumbles.filter(c => c.timer > 0 || c.respawn > 0);
    },

    // ── 카메라 ──
    updateCamera(target, instant) {
      const b = this.camBounds || { x0: 0, y0: 0, x1: this.pxW, y1: this.pxH };
      let tx = target.x + target.w / 2 - NS.VW / 2 + (target.facing || 0) * 24;
      let ty = target.y + target.h / 2 - NS.VH / 2 - 12;
      tx = NS.clamp(tx, b.x0, Math.max(b.x0, b.x1 - NS.VW));
      ty = NS.clamp(ty, b.y0, Math.max(b.y0, b.y1 - NS.VH));
      if (instant) { this.camX = tx; this.camY = ty; }
      else {
        this.camX += (tx - this.camX) * 0.12;
        this.camY += (ty - this.camY) * 0.16;
      }
    },

    // ── 렌더 ──
    draw(g) {
      const cx = this.camX, cy = this.camY;
      this.frame++;
      // 하늘 (고정)
      g.drawImage(this.bg.sky, 0, 0);
      // 패럴랙스 3층
      const layers = [[this.bg.far, 0.15], [this.bg.mid, 0.35], [this.bg.near, 0.6]];
      for (const [img, f] of layers) {
        const ox = -((cx * f) % img.width);
        const oy = NS.clamp(-(cy * f * 0.5), -40, 0);
        g.drawImage(img, Math.round(ox), Math.round(oy));
        g.drawImage(img, Math.round(ox + img.width), Math.round(oy));
      }
      // 번개 섬광 (폭풍)
      if (this.theme.key === 'storm') {
        if (this.lightning > 0) {
          g.fillStyle = NS.rgba('#e8e4ff', 0.14 * this.lightning);
          g.fillRect(0, 0, NS.VW, NS.VH);
          this.lightning--;
        } else if (NS.chance(0.003)) this.lightning = 5;
      }
      // 타일
      const x0 = Math.floor(cx / T), x1 = Math.ceil((cx + NS.VW) / T);
      const y0 = Math.floor(cy / T), y1 = Math.ceil((cy + NS.VH) / T);
      const ts = this.tiles;
      const animF = Math.floor(this.frame / 9) % 2;
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          const ch = this.at(tx, ty);
          if (ch === '.' || ch === '!') continue;
          const dx = tx * T - cx, dy = ty * T - cy;
          const v = (tx * 7 + ty * 13) % 3;
          if (ch === '#') {
            const above = this.at(tx, ty - 1);
            const img = (SOLID.has(above) || above === '~') ? ts.inner[v] : ts.top[v];
            g.drawImage(img, Math.round(dx), Math.round(dy));
          } else if (ch === '%') {
            g.drawImage(ts.inner[v], Math.round(dx), Math.round(dy));
          } else if (ch === '=') g.drawImage(ts.oneway, Math.round(dx), Math.round(dy));
          else if (ch === '^') g.drawImage(ts.spike, Math.round(dx), Math.round(dy));
          else if (ch === 'v') g.drawImage(ts.spikeDown, Math.round(dx), Math.round(dy));
          else if (ch === '<') g.drawImage(ts.convL[animF], Math.round(dx), Math.round(dy));
          else if (ch === '>') g.drawImage(ts.convR[animF], Math.round(dx), Math.round(dy));
          else if (ch === 'I') g.drawImage(ts.ice[(tx + ty) % 2], Math.round(dx), Math.round(dy));
          else if (ch === 'B') g.drawImage(ts.crack, Math.round(dx), Math.round(dy));
          else if (ch === '~') g.drawImage(ts.lava[animF], Math.round(dx), Math.round(dy));
          else if (ch === '-') g.drawImage(ts.lavaInner, Math.round(dx), Math.round(dy));
          else if (ch === 'c') g.drawImage(ts.crumble[0], Math.round(dx), Math.round(dy));
        }
      }
      // 소멸 중 발판 흔들림
      for (const c of this.crumbles) {
        if (c.timer > 0) {
          const dx = c.tx * T - cx + ((c.timer % 4) < 2 ? 1 : -1), dy = c.ty * T - cy;
          g.drawImage(ts.crumble[1], Math.round(dx), Math.round(dy));
        }
      }
      // 상승 용암선
      if (this.lavaRise) {
        const ly = this.lavaRise.y - cy;
        if (ly < NS.VH) {
          for (let tx2 = 0; tx2 < NS.VW + T; tx2 += T)
            g.drawImage(ts.lava[animF], Math.round(tx2 - (cx % T)), Math.round(ly));
          g.fillStyle = P.red1;
          g.fillRect(0, Math.round(ly + T), NS.VW, NS.VH - ly - T);
          g.fillStyle = NS.rgba('#f07820', 0.25);
          g.fillRect(0, Math.round(ly - 6), NS.VW, 6);
        }
      }
    },
    drawFront(g) {
      g.drawImage(this.vignette, 0, 0);
    },

    // 환경 파티클
    spawnAmbient() {
      const cx = this.camX, cy = this.camY;
      const amb = this.theme.ambient;
      if (amb === 'ember' && NS.chance(0.3)) {
        NS.FX.p({ x: cx + NS.rand(0, NS.VW), y: cy + NS.VH + 4, vx: NS.rand(-0.3, 0.3), vy: NS.rand(-0.9, -0.4), g: -0.002, life: 90, size: NS.randInt(1, 2), color: NS.pick([P.orange3, P.orange2, P.yellow]) });
      } else if (amb === 'snow' && NS.chance(0.5)) {
        NS.FX.p({ x: cx + NS.rand(0, NS.VW), y: cy - 4, vx: NS.rand(-0.5, 0.2), vy: NS.rand(0.4, 0.9), g: 0, life: 200, size: 1, color: NS.pick(['#e8fbff', '#a8d8f0', '#ffffff']) });
      } else if (amb === 'rain' && NS.chance(0.9)) {
        NS.FX.p({ x: cx + NS.rand(0, NS.VW + 60), y: cy - 4, vx: -2.2, vy: 5.5, g: 0, life: 60, size: 1, color: NS.rgba('#a8b8ff', 0.5) });
      } else if (amb === 'data' && NS.chance(0.12)) {
        NS.FX.p({ x: cx + NS.rand(0, NS.VW), y: cy + NS.rand(0, NS.VH), vx: 0, vy: NS.rand(-0.4, -0.2), g: 0, life: 70, size: 1, color: NS.pick([P.cyan2, P.magenta2]) });
      }
    },
  };
  NS.Level = Level;

  // ── 엔티티 공용 물리 (스윕 이동) ───────────────────────
  NS.Physics = {
    // ent: {x,y,w,h,vx,vy} — 충돌 플래그 반환
    move(ent) {
      const L = Level;
      const res = { left: false, right: false, up: false, down: false };
      // X
      let dx = ent.vx;
      const stepX = NS.sign(dx);
      while (Math.abs(dx) > 0.001) {
        const mv = Math.abs(dx) > 1 ? stepX : dx;
        const nx = ent.x + mv;
        const xEdge = stepX > 0 ? nx + ent.w : nx;
        let hit = false;
        for (let py = ent.y + 1; py < ent.y + ent.h; py += Math.min(T - 1, ent.h - 2)) {
          if (L.solidAt(xEdge, py)) { hit = true; break; }
        }
        if (!hit && L.solidAt(xEdge, ent.y + ent.h - 1)) hit = true;
        if (hit) {
          if (stepX > 0) res.right = true; else res.left = true;
          ent.x = stepX > 0 ? Math.floor((nx + ent.w) / T) * T - ent.w - 0.01 : Math.floor(nx / T + 1) * T + 0.01;
          break;
        }
        ent.x = nx;
        dx -= mv;
      }
      // Y
      let dy = ent.vy;
      const stepY = NS.sign(dy);
      while (Math.abs(dy) > 0.001) {
        const mv = Math.abs(dy) > 1 ? stepY : dy;
        const ny = ent.y + mv;
        const yEdge = stepY > 0 ? ny + ent.h : ny;
        let hit = false;
        for (let px = ent.x + 1; px < ent.x + ent.w; px += Math.min(T - 1, ent.w - 2)) {
          if (L.solidAt(px, yEdge)) { hit = true; break; }
        }
        if (!hit && L.solidAt(ent.x + ent.w - 1, yEdge)) hit = true;
        // 원웨이/붕괴 발판 (하강 시, 발 위치가 타일 상단 근처일 때만)
        if (!hit && stepY > 0) {
          for (let px = ent.x + 1; px < ent.x + ent.w; px += Math.min(T - 1, ent.w - 2)) {
            const ch = L.charAt(px, yEdge);
            if ((ch === '=' || ch === 'c') && (ent.y + ent.h) <= Math.floor(yEdge / T) * T + 3 && !ent.dropThrough) {
              hit = true;
              if (ch === 'c') L.touchCrumble(Math.floor(px / T), Math.floor(yEdge / T));
              break;
            }
          }
        }
        if (hit) {
          if (stepY > 0) res.down = true; else res.up = true;
          ent.y = stepY > 0 ? Math.floor(yEdge / T) * T - ent.h - 0.01 : Math.floor(ny / T + 1) * T + 0.01;
          break;
        }
        ent.y = ny;
        dy -= mv;
      }
      return res;
    },
  };
})();
