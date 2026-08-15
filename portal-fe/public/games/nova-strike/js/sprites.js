// NOVA STRIKE — sprites: 리그 베이크 (플레이어블 2인/발사체/아이템/폭발)
// 전 스프라이트가 outlinePass(외곽선+림라이트)를 통과해 아트 문법이 통일된다.
// 캐릭터: 더스크(서부 총잡이, 원거리) · 레이븐(검객, 근접 콤보) — 스페이스 웨스턴 현상금 사냥꾼 듀오
'use strict';
(function () {
  const P = NS.PAL;
  const S = {};
  NS.Sprites = S;

  // 더스크 — 건슬링거 팔레트 (더스터 코트 + 챙 넓은 모자 + 리볼버)
  const DP = {
    coat: '#a8734a', coatD: '#7a4a2c', coatL: '#d8a878',
    hat: '#6a4226', hatD: '#46281a', hatL: '#8a5c38',
    shirt: '#e8dcc0', shirtD: '#c0aa88',
    band: '#e04545', bandD: '#8c2432',
    skin: '#f0c8a0', skinD: '#c89468',
    pants: '#3d3450', pantsD: '#282238', pantsL: '#5a5070',
    boot: '#4a3020', bootD: '#301c12', bootL: '#6a4a30',
    gun: '#3c4265', gunD: '#23263f', gunL: '#8b96bd',
    rim: '#ffe2b0',
  };
  // 레이븐 — 검객 팔레트 (다크 인디고 코트 + 헤드밴드 + 강철 세이버)
  const RP = {
    coat: '#4e4e88', coatD: '#32325a', coatL: '#8484c4',
    inner: '#e8e4d8', innerD: '#beb9a8',
    hair: '#3a4460', hairD: '#242c42', hairL: '#5c6a90', streak: '#e8ecf8',
    band: '#f07820', bandD: '#8a3c12',
    skin: '#f0c8a0', skinD: '#c89468',
    pants: '#3e3e60', pantsD: '#282844', pantsL: '#5a5a88',
    boot: '#23263f', bootD: '#14141f', bootL: '#3c4265',
    blade: '#c3cbe8', bladeL: '#ffffff', bladeD: '#8b96bd', hilt: '#7a4a2c',
    rim: '#c8d8ff',
  };

  const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

  // ── 공용 리그 (스켈레톤 공유, 드로잉만 캐릭터별) ──────
  // 캔버스 64×64, 오른쪽 바라봄, 발끝 y≈58, 중심 x=32

  function drawBlade(g, x0, y0, x1, y1) {
    NS.limb(g, x0, y0, x1, y1, 3, RP.blade, RP.bladeD, RP.bladeL);
    // 칼끝 하이라이트
    R(g, x1 - 1, y1 - 1, 2, 2, RP.bladeL);
    // 츠바(가드) + 자루
    const a = Math.atan2(y1 - y0, x1 - x0);
    R(g, x0 - Math.cos(a) * 2 - 2, y0 - Math.sin(a) * 2 - 2, 4, 4, RP.hilt);
    R(g, x0 - Math.cos(a) * 4 - 1, y0 - Math.sin(a) * 4 - 1, 3, 3, '#4a3020');
  }

  function drawLeg(C, g, L, front) {
    const th = front ? 6 : 5, sh = front ? 5 : 4;
    const m = front ? C.pants : C.pantsD, d = C.pantsD, l = front ? C.pantsL : C.pants;
    NS.limb(g, L.hx, L.hy, L.kx, L.ky, th, m, d, front ? l : null);
    NS.limb(g, L.kx, L.ky, L.fx, L.fy - 3, sh, m, d, null);
    // 부츠
    const bx = L.fx - 4, by = L.fy - 6;
    R(g, bx, by, 10, 5, C.boot); R(g, bx, by + 4, 10, 2, C.bootD);
    R(g, bx, by, 9, 1, C.bootL);
    R(g, bx + 7, by + 2, 4, 3, C.boot); R(g, bx + 8, by + 4, 3, 2, C.bootD);
    R(g, bx - 1, by + 5, 12, 1, C.bootD);
    if (C === DP) { R(g, bx - 2, by + 2, 2, 2, C.gunL); }        // 박차(스퍼)
    else { R(g, bx + 1, by - 1, 6, 2, C.coatD); }                // 각반
  }

  function drawArmDusk(g, A, front) {
    const m = front ? DP.coat : DP.coatD, d = DP.coatD, l = front ? DP.coatL : DP.coat;
    NS.limb(g, A.sx, A.sy, A.ex, A.ey, 5, m, d, front ? l : null);   // 코트 소매
    if (A.buster) {
      // 리볼버 발사 자세
      NS.limb(g, A.ex, A.ey, A.hx - 2, A.hy, 4, m, d, null);
      R(g, A.hx - 3, A.hy - 2, 4, 4, DP.skin);                        // 손
      R(g, A.hx - 1, A.hy - 3, 10, 3, DP.gun);                        // 총열
      R(g, A.hx - 1, A.hy - 3, 9, 1, DP.gunL);
      R(g, A.hx + 1, A.hy - 1, 4, 3, DP.gunD);                        // 실린더
      R(g, A.hx + 2, A.hy, 2, 1, DP.gunL);
      R(g, A.hx - 3, A.hy + 1, 3, 4, '#7a4a2c');                      // 그립
      R(g, A.hx + 9, A.hy - 3, 1, 2, DP.gunL);                        // 총구
    } else {
      NS.limb(g, A.ex, A.ey, A.hx, A.hy, 5, m, d, l);
      R(g, A.hx - 1, A.hy - 1, 4, 4, DP.skin);
      R(g, A.hx - 1, A.hy + 2, 4, 1, DP.skinD);
    }
    // 어깨 케이프 주름
    R(g, A.sx - 4, A.sy - 3, 8, 5, m); R(g, A.sx - 4, A.sy - 3, 7, 1, l);
    R(g, A.sx - 4, A.sy + 1, 8, 1, d);
  }

  function drawArmRaven(g, A, front) {
    const m = front ? RP.coat : RP.coatD, d = RP.coatD, l = front ? RP.coatL : RP.coat;
    NS.limb(g, A.sx, A.sy, A.ex, A.ey, 5, m, d, front ? l : null);
    NS.limb(g, A.ex, A.ey, A.hx, A.hy, 4, m, d, null);
    R(g, A.hx - 1, A.hy - 1, 4, 4, RP.skin);                          // 손
    R(g, A.hx - 1, A.hy + 2, 4, 1, RP.skinD);
    // 팔뚝 밴드
    R(g, A.ex - 2, A.ey - 1, 5, 2, RP.band);
    // 어깨
    R(g, A.sx - 4, A.sy - 3, 8, 5, m); R(g, A.sx - 4, A.sy - 3, 7, 1, l);
  }

  function drawTorsoDusk(g, T) {
    const x = T.x, y = T.y;
    // 골반 + 벨트
    R(g, x - 5, y + 12, 10, 3, '#4a3020'); R(g, x - 1, y + 12, 3, 3, '#ffc44d');  // 버클
    R(g, x - 5, y + 15, 10, 3, DP.pants);
    // 홀스터
    R(g, x + 4, y + 14, 4, 6, DP.hatD); R(g, x + 5, y + 15, 2, 2, DP.gunL);
    // 셔츠 + 베스트
    R(g, x - 5, y + 2, 10, 10, DP.shirt); R(g, x - 5, y + 9, 10, 3, DP.shirtD);
    // 더스터 코트 (앞이 열린 실루엣 + 뒷자락)
    R(g, x - 8, y, 4, 16, DP.coat); R(g, x - 8, y + 13, 4, 3, DP.coatD); R(g, x - 8, y, 3, 1, DP.coatL);
    R(g, x + 4, y, 4, 14, DP.coat); R(g, x + 4, y + 11, 4, 3, DP.coatD);
    const fl = T.flut || 0;
    R(g, x - 10 - fl, y + 8, 3 + Math.abs(fl), 10, DP.coatD);          // 휘날리는 뒷자락 (플러터)
    if (fl) R(g, x - 11 - fl, y + 15, 2, 3, DP.coatD);
    // 탄띠 (사선)
    for (let i = 0; i < 4; i++) R(g, x - 4 + i * 3, y + 3 + i * 2, 2, 2, '#8a5c38');
    for (let i = 0; i < 3; i++) R(g, x - 3 + i * 3, y + 4 + i * 2, 1, 1, '#ffc44d');
    // 반다나 매듭 (목)
    R(g, x - 3, y - 1, 8, 3, DP.band); R(g, x - 3, y + 1, 8, 1, DP.bandD);
    R(g, x + 3, y + 2, 3, 4, DP.band); R(g, x + 4, y + 5, 2, 2, DP.bandD);
  }

  function drawTorsoRaven(g, T) {
    const x = T.x, y = T.y;
    R(g, x - 5, y + 12, 10, 3, '#4a3020'); R(g, x - 1, y + 12, 2, 2, RP.band);   // 벨트
    R(g, x - 5, y + 15, 10, 3, RP.pants);
    // 칼집 (허리 뒤)
    NS.limb(g, x - 2, y + 13, x - 15, y + 19, 3, '#5c6690', '#3c4265', '#8b96bd');
    R(g, x - 1, y + 12, 3, 3, '#7a4a2c');   // 자루
    // 닫힌 코트 + 흰 안깃 V
    R(g, x - 7, y, 14, 13, RP.coat);
    R(g, x - 7, y + 10, 14, 3, RP.coatD);
    R(g, x - 7, y, 13, 1, RP.coatL);
    R(g, x - 2, y, 4, 6, RP.inner); R(g, x - 1, y + 4, 2, 2, RP.innerD);          // V 깃
    R(g, x - 7, y + 4, 14, 1, RP.coatD);                                          // 가슴 스트랩
    R(g, x + 2, y + 3, 2, 2, RP.band);                                            // 스트랩 버클
  }

  function drawHeadDusk(g, H) {
    const x = H.x, y = H.y;
    // 목
    R(g, x - 2, y + 6, 5, 5, DP.skin);
    // 얼굴
    R(g, x - 4, y - 2, 9, 9, DP.skin);
    R(g, x - 4, y + 4, 9, 3, DP.skinD);
    // 눈 (진지한 눈매 / 깜빡임)
    if (H.blink) {
      R(g, x + 1, y + 2, 3, 1, DP.skinD); R(g, x - 3, y + 2, 2, 1, DP.skinD);
    } else {
      R(g, x + 1, y + 1, 3, 2, P.white); R(g, x + 3, y + 1, 1, 2, P.ink);
      R(g, x - 3, y + 1, 2, 2, P.white); R(g, x - 2, y + 1, 1, 2, P.ink);
    }
    R(g, x + 1, y, 3, 1, DP.skinD); R(g, x - 3, y, 2, 1, DP.skinD);   // 눈썹 그늘
    // 입 + 수염 자국
    R(g, x - 1, y + 5, 3, 1, '#a8653f');
    // 챙 넓은 모자 — 실루엣의 핵심
    R(g, x - 10, y - 4, 21, 3, DP.hat);                                // 챙
    R(g, x - 10, y - 2, 21, 1, DP.hatD);
    R(g, x - 10, y - 4, 20, 1, DP.hatL);
    R(g, x - 6, y - 9, 13, 6, DP.hat);                                 // 크라운
    R(g, x - 6, y - 9, 12, 1, DP.hatL);
    R(g, x - 6, y - 5, 13, 2, DP.hatD);
    R(g, x - 6, y - 5, 13, 1, DP.band);                                // 모자 밴드
  }

  function drawHeadRaven(g, H) {
    const x = H.x, y = H.y;
    R(g, x - 2, y + 6, 5, 5, RP.skin);                                 // 목
    // 얼굴
    R(g, x - 4, y - 2, 9, 9, RP.skin);
    R(g, x - 4, y + 4, 9, 3, RP.skinD);
    // 눈 (날카로운 / 깜빡임)
    if (H.blink) {
      R(g, x + 1, y + 2, 3, 1, RP.skinD); R(g, x - 3, y + 2, 2, 1, RP.skinD);
    } else {
      R(g, x + 1, y + 1, 3, 2, P.white); R(g, x + 3, y + 1, 1, 2, P.ink);
      R(g, x - 3, y + 1, 2, 2, P.white); R(g, x - 2, y + 1, 1, 2, P.ink);
    }
    R(g, x - 1, y + 5, 3, 1, '#a8653f');
    // 흑청 단발 (스파이키) + 백발 스트릭
    R(g, x - 6, y - 7, 13, 6, RP.hair);
    R(g, x - 6, y - 7, 12, 2, RP.hairL);
    R(g, x - 6, y - 2, 3, 4, RP.hair);                                 // 옆머리
    R(g, x + 5, y - 3, 2, 3, RP.hair);
    for (let i = 0; i < 4; i++) R(g, x - 5 + i * 3, y - 9, 2, 3, i % 2 ? RP.hair : RP.hairD);  // 삐침
    R(g, x + 1, y - 8, 2, 4, RP.streak);                               // 백발 스트릭
    // 헤드밴드 (오렌지) + 뒤로 흘린 끈
    R(g, x - 5, y - 3, 11, 2, RP.band); R(g, x - 5, y - 2, 11, 1, RP.bandD);
    NS.limb(g, x - 5, y - 2, x - 11, y + 2, 2, RP.band, RP.bandD, null);
  }

  const CHARS = {
    dusk: { pal: DP, arm: drawArmDusk, torso: drawTorsoDusk, head: drawHeadDusk, rim: DP.rim },
    raven: { pal: RP, arm: drawArmRaven, torso: drawTorsoRaven, head: drawHeadRaven, rim: RP.rim },
  };

  function bakeHero(charKey, pose) {
    const C = CHARS[charKey];
    return NS.bake(64, 64, (g) => {
      if (pose.pre) pose.pre(g);
      if (pose.armB) C.arm(g, pose.armB, false);
      if (pose.legB) drawLeg(C.pal, g, pose.legB, false);
      C.torso(g, pose.torso);
      C.head(g, pose.head);
      if (pose.legF) drawLeg(C.pal, g, pose.legF, true);
      if (pose.armF) C.arm(g, pose.armF, true);
      if (pose.blade) drawBlade(g, pose.blade.x0, pose.blade.y0, pose.blade.x1, pose.blade.y1);
      if (pose.post) pose.post(g);
    }, { rim: C.rim, rimAlpha: 0.5 });
  }

  // 걷기/달리기 다리 사이클
  function runLeg(phase, hipX, hipY, groundY) {
    const t = phase * Math.PI * 2;
    const fx = hipX + Math.cos(t) * 8;
    const lift = Math.max(0, Math.sin(t)) * 6;
    const fy = groundY - lift;
    const mx = (hipX + fx) / 2 + Math.cos(t + Math.PI / 2) * 2 + 2;
    const my = (hipY + fy) / 2 - 1;
    return { hx: hipX, hy: hipY, kx: mx, ky: my, fx, fy };
  }

  function heroPoses(charKey) {
    const GY = 58, CX = 32;
    const isRaven = charKey === 'raven';
    const mk = (torsoY, headY) => ({
      torso: { x: CX, y: torsoY },
      head: { x: CX, y: headY },
    });

    const frames = {};
    frames.idle = [0, 1, 2, 3].map(i => {
      const bob = [0, 1, 1, 0][i];
      const p = mk(26 + bob, 14 + bob);
      if (i === 3) p.head.blink = true;
      p.legB = { hx: CX - 3, hy: 44, kx: CX - 5, ky: 51, fx: CX - 6, fy: GY };
      p.legF = { hx: CX + 3, hy: 44, kx: CX + 5, ky: 51, fx: CX + 6, fy: GY };
      p.armB = { sx: CX - 8, sy: 28 + bob, ex: CX - 10, ey: 36 + bob, hx: CX - 9, hy: 42 + bob };
      p.armF = { sx: CX + 8, sy: 28 + bob, ex: CX + 10, ey: 36 + bob, hx: CX + 9, hy: 42 + bob };
      return bakeHero(charKey, p);
    });
    frames.idleShoot = [0, 1].map(rec => {
      const p = mk(26, 14);
      p.legB = { hx: CX - 3, hy: 44, kx: CX - 5, ky: 51, fx: CX - 6, fy: GY };
      p.legF = { hx: CX + 3, hy: 44, kx: CX + 5, ky: 51, fx: CX + 6, fy: GY };
      p.armB = { sx: CX - 8, sy: 28, ex: CX - 10, ey: 36, hx: CX - 9, hy: 42 };
      p.armF = rec === 0
        ? { sx: CX + 8, sy: 28, ex: CX + 12, ey: 28, hx: CX + 17, hy: 28, buster: true }   // 반동 (총구 들림)
        : { sx: CX + 8, sy: 28, ex: CX + 13, ey: 30, hx: CX + 19, hy: 31, buster: true };
      if (rec === 0) p.torso.flut = -2;
      return bakeHero(charKey, p);
    });
    const RUN_N = 12;
    const mkRun = (i, shoot) => {
      const ph = i / RUN_N;
      const bob = Math.abs(Math.sin(ph * Math.PI * 2)) * 1.5;
      const p = mk(26 - bob + 1, 14 - bob + 1);
      p.torso.x = CX + 1; p.head.x = CX + 2;
      p.torso.flut = Math.round(Math.sin(ph * Math.PI * 2) * 2);
      p.legB = runLeg(ph + 0.5, CX - 1, 44, GY);
      p.legF = runLeg(ph, CX + 1, 44, GY);
      if (shoot) {
        p.armB = { sx: CX - 7, sy: 28, ex: CX - 9, ey: 35, hx: CX - 7, hy: 41 };
        p.armF = { sx: CX + 8, sy: 28, ex: CX + 13, ey: 29, hx: CX + 19, hy: 30, buster: true };
      } else {
        const sw = Math.sin(ph * Math.PI * 2);
        p.armB = { sx: CX - 7, sy: 28, ex: CX - 7 + sw * 5, ey: 34, hx: CX - 7 + sw * 8, hy: 39 - Math.abs(sw) * 2 };
        p.armF = { sx: CX + 8, sy: 28, ex: CX + 8 - sw * 5, ey: 34, hx: CX + 8 - sw * 8, hy: 39 - Math.abs(sw) * 2 };
      }
      return bakeHero(charKey, p);
    };
    frames.run = []; frames.runShoot = [];
    for (let i = 0; i < RUN_N; i++) { frames.run.push(mkRun(i, false)); if (!isRaven) frames.runShoot.push(mkRun(i, true)); }
    const mkDash = (shoot) => {
      const p = mk(30, 20);
      p.torso.x = CX + 3; p.head.x = CX + 7; p.head.y = 19;
      p.legB = { hx: CX - 1, hy: 46, kx: CX - 9, ky: 50, fx: CX - 15, fy: GY - 1 };
      p.legF = { hx: CX + 4, hy: 46, kx: CX + 9, ky: 53, fx: CX + 13, fy: GY };
      p.armB = { sx: CX - 4, sy: 32, ex: CX - 10, ey: 37, hx: CX - 14, hy: 41 };
      p.armF = shoot
        ? { sx: CX + 10, sy: 32, ex: CX + 15, ey: 32, hx: CX + 21, hy: 33, buster: true }
        : { sx: CX + 10, sy: 32, ex: CX + 15, ey: 36, hx: CX + 20, hy: 40 };
      p.pre = (g) => { // 대시 더스트
        R(g, CX - 14, 52, 8, 3, '#c0aa88'); R(g, CX - 19, 54, 5, 2, '#a89068');
        R(g, CX - 22, 55, 3, 1, '#c0aa88');
      };
      return bakeHero(charKey, p);
    };
    frames.dash = [mkDash(false)];
    if (!isRaven) frames.dashShoot = [mkDash(true)];
    const mkJump = (kind, shoot) => {
      const p = mk(24, 12);
      if (kind === 'rise') {
        p.legB = { hx: CX - 3, hy: 42, kx: CX - 7, ky: 46, fx: CX - 8, fy: 53 };
        p.legF = { hx: CX + 3, hy: 42, kx: CX + 6, ky: 49, fx: CX + 4, fy: 56 };
        p.armB = { sx: CX - 8, sy: 26, ex: CX - 12, ey: 30, hx: CX - 13, hy: 24 };
        p.armF = shoot ? { sx: CX + 8, sy: 26, ex: CX + 13, ey: 28, hx: CX + 19, hy: 29, buster: true }
          : { sx: CX + 8, sy: 26, ex: CX + 12, ey: 32, hx: CX + 15, hy: 28 };
      } else if (kind === 'apex') {
        p.legB = { hx: CX - 3, hy: 42, kx: CX - 6, ky: 48, fx: CX - 6, fy: 54 };
        p.legF = { hx: CX + 3, hy: 42, kx: CX + 7, ky: 47, fx: CX + 8, fy: 53 };
        p.armB = { sx: CX - 8, sy: 26, ex: CX - 11, ey: 32, hx: CX - 12, hy: 37 };
        p.armF = shoot ? { sx: CX + 8, sy: 26, ex: CX + 13, ey: 28, hx: CX + 19, hy: 29, buster: true }
          : { sx: CX + 8, sy: 26, ex: CX + 11, ey: 32, hx: CX + 12, hy: 37 };
      } else {
        p.torso.y = 25; p.head.y = 13;
        p.legB = { hx: CX - 3, hy: 43, kx: CX - 5, ky: 49, fx: CX - 9, fy: 54 };
        p.legF = { hx: CX + 3, hy: 43, kx: CX + 5, ky: 50, fx: CX + 2, fy: 57 };
        p.armB = { sx: CX - 8, sy: 27, ex: CX - 12, ey: 24, hx: CX - 15, hy: 20 };
        p.armF = shoot ? { sx: CX + 8, sy: 27, ex: CX + 13, ey: 29, hx: CX + 19, hy: 30, buster: true }
          : { sx: CX + 8, sy: 27, ex: CX + 12, ey: 24, hx: CX + 15, hy: 20 };
      }
      return bakeHero(charKey, p);
    };
    frames.jumpRise = [mkJump('rise', false)];
    frames.jumpApex = [mkJump('apex', false)];
    frames.jumpFall = [mkJump('fall', false)];
    if (!isRaven) {
      frames.jumpRiseShoot = [mkJump('rise', true)];
      frames.jumpApexShoot = [mkJump('apex', true)];
      frames.jumpFallShoot = [mkJump('fall', true)];
    }
    const mkWall = (shoot, v) => {
      const p = mk(26, 15);
      p.torso.x = CX - 2; p.head.x = CX - 4;
      p.legB = { hx: CX - 4, hy: 44, kx: CX - 2, ky: 50, fx: CX + 2, fy: 55 };
      p.legF = { hx: CX + 1, hy: 44, kx: CX + 4, ky: 49, fx: CX + 7, fy: 53 };
      p.armB = shoot ? { sx: CX - 8, sy: 28, ex: CX - 13, ey: 30, hx: CX - 19, hy: 31, buster: true }
        : { sx: CX - 8, sy: 28, ex: CX - 12, ey: 34, hx: CX - 14, hy: 39 };
      p.armF = { sx: CX + 5, sy: 28, ex: CX + 10, ey: 30, hx: CX + 13, hy: 34 };
      p.post = (g) => {
        if (v) { R(g, CX + 12, 38, 3, 2, '#ffe2b0'); R(g, CX + 13, 50, 2, 2, '#c0aa88'); }
        else { R(g, CX + 13, 44, 3, 2, '#c0aa88'); R(g, CX + 12, 54, 2, 2, '#ffe2b0'); }
      };
      return bakeHero(charKey, p);
    };
    frames.wall = [mkWall(false, 0), mkWall(false, 1)];
    if (!isRaven) frames.wallShoot = [mkWall(true, 0)];
    // 착지 스쿼시
    frames.land = [(() => {
      const p = mk(29, 17);
      p.legB = { hx: CX - 4, hy: 46, kx: CX - 9, ky: 52, fx: CX - 10, fy: GY };
      p.legF = { hx: CX + 4, hy: 46, kx: CX + 9, ky: 52, fx: CX + 10, fy: GY };
      p.armB = { sx: CX - 8, sy: 31, ex: CX - 12, ey: 37, hx: CX - 13, hy: 42 };
      p.armF = { sx: CX + 8, sy: 31, ex: CX + 12, ey: 37, hx: CX + 13, hy: 42 };
      p.torso.flut = 2;
      return bakeHero(charKey, p);
    })()];
    // 방향 전환 스키드
    frames.skid = [(() => {
      const p = mk(27, 15);
      p.torso.x = CX - 2; p.head.x = CX - 3;
      p.legB = { hx: CX - 3, hy: 45, kx: CX - 8, ky: 51, fx: CX - 11, fy: GY };
      p.legF = { hx: CX + 3, hy: 45, kx: CX + 9, ky: 50, fx: CX + 14, fy: GY - 1 };
      p.armB = { sx: CX - 8, sy: 29, ex: CX - 13, ey: 33, hx: CX - 16, hy: 30 };
      p.armF = { sx: CX + 7, sy: 29, ex: CX + 11, ey: 35, hx: CX + 13, hy: 40 };
      p.torso.flut = -3;
      p.pre = (g) => { R(g, CX + 10, 55, 6, 2, '#c0aa88'); R(g, CX + 16, 56, 4, 1, '#a89068'); };
      return bakeHero(charKey, p);
    })()];
    frames.hurt = [(() => {
      const p = mk(27, 16);
      p.torso.x = CX - 2; p.head.x = CX - 3; p.head.y = 15;
      p.legB = { hx: CX - 4, hy: 45, kx: CX - 10, ky: 49, fx: CX - 13, fy: 55 };
      p.legF = { hx: CX + 2, hy: 45, kx: CX + 8, ky: 48, fx: CX + 12, fy: 53 };
      p.armB = { sx: CX - 8, sy: 29, ex: CX - 13, ey: 25, hx: CX - 16, hy: 21 };
      p.armF = { sx: CX + 6, sy: 29, ex: CX + 11, ey: 25, hx: CX + 14, hy: 21 };
      return bakeHero(charKey, p);
    })()];
    frames.victory = [0, 1].map(i => {
      const p = mk(26, 14);
      p.legB = { hx: CX - 3, hy: 44, kx: CX - 6, ky: 51, fx: CX - 8, fy: GY };
      p.legF = { hx: CX + 3, hy: 44, kx: CX + 6, ky: 51, fx: CX + 8, fy: GY };
      p.armB = { sx: CX - 8, sy: 28, ex: CX - 10, ey: 36, hx: CX - 9, hy: 42 };
      if (isRaven) {
        // 검 하늘로
        p.armF = { sx: CX + 8, sy: 28, ex: CX + 12, ey: 20 - i * 2, hx: CX + 11, hy: 12 - i * 3 };
        p.blade = { x0: CX + 11, y0: 12 - i * 3, x1: CX + 17, y1: 1 - i };
      } else {
        // 모자 챙 잡기
        p.armF = { sx: CX + 8, sy: 28, ex: CX + 12, ey: 20, hx: CX + 8, hy: 12 - i };
      }
      return bakeHero(charKey, p);
    });

    // ── 레이븐 전용: 참격 포즈 ──
    if (isRaven) {
      const atk1 = mk(27, 15);   // 전방 수평 베기
      atk1.torso.x = CX + 2; atk1.head.x = CX + 4;
      atk1.legB = { hx: CX - 2, hy: 45, kx: CX - 8, ky: 50, fx: CX - 12, fy: GY };
      atk1.legF = { hx: CX + 4, hy: 45, kx: CX + 9, ky: 52, fx: CX + 12, fy: GY };
      atk1.armB = { sx: CX - 6, sy: 29, ex: CX - 10, ey: 34, hx: CX - 12, hy: 38 };
      atk1.armF = { sx: CX + 9, sy: 29, ex: CX + 14, ey: 30, hx: CX + 18, hy: 30 };
      atk1.blade = { x0: CX + 18, y0: 30, x1: CX + 30, y1: 28 };
      frames.atk1 = [bakeHero(charKey, atk1)];

      const atk2 = mk(27, 15);   // 반대 베기 (아래→위)
      atk2.torso.x = CX + 1; atk2.head.x = CX + 2;
      atk2.legB = { hx: CX - 2, hy: 45, kx: CX - 7, ky: 51, fx: CX - 10, fy: GY };
      atk2.legF = { hx: CX + 4, hy: 45, kx: CX + 8, ky: 51, fx: CX + 11, fy: GY };
      atk2.armB = { sx: CX - 6, sy: 29, ex: CX - 9, ey: 35, hx: CX - 10, hy: 40 };
      atk2.armF = { sx: CX + 9, sy: 29, ex: CX + 13, ey: 33, hx: CX + 16, hy: 36 };
      atk2.blade = { x0: CX + 16, y0: 36, x1: CX + 29, y1: 20 };
      frames.atk2 = [bakeHero(charKey, atk2)];

      const atk3 = mk(26, 14);   // 올려베기 (런처)
      atk3.torso.x = CX + 2; atk3.head.x = CX + 3;
      atk3.legB = { hx: CX - 2, hy: 44, kx: CX - 8, ky: 49, fx: CX - 12, fy: GY - 1 };
      atk3.legF = { hx: CX + 4, hy: 44, kx: CX + 8, ky: 51, fx: CX + 10, fy: GY };
      atk3.armB = { sx: CX - 6, sy: 28, ex: CX - 10, ey: 33, hx: CX - 13, hy: 37 };
      atk3.armF = { sx: CX + 9, sy: 28, ex: CX + 13, ey: 22, hx: CX + 15, hy: 15 };
      atk3.blade = { x0: CX + 15, y0: 15, x1: CX + 24, y1: 3 };
      frames.atk3 = [bakeHero(charKey, atk3)];

      const atkAir = mk(24, 12); // 공중 내려베기
      atkAir.legB = { hx: CX - 3, hy: 42, kx: CX - 7, ky: 46, fx: CX - 9, fy: 52 };
      atkAir.legF = { hx: CX + 3, hy: 42, kx: CX + 6, ky: 48, fx: CX + 4, fy: 55 };
      atkAir.armB = { sx: CX - 8, sy: 26, ex: CX - 12, ey: 29, hx: CX - 14, hy: 25 };
      atkAir.armF = { sx: CX + 8, sy: 26, ex: CX + 13, ey: 31, hx: CX + 16, hy: 36 };
      atkAir.blade = { x0: CX + 16, y0: 36, x1: CX + 27, y1: 48 };
      frames.atkAir = [bakeHero(charKey, atkAir)];

      frames.atkSpin = [0, 1].map(i => { // 회전참
        const p = mk(26, 14);
        p.legB = { hx: CX - 3, hy: 44, kx: CX - 7, ky: 50, fx: CX - 10, fy: GY - 1 };
        p.legF = { hx: CX + 3, hy: 44, kx: CX + 7, ky: 50, fx: CX + 10, fy: GY - 1 };
        p.armB = { sx: CX - 8, sy: 28, ex: CX - 13, ey: 28, hx: CX - 17, hy: 28 };
        p.armF = { sx: CX + 8, sy: 28, ex: CX + 13, ey: 28, hx: CX + 17, hy: 28 };
        p.blade = i === 0
          ? { x0: CX + 17, y0: 28, x1: CX + 31, y1: 26 }
          : { x0: CX - 17, y0: 28, x1: CX - 31, y1: 26 };
        return bakeHero(charKey, p);
      });
    }
    return frames;
  }

  // 포구/발도 위치 (스프라이트 좌상단 기준, 오른쪽 바라볼 때)
  S.heroMuzzle = {
    dusk: {
      idleShoot: { x: 61, y: 29 }, runShoot: { x: 61, y: 28 }, dashShoot: { x: 62, y: 31 },
      jumpRiseShoot: { x: 61, y: 27 }, jumpApexShoot: { x: 61, y: 27 }, jumpFallShoot: { x: 61, y: 28 },
      wallShoot: { x: 3, y: 29 },
    },
    raven: { default: { x: 56, y: 29 } },
  };

  // ── 발사체 ─────────────────────────────────────────────
  function bakeBullets() {
    S.bullets = {};
    // 리볼버 탄 (황혼 트레이서)
    S.bullets.buster1 = [0, 1].map(i => NS.bake(16, 10, (g) => {
      R(g, 2, 3, 10, 4, P.orange3); R(g, 4, 4, 8, 2, P.yellow); R(g, 8, 4, 5, 2, P.white);
      if (i) { R(g, 0, 4, 3, 2, P.orange3); }
    }));
    S.bullets.buster2 = [0, 1].map(i => NS.bake(24, 16, (g) => {
      NS.orb(g, 14, 8, 6, P.orange2, P.red2, P.orange3);
      R(g, 12, 6, 6, 4, P.yellow); R(g, 13, 7, 4, 2, P.white);
      R(g, 2, 6 - i, 8, 2, P.orange3); R(g, 4, 9 + i, 6, 2, P.orange2);
    }));
    S.bullets.buster3 = [0, 1].map(i => NS.bake(36, 20, (g) => {
      NS.orb(g, 24, 10, 8, P.orange2, P.red2, P.orange3);
      NS.orb(g, 24, 10, 5, P.yellow, P.orange2, P.white);
      R(g, 21, 8, 7, 4, P.white);
      R(g, 2, 5 + i, 14, 3, P.orange3); R(g, 6, 12 - i, 12, 3, P.yellow);
      R(g, 0, 9, 8, 2, P.orange3);
    }));
    S.bullets.enemy = [0, 1].map(i => NS.bake(10, 10, (g) => {
      NS.orb(g, 5, 5, 3, P.magenta2, P.magenta1, P.magenta3);
      R(g, 4, 4, 2, 2, P.white);
    }));
    S.bullets.enemyBig = [0, 1].map(i => NS.bake(16, 16, (g) => {
      NS.orb(g, 8, 8, 5, P.magenta2, P.magenta1, P.magenta3);
      R(g, 6, 5 + i, 3, 3, P.white);
    }));
    S.bullets.magma = [0, 1].map(i => NS.bake(18, 18, (g) => {
      NS.orb(g, 9, 9, 6, P.orange2, P.red2, P.orange3);
      R(g, 6, 5 + i, 5, 4, P.yellow); R(g, 7 - i * 2, 12, 3, 3, P.red2);
      R(g, 13, 4 - i, 2, 2, P.orange3);
    }));
    S.bullets.frost = [0, 1].map(i => NS.bake(26, 10, (g) => {
      R(g, 2, 3, 16, 4, P.cyan1);
      R(g, 4, 3, 14, 2, P.cyan3);
      R(g, 18, 4, 4, 2, P.white); R(g, 22, 4, 2, 2, P.cyan3);
      R(g, 16, 2, 3, 2, P.white); R(g, 16, 6, 3, 2, P.white);
      if (i) R(g, 0, 4, 3, 2, P.cyan3);
    }));
    S.bullets.cyclone = [0, 1].map(i => NS.bake(20, 20, (g) => {
      const rot = i * Math.PI / 4;
      for (let k = 0; k < 4; k++) {
        const a = rot + k * Math.PI / 2;
        const x1 = 10 + Math.cos(a) * 8, y1 = 10 + Math.sin(a) * 8;
        NS.limb(g, 10, 10, x1, y1, 3, P.green2, P.green1, P.green3);
      }
      NS.orb(g, 10, 10, 3, P.steel4, P.steel3, P.steel5);
      R(g, 9, 9, 2, 2, P.white);
    }));
    S.bullets.lavaGlob = [0, 1].map(i => NS.bake(14, 14, (g) => {
      NS.orb(g, 7, 7 + i, 5, P.orange2, P.red1, P.orange3);
      R(g, 5, 4 + i, 3, 2, P.yellow);
    }));
    S.bullets.icicle = [0].map(() => NS.bake(8, 16, (g) => {
      R(g, 2, 0, 4, 9, P.cyan1); R(g, 3, 0, 2, 8, P.cyan3);
      R(g, 3, 9, 2, 4, P.cyan3); R(g, 3, 13, 2, 2, P.white);
    }));
    S.bullets.feather = [0, 1].map(i => NS.bake(16, 8, (g) => {
      R(g, 1, 3, 12, 3, P.violet2); R(g, 3, 3, 10, 1, P.violet3);
      R(g, 12, 3 + i, 3, 2, P.white);
    }));
    S.bullets.ringShot = [0, 1].map(i => NS.bake(14, 14, (g) => {
      NS.orb(g, 7, 7, 5, P.magenta2, P.magenta1, P.magenta3);
      g.clearRect(5, 5, 4, 4);
      if (i) R(g, 6, 6, 2, 2, P.white);
    }));
  }

  // ── 아이템 ─────────────────────────────────────────────
  function bakeItems() {
    S.items = {};
    S.items.healthS = [0, 1].map(i => NS.bake(12, 12, (g) => {
      NS.box3(g, 2, 3, 8, 7, P.steel3, P.steel2, P.steel4);
      R(g, 5, 3, 2, 7, P.green2); R(g, 3, 5, 6, 2, P.green2);
      R(g, 5, 4, 1, 1, P.green3);
    }));
    S.items.healthL = [0, 1].map(i => NS.bake(16, 16, (g) => {
      NS.box3(g, 2, 3, 12, 11, P.steel3, P.steel2, P.steel4);
      R(g, 7, 4, 3, 9, P.green2); R(g, 4, 7, 9, 3, P.green2);
      R(g, 7, 5, 1, 2, P.green3); if (i) R(g, 5, 8, 2, 1, P.green3);
    }));
    S.items.energy = [0, 1].map(i => NS.bake(12, 12, (g) => {
      NS.box3(g, 2, 3, 8, 7, P.violet1, P.night2, P.violet2);
      R(g, 4, 4 + (i ? 1 : 0), 4, 4, P.violet3); R(g, 5, 5, 2, 2, P.white);
    }));
    S.items.chipS = [0, 1].map(i => NS.bake(10, 10, (g) => {
      NS.orb(g, 5, 5, 3, P.orange3, P.orange2, P.yellow);
      if (!i) R(g, 4, 3, 2, 2, P.white);
    }));
    S.items.chipL = [0, 1].map(i => NS.bake(14, 14, (g) => {
      NS.orb(g, 7, 7, 5, P.orange3, P.orange2, P.yellow);
      R(g, 5, 5, 4, 4, P.yellow); if (!i) R(g, 5, 4, 3, 2, P.white);
    }));
    S.items.heart = [0, 1].map(i => NS.bake(16, 16, (g) => {
      const c = i ? P.magenta3 : P.magenta2;
      R(g, 3, 4, 4, 4, c); R(g, 9, 4, 4, 4, c);
      R(g, 2, 6, 12, 4, c); R(g, 4, 10, 8, 2, c); R(g, 6, 12, 4, 2, P.magenta1);
      R(g, 4, 5, 2, 2, P.white);
    }));
    S.items.subtank = [0].map(() => NS.bake(16, 20, (g) => {
      NS.box3(g, 3, 3, 10, 14, P.steel3, P.steel2, P.steel4);
      R(g, 4, 8, 8, 8, P.cyan1); R(g, 4, 8, 8, 2, P.cyan2);
      R(g, 5, 4, 6, 3, P.orange3); R(g, 6, 4, 2, 1, P.yellow);
    }));
    // 보안관 스타 배지 (1UP — 현상금 사냥꾼 테마)
    S.items.oneUp = [0].map(() => NS.bake(16, 16, (g) => {
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + k * Math.PI * 2 / 5;
        NS.limb(g, 8, 8, 8 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, 3, P.orange3, P.orange2, P.yellow);
      }
      NS.orb(g, 8, 8, 3, P.yellow, P.orange2, P.white);
      R(g, 7, 7, 2, 2, P.white);
    }));
    S.items.capsule = [0, 1].map(i => NS.bake(32, 40, (g) => {
      NS.box3(g, 4, 30, 24, 7, P.steel2, P.steel1, P.steel3);
      R(g, 6, 4, 20, 27, P.night2);
      R(g, 6, 4, 20, 2, P.steel3);
      if (i) {
        R(g, 8, 8, 16, 22, NS.rgba(P.cyan2, 0.35));
        R(g, 10, 10, 12, 18, NS.rgba(P.cyan3, 0.3));
      }
      R(g, 4, 2, 24, 4, P.steel3); R(g, 4, 2, 24, 1, P.steel5);
      R(g, 14, 33, 4, 2, i ? P.cyan2 : P.red2);
    }));
  }

  // ── 폭발/이펙트 프레임 ─────────────────────────────────
  function bakeFx() {
    S.fx = {};
    S.fx.explosion = [0, 1, 2, 3].map(i => NS.bake(36, 36, (g) => {
      const r = 4 + i * 5;
      if (i < 3) {
        NS.orb(g, 18, 18, r, P.orange2, P.red2, P.yellow);
        NS.orb(g, 18, 18, Math.max(1, r - 3), P.yellow, P.orange3, P.white);
      } else {
        for (let a = 0; a < 12; a++) {
          const th = a / 12 * Math.PI * 2;
          R(g, 18 + Math.cos(th) * r - 1, 18 + Math.sin(th) * r - 1, 3, 3, P.orange3);
        }
      }
      for (let a = 0; a < 6; a++) {
        const th = a / 6 * Math.PI * 2 + i;
        R(g, 18 + Math.cos(th) * (r + 3), 18 + Math.sin(th) * (r + 3), 2, 2, P.white);
      }
    }));
    S.fx.spark = [0, 1, 2].map(i => NS.bake(16, 16, (g) => {
      const r = 2 + i * 2;
      for (let a = 0; a < 4; a++) {
        const th = a / 4 * Math.PI * 2 + Math.PI / 4;
        NS.limb(g, 8, 8, 8 + Math.cos(th) * r, 8 + Math.sin(th) * r, 2, P.orange3, P.orange2, P.white);
      }
      if (i === 0) R(g, 7, 7, 3, 3, P.white);
    }));
    S.fx.muzzle = [0, 1].map(i => NS.bake(14, 14, (g) => {
      NS.orb(g, 7, 7, 4 - i, P.orange3, P.orange2, P.white);
      R(g, 5, 6, 6, 2, P.white);
      R(g, 3, 3, 2, 2, NS.rgba('#c0aa88', 0.8)); R(g, 10, 4, 2, 2, NS.rgba('#c0aa88', 0.7)); // 화약 연기
    }));
    // 충격파 링
    S.fx.ring = [0, 1, 2].map(i => NS.bake(56, 56, (g) => {
      const r = 8 + i * 9;
      for (let a = 0; a < Math.PI * 2; a += 0.05) {
        const w = 3 - i;
        if (w <= 0) continue;
        R(g, 28 + Math.cos(a) * r - w / 2, 28 + Math.sin(a) * r * 0.85 - w / 2, w, w,
          i === 0 ? P.white : NS.rgba(P.orange3, 0.9 - i * 0.25));
      }
    }, { post: false }));
    // 연기 퍼프
    S.fx.smoke = [0, 1, 2, 3].map(i => NS.bake(28, 28, (g) => {
      const r = 4 + i * 2.5;
      NS.orb(g, 14, 16 - i * 2, r, NS.rgba('#6a5a52', 0.8 - i * 0.16), NS.rgba('#4a3e38', 0.7 - i * 0.14), NS.rgba('#9a8878', 0.7 - i * 0.15));
      NS.orb(g, 14 - r * 0.5, 17 - i * 2, r * 0.6, NS.rgba('#5a4c46', 0.6 - i * 0.12), NS.rgba('#4a3e38', 0.5), NS.rgba('#8a7868', 0.5));
    }, { post: false }));
    // 흙먼지 퍼프 (발구름/착지/스키드)
    S.fx.dust = [0, 1, 2].map(i => NS.bake(18, 14, (g) => {
      const r = 2 + i * 1.6;
      NS.orb(g, 6, 10 - i, r, NS.rgba('#c0aa88', 0.75 - i * 0.2), NS.rgba('#a89068', 0.6 - i * 0.15), NS.rgba('#e0d0b0', 0.7 - i * 0.2));
      NS.orb(g, 12, 11 - i * 1.5, r * 0.8, NS.rgba('#b09878', 0.6 - i * 0.15), NS.rgba('#a89068', 0.5), NS.rgba('#d8c8a8', 0.55));
    }, { post: false }));
    // 참격 아크 (레이븐) — 흰 강철 궤적 + 오렌지 여운
    S.fx.slash = [0, 1, 2].map(i => NS.bake(40, 40, (g) => {
      const r = 15 + i * 2;
      for (let a = -0.9; a <= 0.9; a += 0.08) {
        const w = 4 - Math.abs(a) * 3 - i;
        if (w <= 0) continue;
        const x = 20 + Math.cos(a) * r, y = 20 + Math.sin(a) * r;
        R(g, x - w / 2, y - w / 2, w, w, Math.abs(a) < 0.3 ? P.white : i === 0 ? RP.blade : NS.rgba(P.orange3, 0.8));
      }
    }, { post: false }));
    S.fx.spinArc = [0, 1, 2].map(i => NS.bake(56, 56, (g) => {
      const r = 20 + i * 3;
      for (let a = 0; a < Math.PI * 2; a += 0.07) {
        const w = 3 - i;
        if (w <= 0) continue;
        const x = 28 + Math.cos(a + i) * r, y = 28 + Math.sin(a + i) * r * 0.7;
        R(g, x - w / 2, y - w / 2, w, w, (a % 1) < 0.5 ? P.white : NS.rgba(P.orange3, 0.75));
      }
    }, { post: false }));
  }

  NS.bakeCharacterSprites = () => {
    S.heroes = { dusk: heroPoses('dusk'), raven: heroPoses('raven') };
    bakeBullets();
    bakeItems();
    bakeFx();
  };
})();
