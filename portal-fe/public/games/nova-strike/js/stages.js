// NOVA STRIKE — stages: 4개 지역 (마그마/빙결/폭풍/코어) — 지형·기믹·적·숨김 요소
// 맵은 빌더 DSL 로 생성 (H=34 행, 폭 228 타일 = 3648px, 보스방 = 정확히 1화면 960px)
'use strict';
(function () {
  const T = NS.TILE;
  const H = 34, W = 228;
  const GY = 30;              // 기본 지면 상단 행
  const ARENA_X0 = 168, ARENA_X1 = 228;   // 보스방 = 정확히 1화면 (60타일 = 960px)

  function builder() {
    const g = Array.from({ length: H }, () => Array(W).fill('.'));
    const B = {
      grid: g,
      set(x, y, ch) { if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = ch; },
      fill(x, y, w, h, ch) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, ch); },
      ground(x0, x1, top) {
        top = top === undefined ? GY : top;
        this.fill(x0, top, x1 - x0, 1, '#');
        this.fill(x0, top + 1, x1 - x0, H - top - 1, '%');
      },
      clearCol(x0, x1, yTop) { this.fill(x0, yTop === undefined ? 0 : yTop, x1 - x0, H - (yTop || 0), '.'); },
      plat(x, y, w) { this.fill(x, y, w, 1, '#'); },
      oneway(x, y, w) { this.fill(x, y, w, 1, '='); },
      crumble(x, y, w) { this.fill(x, y, w, 1, 'c'); },
      conveyor(x, y, w, dir) { this.fill(x, y, w, 1, dir > 0 ? '>' : '<'); },
      ice(x, y, w) { this.fill(x, y, w, 1, 'I'); },
      spikes(x0, x1, y) { this.fill(x0, y, x1 - x0, 1, '^'); },
      ceilSpikes(x0, x1, y) { this.fill(x0, y, x1 - x0, 1, 'v'); },
      lava(x0, x1, top) {
        this.fill(x0, top, x1 - x0, 1, '~');
        this.fill(x0, top + 1, x1 - x0, H - top - 1, '-');
      },
      wall(x, y0, y1) { this.fill(x, y0, 1, y1 - y0, '#'); },
      breakable(x, y, w, h) { this.fill(x, y, w, h, 'B'); },
      rows() { return g.map(r => r.join('')); },
    };
    return B;
  }

  // 보스방 공통 (평지 + 양벽 + 천장 + 문기둥) — 문 개구부(24~29행)는 열린 채 시작,
  // 입장 트리거 후 game.js 가 닫는다
  const DOOR_COL = ARENA_X0 - 3;
  function bossRoom(B) {
    B.ground(DOOR_COL, ARENA_X1, GY);
    B.fill(ARENA_X1 - 1, 0, 1, H, '%');                          // 우측 끝벽
    B.fill(DOOR_COL, 0, ARENA_X1 - DOOR_COL, 9, '%');            // 천장 위 통짜 매스 (지붕 워킹 봉쇄)
    B.fill(DOOR_COL, 9, ARENA_X1 - DOOR_COL, 1, '#');            // 천장
    B.fill(DOOR_COL, 10, 1, 14, '#');                            // 문기둥 (개구부 위)
    B.plat(ARENA_X0 + 4, 27, 3);                                 // 회피용 사이드 플랫폼 (일반 점프 도달)
    B.plat(ARENA_X1 - 8, 27, 3);
  }
  const ARENA = { x0: ARENA_X0 * T, y0: GY * T + 32 - NS.VH, x1: ARENA_X1 * T, y1: GY * T };

  NS.STAGES = {
    // ═══════════ 마그마 제련구역 ═══════════
    magma: {
      id: 'magma', theme: 'magma', bgm: 'magma',
      name: '마그마 제련구역', bossName: '이그니스 몰록', boss: 'moloch',
      desc: '용광로 컨베이어와 상승 용암. 격파 시 「마그마 버스트」 획득.',
      playerStart: { x: 3 * T, y: 26 * T },
      lavaChase: { startX: 104 * T, endX: 142 * T, fromY: 33 * T, minY: 20 * T, speed: 0.26 },
      build() {
        const B = builder();
        // A. 도입부 — 평지 + 계단
        B.ground(0, 46, GY);
        B.plat(12, 26, 4); B.plat(20, 24, 4); B.plat(28, 26, 4);
        B.conveyor(36, GY, 8, 1); B.fill(36, GY + 1, 8, H - GY - 1, '%');
        // B. 용암 지대 — 징검다리
        B.lava(46, 72, 31);
        B.plat(47, 28, 4); B.plat(53, 26, 4); B.plat(59, 28, 4); B.plat(64, 25, 3); B.plat(68, 27, 4);
        // 하트 탱크 루트 (좌측 상단 점프 사다리)
        B.plat(49, 22, 2); B.plat(46, 19, 2); B.plat(52, 17, 4);
        // C. 컨베이어 공장
        B.ground(72, 104, GY);
        B.conveyor(76, GY, 12, -1); B.conveyor(90, GY, 8, 1);
        B.plat(84, 25, 4);
        B.ceilSpikes(90, 96, 22); B.fill(90, 20, 14, 2, '#');
        // 비밀 알코브 (부서지는 블록 뒤 1UP)
        B.breakable(97, 27, 1, 3); B.fill(98, 26, 4, 1, '#'); B.fill(101, 27, 1, 3, '#'); B.fill(98, GY, 3, 1, '#');
        // D. 상승 샤프트 (용암 추격) — 우상향 대시점프 체인
        B.ground(104, 108, 28);
        B.ground(108, 142, 31);   // 샤프트 하부 바닥 — 낙하 즉사 대신 용암 압박 + 재등반
        B.plat(109, 25, 3); B.plat(113, 22, 3); B.plat(117, 19, 3); B.plat(121, 17, 4);
        // 시크릿: 좌측 상단 캡슐 알코브 (부스터 파츠) — 왼쪽 역주행 루트
        B.plat(107, 19, 2); B.plat(102, 16, 3);
        B.wall(99, 10, 16); B.fill(99, 10, 6, 1, '#'); B.plat(100, 13, 4);
        // 상단 회랑 →
        B.plat(126, 15, 8); B.plat(137, 13, 6);
        B.ceilSpikes(126, 132, 8); B.fill(122, 6, 24, 2, '#');
        // E. 하강 + 최종 회랑
        B.plat(146, 17, 3); B.plat(151, 21, 3); B.plat(147, 25, 3);
        B.ground(142, DOOR_COL + 1, GY);
        B.clearCol(158, 163, GY); B.lava(158, 163, 31);
        B.plat(159, 27, 3);
        bossRoom(B);
        return B.rows();
      },
      enemies: [
        ['walker', 22, GY], ['spitter', 28, GY], ['walker', 35, GY],
        ['spitter', 60, 27], ['wisp', 76, 24],
        ['walker', 80, GY], ['turret', 87, 25], ['bomber', 94, GY],
        ['walker', 128, 13], ['wisp', 133, 10],
        ['bomber', 146, GY], ['shield', 150, GY], ['turret', 156, GY], ['spitter', 160, 26],
      ],
      items: [
        ['heart', 53, 16, 'mg-heart'],
        ['capsule', 101, 12, 'mg-caps', 'boots'],
        ['oneUp', 99, GY - 1, null],
        ['healthL', 122, 15, null],
      ],
      checkpoints: [[74, GY], [144, GY], [163, GY]],
    },

    // ═══════════ 빙결 연구동 ═══════════
    cryo: {
      id: 'cryo', theme: 'cryo', bgm: 'cryo',
      name: '빙결 연구동', bossName: '글레이셔 팬텀', boss: 'phantom',
      desc: '미끄러운 빙판과 고드름. 격파 시 「프로스트 랜스」 획득.',
      playerStart: { x: 3 * T, y: 26 * T },
      build() {
        const B = builder();
        // A. 빙판 도입 — 상승 계단으로 샤프트 상단 진입
        B.ground(0, 40, GY);
        B.ice(6, GY, 30);
        B.plat(14, 25, 4); B.ice(14, 25, 4);
        B.plat(24, 23, 4);
        B.plat(32, 20, 4); B.plat(37, 17, 4);
        // B. 하강 샤프트 (고드름 + 붕괴 발판) — 상단 개방, 지그재그 하강
        B.ground(40, 44, GY);
        B.clearCol(44, 76);
        B.fill(40, 6, 36, 2, '#');
        B.wall(43, 19, GY + 1);        // 샤프트 좌벽 (상단 개방 — 계단에서 넘어 들어온다)
        B.wall(76, 8, 18);
        B.plat(46, 17, 4); B.crumble(52, 20, 3); B.plat(56, 23, 5); B.crumble(63, 26, 3); B.plat(68, 28, 5);
        B.ceilSpikes(50, 74, 8);
        B.spikes(44, 76, 32); B.fill(44, 33, 32, 1, '#');
        B.plat(46, 28, 4); B.plat(60, 29, 4);
        // 하트 탱크: 샤프트 왼쪽 아래 부서지는 벽 뒤
        B.breakable(46, 25, 1, 2);
        B.wall(44, 22, 27); B.plat(44, 27, 2);
        // C. 연구 회랑 (실내)
        B.ground(76, 116, GY);
        B.fill(76, 18, 42, 2, '#');
        B.ice(84, GY, 24);
        B.plat(90, 26, 4); B.plat(100, 24, 4);
        // 서브 탱크: 회랑 높은 선반 (월점프)
        B.wall(111, 20, 27); B.plat(108, 22, 3);
        B.plat(112, 21, 4);
        // D. 스파이크 계곡 (빙판 정밀 점프)
        B.clearCol(118, 146);
        B.spikes(118, 146, 32); B.fill(118, 33, 28, 1, '#');
        B.plat(119, 28, 3); B.ice(119, 28, 3);
        B.crumble(125, 26, 3); B.plat(131, 24, 3); B.ice(131, 24, 3);
        B.crumble(137, 26, 3); B.plat(142, 28, 3);
        // E. 최종 접근
        B.ground(146, DOOR_COL + 1, GY);
        B.ice(150, GY, 15);
        B.plat(156, 25, 4); B.plat(161, 23, 3);
        bossRoom(B);
        B.ice(ARENA_X0, GY, ARENA_X1 - ARENA_X0 - 1); // 보스방 빙판
        return B.rows();
      },
      enemies: [
        ['wisp', 12, 26], ['sentry', 22, GY], ['walker', 30, GY],
        ['sentry', 48, 27], ['wisp', 62, 24],
        ['turret', 88, 25], ['shield', 96, GY], ['sentry', 106, GY],
        ['wisp', 124, 22], ['glider', 134, 20],
        ['walker', 154, GY], ['bomber', 158, GY], ['sentry', 162, GY], ['wisp', 163, 24],
      ],
      items: [
        ['heart', 44, 26, 'cr-heart'],
        ['subtank', 113, 20, 'cr-sub'],
        ['healthL', 71, 23, null],
        ['energy', 143, 27, null],
      ],
      checkpoints: [[78, GY], [148, GY], [163, GY]],
    },

    // ═══════════ 폭풍 공중정원 ═══════════
    storm: {
      id: 'storm', theme: 'storm', bgm: 'storm',
      name: '폭풍 공중정원', bossName: '템페스트 로크', boss: 'roc',
      desc: '상승 기류와 붕괴 발판, 낙뢰. 격파 시 「사이클론 커터」 획득.',
      playerStart: { x: 3 * T, y: 26 * T },
      windZones: [
        { x0: 34 * T, x1: 38 * T, y0: 8 * T, y1: 33 * T, fy: -0.55 },
        { x0: 62 * T, x1: 66 * T, y0: 6 * T, y1: 33 * T, fy: -0.55 },
        { x0: 126 * T, x1: 130 * T, y0: 4 * T, y1: 30 * T, fy: -0.6 },
      ],
      build() {
        const B = builder();
        // A. 출발 정원 (부유 지반 — 추락사 구간)
        B.ground(0, 16, GY);
        B.plat(19, 28, 4); B.plat(26, 26, 4);
        // 상승기류 1 → 상단 콜로네이드
        B.plat(39, 18, 6); B.plat(48, 16, 6); B.crumble(56, 16, 4);
        // 상승기류 2 → 더 위
        B.plat(67, 12, 6); B.plat(76, 12, 8); B.plat(87, 14, 6);
        // 하트 탱크: 기류 2 최상단 왼쪽 (역방향 대시 점프)
        B.plat(58, 6, 4);
        // B. 중단 정원 (내려가는 길)
        B.plat(95, 17, 5); B.crumble(102, 20, 3); B.plat(107, 23, 5);
        B.ground(114, 134, GY);
        B.plat(118, 25, 4); B.plat(124, 22, 3);
        // 캡슐(버스터): 메인길 아래 숨은 선반 — 132 절벽에서 낙하 후 좌측 대시
        B.plat(128, 32, 5);
        // 상승기류 3 으로 복귀
        // C. 붕괴 브리지 런
        B.plat(134, 14, 4);
        B.crumble(140, 14, 3); B.crumble(145, 15, 3); B.crumble(150, 14, 3); B.crumble(155, 16, 3);
        B.plat(160, 17, 4);
        // D. 최종 접근 — 붕괴 런 끝에서 지상으로 강하
        B.ground(161, DOOR_COL + 1, GY);
        bossRoom(B);
        return B.rows();
      },
      enemies: [
        ['walker', 8, GY], ['glider', 22, 24],
        ['glider', 44, 14], ['turret', 50, 15], ['wisp', 58, 12],
        ['glider', 72, 8], ['shield', 78, 12], ['turret', 90, 13],
        ['glider', 100, 14], ['bomber', 120, GY], ['glider', 128, 18],
        ['glider', 146, 10], ['wisp', 152, 10], ['turret', 158, 16], ['walker', 163, GY],
      ],
      items: [
        ['heart', 59, 5, 'st-heart'],
        ['capsule', 130, 31, 'st-caps', 'buster'],
        ['healthL', 77, 11, null],
        ['energy', 161, 16, null],
      ],
      checkpoints: [[76, 12], [115, GY], [163, GY]],
    },

    // ═══════════ 코어 스파이어 (최종) ═══════════
    core: {
      id: 'core', theme: 'core', bgm: 'core',
      name: '코어 스파이어', bossName: '카이로스', boss: 'kairos1',
      desc: '카이로스의 본체. 모든 기술이 시험대에 오른다.',
      locked: true,
      playerStart: { x: 3 * T, y: 26 * T },
      build() {
        const B = builder();
        // A. 진입 회랑
        B.ground(0, 30, GY);
        B.fill(0, 14, 30, 2, '#');
        B.plat(10, 26, 4); B.plat(18, 24, 4);
        // B. 1차 수직 상승 (월점프 샤프트)
        B.ground(30, 34, GY);
        B.wall(30, 4, GY); B.wall(41, 4, 24);
        B.plat(32, 26, 3); B.plat(37, 23, 3); B.plat(32, 20, 3); B.plat(37, 17, 3); B.plat(32, 14, 3);
        B.spikes(34, 41, 29); B.fill(34, GY, 7, 1, '#');
        // 상단 회랑
        B.plat(41, 10, 20); B.fill(44, 2, 60, 2, '#');
        B.ceilSpikes(50, 56, 4);
        // C. 컨베이어+가시 복합
        B.plat(64, 12, 4);
        B.conveyor(70, 14, 10, -1); B.spikes(70, 15, 13); // 컨베이어 아래 빈공간
        B.plat(83, 14, 5); B.crumble(90, 13, 3); B.plat(95, 12, 5);
        // 낙하 샤프트
        B.clearCol(102, 112, 4);
        B.wall(101, 12, 30); B.wall(112, 4, 26);
        B.ceilSpikes(103, 111, 30); B.fill(102, 31, 10, 1, '#');
        B.plat(103, 27, 2); B.crumble(107, 22, 3); B.plat(103, 17, 2);
        // 통로 (아래로 이어짐)
        B.fill(110, 26, 2, 1, '#');
        // D. 하부 회랑 — 총력전
        B.ground(112, DOOR_COL + 1, GY);
        B.fill(112, 18, 53, 2, '#');
        B.plat(120, 26, 4); B.conveyor(128, GY, 10, -1);
        B.plat(140, 25, 4); B.spikes(146, 152, 29); B.fill(146, GY, 6, 1, '#');
        B.plat(147, 26, 3);
        B.plat(156, 24, 4); B.plat(162, 26, 3);
        bossRoom(B);
        return B.rows();
      },
      enemies: [
        ['walker', 8, GY], ['turret', 14, 25], ['shield', 24, GY],
        ['sentry', 45, 10], ['wisp', 52, 6], ['bomber', 57, 10],
        ['glider', 68, 8], ['turret', 85, 13], ['wisp', 92, 8],
        ['shield', 122, GY], ['spitter', 134, GY], ['sentry', 142, GY],
        ['bomber', 154, GY], ['turret', 160, 23], ['walker', 157, GY], ['glider', 163, 21],
      ],
      items: [
        ['healthL', 33, 13, null],
        ['energy', 96, 11, null],
        ['oneUp', 104, 16, null],
        ['healthL', 148, 25, null],
      ],
      checkpoints: [[43, 9], [114, GY], [163, GY]],
    },
  };
  NS.ARENA = ARENA;
  NS.DOOR_COL = DOOR_COL;
  NS.STAGE_ORDER = ['magma', 'cryo', 'storm', 'core'];

  // 체크포인트 비콘 스프라이트
  NS.bakeStageSprites = () => {
    const P = NS.PAL;
    NS.Sprites.beacon = [0, 1].map(f => NS.bake(16, 32, (g) => {
      const R2 = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
      R2(5, 24, 6, 6, P.steel2); R2(5, 24, 6, 1, P.steel4);
      R2(7, 6, 2, 18, P.steel3); R2(7, 6, 1, 18, P.steel4);
      NS.orb(g, 8, 5, 4, f ? P.cyan2 : P.steel2, P.steel1, f ? P.cyan3 : P.steel3);
      if (f) R2(6, 3, 2, 2, P.white);
    }));
  };
})();
