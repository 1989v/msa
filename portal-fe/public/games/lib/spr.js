/**
 * 게임 공용 도트 스프라이트 킷 — 개체의 최저 품질선을 도구로 강제한다.
 *
 * 캔버스 게임 36종을 훑어 보니 스프라이트를 굽는 건 5종뿐이고 31종은 매 프레임
 * `fillRect`/`arc` 로 개체를 직접 그린다. 그래서 적이 원이고 블록이 사각형으로 보인다 —
 * 효과(그라디언트·셰이크)를 아무리 얹어도 이 차이는 덮이지 않는다.
 *
 * 여기서 주는 건 **그리는 도구와 규칙**이다. 실제 도트는 게임마다 그려야 하지만,
 * 아래 네 가지는 공짜로 따라온다 — 이게 곧 마지노선이다.
 *   1) 오프스크린 1회 굽기 + 캐시 (매 프레임 도형 쌓기 금지)
 *   2) 명암 3단 팔레트 (단색 덩어리 금지)
 *   3) 접지 그림자 (공중에 뜬 개체 금지)
 *   4) 어두운 외곽선 (배경에 묻히는 실루엣 금지)
 *
 * 기준 문서: docs/conventions/game-art-baseline.md
 *
 * 사용:
 *   <script src="../lib/spr.js"></script>
 *   var heroSpr = Spr.make('hero' + dir + frame, 32, 32, function (g) {
 *     var p = Spr.pal('#3ea36b');            // {hi, mid, lo, deep}
 *     Spr.px(g, 9, 15, 14, 10, p.mid);
 *     Spr.px(g, 9, 15, 14, 3,  p.hi);        // 광원 쪽
 *     Spr.px(g, 9, 21, 14, 4,  p.lo);        // 그림자 쪽
 *     Spr.outline(g, 32, 32);                // 몸통을 다 그린 뒤
 *     Spr.ground(g, 32, 32);                 // 그림자는 마지막 — 알아서 밑으로 깔린다
 *   });
 *   Spr.draw(cx, heroSpr, x, y, { flip: facingLeft });
 *
 * 전역 오염은 window.Spr 하나, 외부 의존 없음.
 */
(function () {
  'use strict';

  var D = document;
  var cache = new Map();

  /* ────────── 색 ────────── */

  function parse(hex) {
    var s = String(hex).replace('#', '');
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    var n = parseInt(s, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : Math.round(v); }
  function hex2(v) { var s = clamp255(v).toString(16); return s.length < 2 ? '0' + s : s; }

  /**
   * 밝기 조절. amt > 0 이면 흰색 쪽, < 0 이면 검은색 쪽으로 섞는다.
   * 단순 곱셈은 어두운 색에서 색상이 죽어 회색이 되므로 혼합으로 처리한다.
   */
  function shade(hex, amt) {
    var c = parse(hex), t = amt > 0 ? 255 : 0, k = Math.abs(amt);
    return '#' + hex2(c.r + (t - c.r) * k) + hex2(c.g + (t - c.g) * k) + hex2(c.b + (t - c.b) * k);
  }

  /**
   * 기준색 하나에서 명암 3단을 만든다 — 게임마다 두 색을 손으로 고르지 않게.
   * hi 는 광원 쪽 하이라이트, lo 는 그림자.
   */
  function pal(base) {
    return { hi: shade(base, 0.28), mid: base, lo: shade(base, -0.3), deep: shade(base, -0.55) };
  }

  /* ────────── 그리기 도구 ────────── */

  /** 픽셀 사각형 — 도트 느낌을 유지하려고 정수로 스냅한다 */
  function px(g, x, y, w, h, col) {
    g.fillStyle = col;
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  /**
   * 접지 그림자. 개체가 바닥에 붙어 보이게 하는 가장 큰 단서라 기본으로 넣는다.
   * 스프라이트 하단 중앙에 타원으로 깔린다.
   *
   * **항상 기존 그림 아래로 들어간다**(destination-over). 그래서 outline() 뒤에 불러도
   * 캐릭터를 덮지 않고, outline 이 그림자 테두리까지 따라 그려 물웅덩이처럼 보이는 일도 없다.
   * 권장 순서: 몸통 → outline → ground.
   */
  function ground(g, w, h, opt) {
    var o = opt || {};
    var rx = o.rx || w * 0.3, ry = o.ry || Math.max(2, h * 0.07);
    var cy = o.y != null ? o.y : h - ry - 1;
    g.save();
    g.globalCompositeOperation = 'destination-over';
    g.fillStyle = 'rgba(0,0,0,' + (o.alpha != null ? o.alpha : 0.35) + ')';
    g.beginPath();
    g.ellipse(w / 2, cy, rx, ry, 0, 0, 6.2832);
    g.fill();
    g.restore();
  }

  /**
   * 이미 그려진 픽셀의 바깥 테두리에 1px 어두운 선을 두른다.
   * 알파 채널을 훑어 "비어 있고 이웃이 찬" 칸만 칠하므로 실루엣 모양을 그대로 딴다.
   * 배경이 복잡한 게임에서 개체가 묻히는 걸 막는다.
   */
  function outline(g, w, h, col) {
    var src = g.getImageData(0, 0, w, h), a = src.data;
    var out = g.createImageData(w, h), b = out.data;
    var c = parse(col || '#0b0f18');
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4;
        if (a[i + 3] > 8) continue;                    // 이미 찬 칸은 건너뛴다
        var near = (x > 0 && a[i - 4 + 3] > 8) || (x < w - 1 && a[i + 4 + 3] > 8) ||
                   (y > 0 && a[i - w * 4 + 3] > 8) || (y < h - 1 && a[i + w * 4 + 3] > 8);
        if (!near) continue;
        b[i] = c.r; b[i + 1] = c.g; b[i + 2] = c.b; b[i + 3] = 235;
      }
    }
    // putImageData 는 합성을 무시하고 통째로 덮어쓰므로, 원본을 테두리 위에 직접 얹어
    // 한 장으로 만든 뒤 넣는다 (테두리가 도트를 먹지 않게).
    for (var j = 0; j < a.length; j += 4) {
      if (a[j + 3] > 8) { b[j] = a[j]; b[j + 1] = a[j + 1]; b[j + 2] = a[j + 2]; b[j + 3] = a[j + 3]; }
    }
    g.putImageData(out, 0, 0);
  }

  /* ────────── 캐시 ────────── */

  /**
   * 스프라이트를 한 번만 굽고 캐시한다. key 가 같으면 paint 는 다시 돌지 않는다.
   * 방향·프레임·색 변형은 key 에 녹여서 부른다 ('hero' + dir + frame).
   */
  function make(key, w, h, paint) {
    var c = cache.get(key);
    if (c) return c;
    c = D.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    paint(g, w, h);
    cache.set(key, c);
    return c;
  }

  /** 팔레트·테마가 바뀌어 다시 구워야 할 때 */
  function clear(prefix) {
    if (!prefix) { cache.clear(); return; }
    cache.forEach(function (v, k) { if (k.indexOf(prefix) === 0) cache.delete(k); });
  }

  /**
   * 중심 기준으로 그린다 — 게임은 개체 좌표를 중심으로 들고 있으므로
   * 좌상단 계산(-w/2)을 매번 손으로 쓰지 않게 한다.
   * opt: { flip, scale, scaleY, alpha, rot, anchorY }
   *   anchorY 0=중심(기본) 1=발밑
   *   scaleY  세로만 눌러 숨쉬기·착지 반동을 준다 — 캐시를 나누지 않고 표현하려고 둔다
   */
  function draw(cx, spr, x, y, opt) {
    if (!spr) return;
    var o = opt || {};
    var s = o.scale || 1;
    var w = spr.width * s, h = spr.height * s * (o.scaleY || 1);
    var oy = o.anchorY ? h * (0.5 - o.anchorY) : 0;
    cx.save();
    if (o.alpha != null) cx.globalAlpha *= o.alpha;
    cx.imageSmoothingEnabled = false;
    cx.translate(Math.round(x), Math.round(y + oy));
    if (o.rot) cx.rotate(o.rot);
    if (o.flip) cx.scale(-1, 1);
    cx.drawImage(spr, -w / 2, -h / 2, w, h);
    cx.restore();
  }

  window.Spr = {
    make: make, clear: clear, draw: draw,
    px: px, pal: pal, shade: shade, ground: ground, outline: outline,
  };
})();
