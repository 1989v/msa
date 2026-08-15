// NOVA STRIKE — core: 네임스페이스, 상수, 수학 유틸
'use strict';
window.NS = window.NS || {};

NS.VW = 960;            // 내부 해상도 — 넓은 시야 + 낮은 업스케일 배율(도트 뭉침 완화)
NS.VH = 540;
NS.TILE = 16;
NS.FPS = 60;
NS.DT = 1 / 60;

NS.clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
NS.lerp = (a, b, t) => a + (b - a) * t;
NS.sign = v => v < 0 ? -1 : (v > 0 ? 1 : 0);
NS.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
NS.angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);

// 결정적 난수 (아트 베이크 재현성) + 일반 난수
NS.makeRng = (seed) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
};
NS.rand = (a, b) => a + Math.random() * (b - a);
NS.randInt = (a, b) => Math.floor(NS.rand(a, b + 1));
NS.pick = arr => arr[Math.floor(Math.random() * arr.length)];
NS.chance = p => Math.random() < p;

// AABB 겹침 (x,y = 좌상단)
NS.aabb = (ax, ay, aw, ah, bx, by, bw, bh) =>
  ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

// 이징
NS.easeOut = t => 1 - (1 - t) * (1 - t);
NS.easeIn = t => t * t;
NS.easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

// 타이머 규약: 항상 0 으로 초기화, 만료 판정은 부정형 !(x > 0)
NS.tick = (v) => (v > 0 ? v - 1 : 0);
