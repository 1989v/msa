/**
 * 0x72 DungeonTilesetII v1.4 아틀라스 로더 (CC-0 — assets/CREDITS.md).
 *
 * 좌표 원본(tiles_list)을 그대로 내장한다 — 손으로 옮겨 적다 한 칸 틀리는 사고를 막고,
 * 원본과의 대조가 diff 한 번으로 끝난다. 형식: `이름 x y w h [프레임수]`, 프레임은 가로 연속.
 *
 * 전역: window.Atlas — load(cb) / draw(g, name, frame, x, y, opt)
 * draw 의 기준점은 **발밑 중앙**(x=중앙, y=바닥) — 탑다운에서 개체 좌표는 발 위치가 자연스럽다.
 */
(function () {
  'use strict';

  var LIST = [
    'wall_top_left 16 0 16 16', 'wall_top_mid 32 0 16 16', 'wall_top_right 48 0 16 16',
    'wall_left 16 16 16 16', 'wall_mid 32 16 16 16', 'wall_right 48 16 16 16',
    'wall_fountain_top 64 0 16 16',
    'wall_fountain_mid_red_anim 64 16 16 16 3', 'wall_fountain_basin_red_anim 64 32 16 16 3',
    'wall_fountain_mid_blue_anim 64 48 16 16 3', 'wall_fountain_basin_blue_anim 64 64 16 16 3',
    'wall_hole_1 48 32 16 16', 'wall_hole_2 48 48 16 16',
    'wall_banner_red 16 32 16 16', 'wall_banner_blue 32 32 16 16',
    'wall_banner_green 16 48 16 16', 'wall_banner_yellow 32 48 16 16',
    'column_top 80 80 16 16', 'column_mid 80 96 16 16', 'coulmn_base 80 112 16 16',
    'wall_column_top 96 80 16 16', 'wall_column_mid 96 96 16 16', 'wall_coulmn_base 96 112 16 16',
    'floor_1 16 64 16 16', 'floor_2 32 64 16 16', 'floor_3 48 64 16 16', 'floor_4 16 80 16 16',
    'floor_5 32 80 16 16', 'floor_6 48 80 16 16', 'floor_7 16 96 16 16', 'floor_8 32 96 16 16',
    'floor_ladder 48 96 16 16',
    'floor_spikes_anim 16 176 16 16 4',
    'doors_leaf_closed 32 224 32 32', 'doors_leaf_open 80 224 32 32',
    'doors_frame_left 16 224 16 32', 'doors_frame_top 32 221 32 3',
    'chest_empty_open_anim 304 288 16 16 3', 'chest_full_open_anim 304 304 16 16 3',
    'flask_big_red 288 224 16 16', 'flask_big_blue 288 240 16 16',
    'flask_red 320 224 16 16', 'flask_blue 320 240 16 16',
    'skull 288 320 16 16', 'crate 288 298 16 22',
    'coin_anim 288 272 8 8 4',
    'weapon_regular_sword 323 26 10 21', 'weapon_knife 293 18 6 13',
    'weapon_anime_sword 322 81 12 30', 'weapon_big_hammer 291 42 10 37',
    'tiny_zombie_idle_anim 368 16 16 16 4', 'tiny_zombie_run_anim 432 16 16 16 4',
    'imp_idle_anim 368 48 16 16 4', 'imp_run_anim 432 48 16 16 4',
    'skelet_idle_anim 368 80 16 16 4', 'skelet_run_anim 432 80 16 16 4',
    'masked_orc_idle_anim 368 172 16 20 4', 'masked_orc_run_anim 432 172 16 20 4',
    'necromancer_idle_anim 368 268 16 20 4', 'necromancer_run_anim 368 268 16 20 4',
    'wogol_idle_anim 368 300 16 20 4', 'wogol_run_anim 432 300 16 20 4',
    'chort_idle_anim 368 328 16 24 4', 'chort_run_anim 432 328 16 24 4',
    'ogre_idle_anim 16 320 32 32 4', 'ogre_run_anim 144 320 32 32 4',
    'big_zombie_idle_anim 16 270 32 34 4', 'big_zombie_run_anim 144 270 32 34 4',
    'big_demon_idle_anim 16 364 32 36 4', 'big_demon_run_anim 144 364 32 36 4',
    'knight_m_idle_anim 128 100 16 28 4', 'knight_m_run_anim 192 100 16 28 4',
    'knight_m_hit_anim 256 100 16 28 1',
  ];

  var frames = {};
  LIST.forEach(function (line) {
    var p = line.trim().split(/\s+/);
    frames[p[0]] = { x: +p[1], y: +p[2], w: +p[3], h: +p[4], n: p[5] ? +p[5] : 1 };
  });

  var img = null;

  function load(cb) {
    img = new Image();
    img.onload = function () { cb && cb(null); };
    img.onerror = function () { cb && cb(new Error('tileset load fail')); };
    img.src = 'assets/tileset.png';
  }

  /**
   * opt: { flip, scale, alpha, tint }
   * tint: 'elite' 같은 색 덮기 — 틴트된 변형은 오프스크린에 구워 캐시한다(매 프레임 합성 금지).
   */
  var tintCache = {};
  function tinted(f, frame, color) {
    var key = f.x + ',' + f.y + ',' + frame + ',' + color;
    var c = tintCache[key];
    if (c) return c;
    c = document.createElement('canvas');
    c.width = f.w; c.height = f.h;
    var g = c.getContext('2d');
    g.drawImage(img, f.x + frame * f.w, f.y, f.w, f.h, 0, 0, f.w, f.h);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = color;
    g.fillRect(0, 0, f.w, f.h);
    tintCache[key] = c;
    return c;
  }

  function draw(g, name, frame, x, y, opt) {
    var f = frames[name];
    if (!f || !img) return;
    var o = opt || {};
    var fr = f.n > 1 ? ((frame | 0) % f.n) : 0;
    var s = o.scale || 1;
    var w = f.w * s, h = f.h * s;
    g.save();
    if (o.alpha != null) g.globalAlpha *= o.alpha;
    g.translate(Math.round(x), Math.round(y));
    if (o.flip) g.scale(-1, 1);
    if (o.tint) {
      g.drawImage(tinted(f, fr, o.tint), -w / 2, -h, w, h);
    } else {
      g.drawImage(img, f.x + fr * f.w, f.y, f.w, f.h, -w / 2, -h, w, h);
    }
    g.restore();
  }

  window.Atlas = { load: load, draw: draw, frames: frames };
})();
