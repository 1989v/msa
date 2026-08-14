// NOVA STRIKE — sprites: 리그 베이크 (주인공/발사체/아이템/폭발)
// 전 스프라이트가 outlinePass(외곽선+림라이트)를 통과해 아트 문법이 통일된다.
'use strict';
(function () {
  const P = NS.PAL;
  const S = {};
  NS.Sprites = S;

  // 노바 아머 팔레트 — 오리지널 디자인: 화이트/건메탈 + 시안 풀 바이저 + 오렌지 액센트
  // (특정 기존 캐릭터의 실루엣·컬러웨이를 따르지 않는다)
  const AP = {
    main: '#dfe7f4', dark: '#97a3c6', lite: '#ffffff',
    trim: '#31405c', trimD: '#1e2940', trimL: '#7186a8',
    glow: P.cyan2, glowL: P.cyan3, gem: P.orange3,
    body: '#1e2940',
  };

  const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

  // ── 노바 리그 ──────────────────────────────────────────
  // 캔버스 64×64, 오른쪽 바라봄, 발끝 y≈58, 중심 x=32
  // pose: { bob, lean, legB/legF: {hx,hy,kx,ky,fx,fy,footA}, armB, armF, buster, head:{x,y,tilt}, torso:{x,y} }

  function drawLeg(g, L, front) {
    const th = front ? 6 : 5, sh = front ? 5 : 4;
    const m = front ? AP.main : AP.dark, d = AP.dark, l = front ? AP.lite : AP.main;
    NS.limb(g, L.hx, L.hy, L.kx, L.ky, th, m, d, front ? l : null);      // 허벅지
    NS.limb(g, L.kx, L.ky, L.fx, L.fy - 3, sh, AP.trim, AP.trimD, null); // 정강이(언더슈트)
    // 앵글드 그리브 부츠
    const bx = L.fx - 4, by = L.fy - 6;
    R(g, bx, by, 10, 5, m); R(g, bx, by + 4, 10, 2, d);
    R(g, bx, by, 9, 1, l);
    R(g, bx + 7, by + 2, 4, 3, m); R(g, bx + 8, by + 4, 3, 2, d); // 앞코 (낮은 웨지)
    R(g, bx - 1, by + 5, 12, 1, AP.trimD);                        // 밑창
    R(g, bx + 1, by + 1, 1, 4, AP.glow);                          // 세로 발광 슬릿
    R(g, bx + 5, by - 1, 3, 2, AP.trim);                          // 발목 가드
  }

  function drawArm(g, A, front) {
    const m = front ? AP.main : AP.dark, d = AP.dark, l = front ? AP.lite : AP.main;
    NS.limb(g, A.sx, A.sy, A.ex, A.ey, 4, AP.trim, AP.trimD, null); // 상완(언더슈트)
    if (A.buster) {
      // 버스터 캐넌 — 건메탈 (본체 화이트와 대비)
      const bx = A.hx - 5, by = A.hy - 4;
      R(g, bx, by, 12, 8, AP.trim); R(g, bx, by + 6, 12, 2, AP.trimD); R(g, bx, by, 11, 1, AP.trimL);
      R(g, bx + 10, by + 1, 3, 6, AP.trimD);              // 포구 링
      R(g, bx + 12, by + 2, 2, 4, AP.glow);               // 포구 발광
      R(g, bx + 1, by + 2, 3, 3, AP.glow);                // 캐넌 코어
      R(g, bx + 6, by + 1, 3, 1, AP.gem);                 // 오렌지 스트라이프
    } else {
      NS.limb(g, A.ex, A.ey, A.hx, A.hy, 6, m, d, l);     // 건틀릿
      R(g, A.hx - 1, A.hy - 1, 4, 4, AP.trimL);           // 손
      R(g, A.hx - 1, A.hy + 2, 4, 1, AP.trim);
    }
    // 앵귤러 숄더 (전면이 더 크고 오렌지 스트라이프 — 비대칭)
    if (front) {
      R(g, A.sx - 5, A.sy - 4, 10, 7, m); R(g, A.sx - 5, A.sy + 1, 10, 2, d);
      R(g, A.sx - 5, A.sy - 4, 9, 1, l);
      R(g, A.sx - 5, A.sy - 2, 10, 1, AP.gem);            // 오렌지 스트라이프
    } else {
      R(g, A.sx - 4, A.sy - 3, 8, 6, m); R(g, A.sx - 4, A.sy + 1, 8, 2, d);
      R(g, A.sx - 4, A.sy - 3, 7, 1, l);
    }
  }

  function drawTorso(g, T) {
    const x = T.x, y = T.y;
    // 골반
    R(g, x - 5, y + 12, 10, 6, AP.trim); R(g, x - 5, y + 16, 10, 2, AP.trimD);
    R(g, x - 6, y + 12, 3, 4, AP.main); R(g, x + 3, y + 12, 3, 4, AP.main);
    // 허리(언더슈트)
    R(g, x - 4, y + 9, 8, 4, AP.body);
    // 흉갑 — 앵귤러 플레이트
    R(g, x - 7, y, 14, 10, AP.main);
    R(g, x - 7, y + 7, 14, 3, AP.dark);
    R(g, x - 7, y, 13, 2, AP.lite);
    R(g, x - 8, y + 2, 2, 6, AP.trim); R(g, x + 6, y + 2, 2, 6, AP.trim); // 옆구리 언더슈트
    R(g, x - 7, y + 5, 5, 1, AP.dark);  // 사선 패널 라인
    R(g, x + 2, y + 6, 5, 1, AP.dark);
    // 헥스 코어 (가슴 중앙)
    R(g, x - 2, y + 2, 5, 6, AP.trimD);
    R(g, x - 1, y + 2, 3, 1, AP.glow);
    R(g, x - 2, y + 3, 5, 3, AP.glow);
    R(g, x - 1, y + 6, 3, 1, AP.glow);
    R(g, x - 1, y + 3, 1, 2, P.white);
  }

  function drawHead(g, H) {
    const x = H.x, y = H.y;
    // 목 (언더슈트) — 흉갑과 연결
    R(g, x - 2, y + 6, 5, 6, AP.body);
    R(g, x - 4, y + 9, 9, 3, AP.trim);                // 하이 칼라
    // 스텔스 웨지 헬멧 — 풀 바이저, 얼굴 노출 없음
    R(g, x - 6, y - 7, 13, 13, AP.main);              // 베이스
    R(g, x - 6, y - 7, 12, 2, AP.lite);               // 상단 하이라이트
    R(g, x - 6, y + 3, 13, 3, AP.dark);               // 하단 셰이드
    R(g, x + 5, y - 5, 2, 9, AP.dark);                // 전면 사면
    g.clearRect(Math.round(x + 5), Math.round(y - 7), 3, 2);   // 앞상단 웨지 컷
    g.clearRect(Math.round(x - 6), Math.round(y + 4), 2, 2);   // 뒤턱 컷
    // 턱 가드 (건메탈)
    R(g, x - 4, y + 4, 10, 3, AP.trim); R(g, x - 4, y + 6, 10, 1, AP.trimD);
    // 풀 바이저 — 시안 발광 밴드
    R(g, x - 3, y - 2, 10, 4, AP.trimD);
    R(g, x - 2, y - 1, 9, 2, AP.glow);
    R(g, x + 3, y - 1, 3, 1, P.white);                // 전방 글린트
    R(g, x - 2, y + 1, 4, 1, P.cyan1);
    // 스윕백 트윈 핀 (짧은 후방 안테나 — 오렌지 팁)
    NS.limb(g, x - 3, y - 5, x - 9, y - 9, 3, AP.main, AP.dark, AP.lite);
    NS.limb(g, x - 1, y - 6, x - 6, y - 11, 2, AP.main, AP.dark, AP.lite);
    R(g, x - 10, y - 10, 2, 2, AP.gem); R(g, x - 7, y - 12, 2, 2, AP.gem);
    // 이마 센서 스트라이프 (세로)
    R(g, x + 1, y - 7, 2, 3, AP.gem); R(g, x + 1, y - 7, 1, 1, P.yellow);
    // 사이드 인테이크
    R(g, x - 6, y - 1, 2, 4, AP.trim); R(g, x - 6, y, 1, 2, AP.glow);
  }

  // 포즈 → 캔버스 베이크
  function bakeHero(pose, opts) {
    return NS.bake(64, 64, (g) => {
      if (pose.pre) pose.pre(g);
      if (pose.armB) drawArm(g, pose.armB, false);
      if (pose.legB) drawLeg(g, pose.legB, false);
      drawTorso(g, pose.torso);
      drawHead(g, pose.head);
      if (pose.legF) drawLeg(g, pose.legF, true);
      if (pose.armF) drawArm(g, pose.armF, true);
      if (pose.post) pose.post(g);
    }, opts);
  }

  // 걷기/달리기 다리 사이클 — 발끝 타원 궤적 + 무릎 중간점
  function runLeg(phase, hipX, hipY, groundY) {
    const t = phase * Math.PI * 2;
    const fx = hipX + Math.cos(t) * 8;
    const lift = Math.max(0, Math.sin(t)) * 6;
    const fy = groundY - lift;
    const mx = (hipX + fx) / 2 + Math.cos(t + Math.PI / 2) * 2 + 2;
    const my = (hipY + fy) / 2 - 1;
    return { hx: hipX, hy: hipY, kx: mx, ky: my, fx, fy };
  }

  function heroPoses() {
    const GY = 58, CX = 32;
    const mk = (torsoY, headY) => ({
      torso: { x: CX, y: torsoY },
      head: { x: CX, y: headY },
    });

    const frames = {};
    // 대기 (호흡 2프레임)
    frames.idle = [0, 1].map(i => {
      const bob = i;
      const p = mk(26 + bob, 14 + bob);
      p.legB = { hx: CX - 3, hy: 44, kx: CX - 5, ky: 51, fx: CX - 6, fy: GY };
      p.legF = { hx: CX + 3, hy: 44, kx: CX + 5, ky: 51, fx: CX + 6, fy: GY };
      p.armB = { sx: CX - 8, sy: 28 + bob, ex: CX - 10, ey: 36 + bob, hx: CX - 9, hy: 42 + bob };
      p.armF = { sx: CX + 8, sy: 28 + bob, ex: CX + 10, ey: 36 + bob, hx: CX + 9, hy: 42 + bob };
      return bakeHero(p);
    });
    // 대기 사격
    frames.idleShoot = [0].map(() => {
      const p = mk(26, 14);
      p.legB = { hx: CX - 3, hy: 44, kx: CX - 5, ky: 51, fx: CX - 6, fy: GY };
      p.legF = { hx: CX + 3, hy: 44, kx: CX + 5, ky: 51, fx: CX + 6, fy: GY };
      p.armB = { sx: CX - 8, sy: 28, ex: CX - 10, ey: 36, hx: CX - 9, hy: 42 };
      p.armF = { sx: CX + 8, sy: 28, ex: CX + 13, ey: 30, hx: CX + 19, hy: 30, buster: true };
      return bakeHero(p);
    });
    // 달리기 8프레임 (+사격 변형)
    const mkRun = (i, shoot) => {
      const ph = i / 8;
      const bob = Math.abs(Math.sin(ph * Math.PI * 2)) * 1.5;
      const p = mk(26 - bob + 1, 14 - bob + 1);
      p.torso.x = CX + 1; p.head.x = CX + 2;
      p.legB = runLeg(ph + 0.5, CX - 1, 44, GY);
      p.legF = runLeg(ph, CX + 1, 44, GY);
      if (shoot) {
        p.armB = { sx: CX - 7, sy: 28, ex: CX - 9, ey: 35, hx: CX - 7, hy: 41 };
        p.armF = { sx: CX + 8, sy: 28, ex: CX + 13, ey: 29, hx: CX + 19, hy: 29, buster: true };
      } else {
        const sw = Math.sin(ph * Math.PI * 2);
        p.armB = { sx: CX - 7, sy: 28, ex: CX - 7 + sw * 5, ey: 34, hx: CX - 7 + sw * 8, hy: 39 - Math.abs(sw) * 2 };
        p.armF = { sx: CX + 8, sy: 28, ex: CX + 8 - sw * 5, ey: 34, hx: CX + 8 - sw * 8, hy: 39 - Math.abs(sw) * 2 };
      }
      return bakeHero(p);
    };
    frames.run = []; frames.runShoot = [];
    for (let i = 0; i < 8; i++) { frames.run.push(mkRun(i, false)); frames.runShoot.push(mkRun(i, true)); }
    // 대시 (전방 런지)
    const mkDash = (shoot) => {
      const p = mk(30, 20);
      p.torso.x = CX + 3; p.head.x = CX + 7; p.head.y = 19;
      p.legB = { hx: CX - 1, hy: 46, kx: CX - 9, ky: 50, fx: CX - 15, fy: GY - 1 };
      p.legF = { hx: CX + 4, hy: 46, kx: CX + 9, ky: 53, fx: CX + 13, fy: GY };
      p.armB = { sx: CX - 4, sy: 32, ex: CX - 10, ey: 37, hx: CX - 14, hy: 41 };
      p.armF = shoot
        ? { sx: CX + 10, sy: 32, ex: CX + 15, ey: 32, hx: CX + 21, hy: 32, buster: true }
        : { sx: CX + 10, sy: 32, ex: CX + 15, ey: 36, hx: CX + 20, hy: 40 };
      p.pre = (g) => { // 대시 제트 분사
        R(g, CX - 14, 44, 8, 4, P.cyan2); R(g, CX - 18, 45, 5, 2, P.cyan3);
        R(g, CX - 21, 46, 3, 1, P.white);
      };
      return bakeHero(p);
    };
    frames.dash = [mkDash(false)];
    frames.dashShoot = [mkDash(true)];
    // 점프 3단계 (상승/정점/낙하) + 사격
    const mkJump = (kind, shoot) => {
      const p = mk(24, 12);
      if (kind === 'rise') {
        p.legB = { hx: CX - 3, hy: 42, kx: CX - 7, ky: 46, fx: CX - 8, fy: 53 };
        p.legF = { hx: CX + 3, hy: 42, kx: CX + 6, ky: 49, fx: CX + 4, fy: 56 };
        p.armB = { sx: CX - 8, sy: 26, ex: CX - 12, ey: 30, hx: CX - 13, hy: 24 };
        p.armF = shoot ? { sx: CX + 8, sy: 26, ex: CX + 13, ey: 28, hx: CX + 19, hy: 28, buster: true }
          : { sx: CX + 8, sy: 26, ex: CX + 12, ey: 32, hx: CX + 15, hy: 28 };
      } else if (kind === 'apex') {
        p.legB = { hx: CX - 3, hy: 42, kx: CX - 6, ky: 48, fx: CX - 6, fy: 54 };
        p.legF = { hx: CX + 3, hy: 42, kx: CX + 7, ky: 47, fx: CX + 8, fy: 53 };
        p.armB = { sx: CX - 8, sy: 26, ex: CX - 11, ey: 32, hx: CX - 12, hy: 37 };
        p.armF = shoot ? { sx: CX + 8, sy: 26, ex: CX + 13, ey: 28, hx: CX + 19, hy: 28, buster: true }
          : { sx: CX + 8, sy: 26, ex: CX + 11, ey: 32, hx: CX + 12, hy: 37 };
      } else { // fall
        p.torso.y = 25; p.head.y = 13;
        p.legB = { hx: CX - 3, hy: 43, kx: CX - 5, ky: 49, fx: CX - 9, fy: 54 };
        p.legF = { hx: CX + 3, hy: 43, kx: CX + 5, ky: 50, fx: CX + 2, fy: 57 };
        p.armB = { sx: CX - 8, sy: 27, ex: CX - 12, ey: 24, hx: CX - 15, hy: 20 };
        p.armF = shoot ? { sx: CX + 8, sy: 27, ex: CX + 13, ey: 29, hx: CX + 19, hy: 29, buster: true }
          : { sx: CX + 8, sy: 27, ex: CX + 12, ey: 24, hx: CX + 15, hy: 20 };
      }
      return bakeHero(p);
    };
    frames.jumpRise = [mkJump('rise', false)]; frames.jumpRiseShoot = [mkJump('rise', true)];
    frames.jumpApex = [mkJump('apex', false)]; frames.jumpApexShoot = [mkJump('apex', true)];
    frames.jumpFall = [mkJump('fall', false)]; frames.jumpFallShoot = [mkJump('fall', true)];
    // 월 슬라이드 (벽이 오른쪽에 있다고 가정, flip 으로 좌우 대응)
    const mkWall = (shoot) => {
      const p = mk(26, 15);
      p.torso.x = CX - 2; p.head.x = CX - 4;
      p.legB = { hx: CX - 4, hy: 44, kx: CX - 2, ky: 50, fx: CX + 2, fy: 55 };
      p.legF = { hx: CX + 1, hy: 44, kx: CX + 4, ky: 49, fx: CX + 7, fy: 53 };
      p.armB = shoot ? { sx: CX - 8, sy: 28, ex: CX - 13, ey: 30, hx: CX - 19, hy: 30, buster: true }
        : { sx: CX - 8, sy: 28, ex: CX - 12, ey: 34, hx: CX - 14, hy: 39 };
      p.armF = { sx: CX + 5, sy: 28, ex: CX + 10, ey: 30, hx: CX + 13, hy: 34 }; // 벽짚기
      p.post = (g) => { R(g, CX + 12, 40, 3, 2, P.cyan3); R(g, CX + 13, 48, 3, 2, P.cyan3); }; // 마찰 스파크
      return bakeHero(p);
    };
    frames.wall = [mkWall(false)]; frames.wallShoot = [mkWall(true)];
    // 피격
    frames.hurt = [(() => {
      const p = mk(27, 16);
      p.torso.x = CX - 2; p.head.x = CX - 3; p.head.y = 15;
      p.legB = { hx: CX - 4, hy: 45, kx: CX - 10, ky: 49, fx: CX - 13, fy: 55 };
      p.legF = { hx: CX + 2, hy: 45, kx: CX + 8, ky: 48, fx: CX + 12, fy: 53 };
      p.armB = { sx: CX - 8, sy: 29, ex: CX - 13, ey: 25, hx: CX - 16, hy: 21 };
      p.armF = { sx: CX + 6, sy: 29, ex: CX + 11, ey: 25, hx: CX + 14, hy: 21 };
      return bakeHero(p);
    })()];
    // 승리 (주먹 들기 2프레임)
    frames.victory = [0, 1].map(i => {
      const p = mk(26, 14);
      p.legB = { hx: CX - 3, hy: 44, kx: CX - 6, ky: 51, fx: CX - 8, fy: GY };
      p.legF = { hx: CX + 3, hy: 44, kx: CX + 6, ky: 51, fx: CX + 8, fy: GY };
      p.armB = { sx: CX - 8, sy: 28, ex: CX - 10, ey: 36, hx: CX - 9, hy: 42 };
      p.armF = i === 0
        ? { sx: CX + 8, sy: 28, ex: CX + 12, ey: 20, hx: CX + 11, hy: 12 }
        : { sx: CX + 8, sy: 28, ex: CX + 12, ey: 18, hx: CX + 11, hy: 9 };
      return bakeHero(p);
    });

    return frames;
  }
  // 버스터 포구 오프셋 (스프라이트 좌상단 기준, 오른쪽 바라볼 때)
  S.heroMuzzle = {
    idleShoot: { x: 53, y: 30 }, runShoot: { x: 53, y: 29 }, dashShoot: { x: 55, y: 32 },
    jumpRiseShoot: { x: 53, y: 28 }, jumpApexShoot: { x: 53, y: 28 }, jumpFallShoot: { x: 53, y: 29 },
    wallShoot: { x: 11, y: 30 },
  };

  // ── 발사체 ─────────────────────────────────────────────
  function bakeBullets() {
    S.bullets = {};
    S.bullets.buster1 = [0, 1].map(i => NS.bake(16, 10, (g) => {
      R(g, 2, 3, 10, 4, P.cyan2); R(g, 4, 4, 8, 2, P.cyan3); R(g, 8, 4, 5, 2, P.white);
      if (i) { R(g, 0, 4, 3, 2, P.cyan2); }
    }));
    S.bullets.buster2 = [0, 1].map(i => NS.bake(24, 16, (g) => {
      NS.orb(g, 14, 8, 6, P.cyan2, P.cyan1, P.cyan3);
      R(g, 12, 6, 6, 4, P.white);
      R(g, 2, 6 - i, 8, 2, P.cyan2); R(g, 4, 9 + i, 6, 2, P.cyan2);
    }));
    S.bullets.buster3 = [0, 1].map(i => NS.bake(36, 20, (g) => {
      NS.orb(g, 24, 10, 8, P.violet2, P.violet1, P.violet3);
      NS.orb(g, 24, 10, 5, P.cyan2, P.cyan1, P.cyan3);
      R(g, 21, 8, 7, 4, P.white);
      R(g, 2, 5 + i, 14, 3, P.violet2); R(g, 6, 12 - i, 12, 3, P.violet3);
      R(g, 0, 9, 8, 2, P.cyan3);
    }));
    S.bullets.enemy = [0, 1].map(i => NS.bake(10, 10, (g) => {
      NS.orb(g, 5, 5, 3 + (i ? 0 : -0), P.magenta2, P.magenta1, P.magenta3);
      R(g, 4, 4, 2, 2, P.white);
    }));
    S.bullets.enemyBig = [0, 1].map(i => NS.bake(16, 16, (g) => {
      NS.orb(g, 8, 8, 5, P.magenta2, P.magenta1, P.magenta3);
      R(g, 6, 5 + i, 3, 3, P.white);
    }));
    // 마그마 버스트 (특수무기 1)
    S.bullets.magma = [0, 1].map(i => NS.bake(18, 18, (g) => {
      NS.orb(g, 9, 9, 6, P.orange2, P.red2, P.orange3);
      R(g, 6, 5 + i, 5, 4, P.yellow); R(g, 7 - i * 2, 12, 3, 3, P.red2);
      R(g, 13, 4 - i, 2, 2, P.orange3);
    }));
    // 프로스트 랜스 (특수무기 2)
    S.bullets.frost = [0, 1].map(i => NS.bake(26, 10, (g) => {
      R(g, 2, 3, 16, 4, P.cyan1);
      R(g, 4, 3, 14, 2, P.cyan3);
      // 창끝
      R(g, 18, 4, 4, 2, P.white); R(g, 22, 4, 2, 2, P.cyan3);
      R(g, 16, 2, 3, 2, P.white); R(g, 16, 6, 3, 2, P.white);
      if (i) R(g, 0, 4, 3, 2, P.cyan3);
    }));
    // 사이클론 커터 (특수무기 3, 회전 2프레임)
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
    // 보스 발사체
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
      NS.orb(g, 7, 7, 2, '#00000000', '#00000000', '#00000000');
      g.clearRect(5, 5, 4, 4);
      if (i) R(g, 6, 6, 2, 2, P.white);
    }));
  }

  // ── 아이템 ─────────────────────────────────────────────
  function bakeItems() {
    S.items = {};
    S.items.healthS = [0, 1].map(i => NS.bake(12, 12, (g) => {
      NS.box3(g, 2, 3 - i * 0, 8, 7, P.steel3, P.steel2, P.steel4);
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
    S.items.oneUp = [0].map(() => NS.bake(16, 16, (g) => {
      // 정면 헬멧 배지 (바이저 + 이마 센서)
      R(g, 3, 3, 10, 11, AP.main);
      R(g, 3, 3, 10, 2, AP.lite);
      R(g, 3, 11, 10, 3, AP.dark);
      R(g, 4, 7, 8, 4, AP.trimD);
      R(g, 5, 8, 6, 2, AP.glow);
      R(g, 6, 8, 2, 1, P.white);
      R(g, 7, 3, 2, 3, AP.gem);
    }));
    // 아머 캡슐 (열림/닫힘)
    S.items.capsule = [0, 1].map(i => NS.bake(32, 40, (g) => {
      NS.box3(g, 4, 30, 24, 7, P.steel2, P.steel1, P.steel3);
      R(g, 6, 4, 20, 27, P.night2);
      R(g, 6, 4, 20, 2, P.steel3);
      if (i) { // 가동 — 홀로그램 광
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
        // 링 소산
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
        NS.limb(g, 8, 8, 8 + Math.cos(th) * r, 8 + Math.sin(th) * r, 2, P.cyan3, P.cyan2, P.white);
      }
      if (i === 0) R(g, 7, 7, 3, 3, P.white);
    }));
    S.fx.muzzle = [0, 1].map(i => NS.bake(14, 14, (g) => {
      NS.orb(g, 7, 7, 4 - i, P.cyan3, P.cyan2, P.white);
      R(g, 5, 6, 6, 2, P.white);
    }));
  }

  NS.bakeCharacterSprites = () => {
    S.hero = heroPoses();
    bakeBullets();
    bakeItems();
    bakeFx();
  };
})();
