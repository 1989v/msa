/**
 * 황천 회귀 — 콘텐츠 데이터 (문장·적·계층·예언·허브 대사·메타 강화).
 *
 * 시스템(전투·진행)은 game.js, 표현(파티클·음향)은 fx.js 에 있고 여기는 **표**만 둔다.
 * 시나리오/스킬 개편은 이 파일 교체로 끝나는 구조가 목표다 (spec 1차 완성 후 개편 전제).
 */
(function () {
  'use strict';

  function lang() { return (window.GameI18n && GameI18n.lang) || 'ko'; }
  function tx(v) { return typeof v === 'string' ? v : (v[lang()] || v.ko); }

  /* ── 신격 4주 ─────────────────────────────────────────────────────────── */
  var GODS = {
    yeomra: { name: { ko: '염라대왕', en: 'King Yeomra' }, color: '#ff5c4a', sigil: 'flame',
      line: { ko: '「불꽃은 죄를 가리지 않는다.」', en: '"Flame does not choose its sins."' } },
    bari:   { name: { ko: '바리공주', en: 'Princess Bari' }, color: '#5ce8a8', sigil: 'flower',
      line: { ko: '「버려진 자가 길을 안다.」', en: '"The abandoned know the way."' } },
    gangnim:{ name: { ko: '강림차사', en: 'Gangnim' }, color: '#5cb8ff', sigil: 'bolt',
      line: { ko: '「걸음이 곧 목숨이다.」', en: '"Your stride is your life."' } },
    mago:   { name: { ko: '마고할미', en: 'Grandmother Mago' }, color: '#e8b45c', sigil: 'mountain',
      line: { ko: '「산은 서두르는 법이 없지.」', en: '"Mountains never hurry."' } },
  };

  /* ── 문장(Boon) — st 는 게임의 스탯 객체. v 는 희귀도 배수 적용값 ───────
   * 희귀도: 0 일반(1x) 1 희귀(1.5x) 2 영웅(2.25x) 3 전설(고유)
   */
  var RARITY = [
    { name: { ko: '일반', en: 'Common' }, color: '#c8d4e0', mul: 1 },
    { name: { ko: '희귀', en: 'Rare' }, color: '#5cb8ff', mul: 1.5 },
    { name: { ko: '영웅', en: 'Heroic' }, color: '#c07cff', mul: 2.25 },
    { name: { ko: '전설', en: 'Legendary' }, color: '#ffd54a', mul: 1 },
  ];

  var BOONS = [
    /* 염라 — 화염/처형 */
    { god: 'yeomra', key: 'brand', base: 28, name: { ko: '낙인', en: 'Brand' },
      desc: { ko: '공격이 {v}% 화상 피해를 3초간 남긴다', en: 'Attacks burn for {v}% over 3s' },
      apply: function (st, v) { st.burn += v / 100; } },
    { god: 'yeomra', key: 'wrath', base: 22, name: { ko: '진노', en: 'Wrath' },
      desc: { ko: '공격 피해 +{v}%', en: 'Attack damage +{v}%' },
      apply: function (st, v) { st.dmgMul += v / 100; } },
    { god: 'yeomra', key: 'pyre', base: 30, name: { ko: '화장(火葬)', en: 'Pyre' },
      desc: { ko: '강타(3연격 막타)가 폭발해 주변에 {v}% 피해', en: 'Final combo hit explodes for {v}%' },
      apply: function (st, v) { st.finisherBlast += v / 100; } },
    { god: 'yeomra', key: 'cinder', base: 35, name: { ko: '재의 숨', en: 'Cinder Breath' },
      desc: { ko: '투혼(캐스트) 피해 +{v}%, 화염구가 된다', en: 'Cast +{v}%, becomes a fireball' },
      apply: function (st, v) { st.castDmgMul += v / 100; st.castFire = true; } },
    { god: 'yeomra', key: 'stoke', base: 40, name: { ko: '불씨', en: 'Stoke' },
      desc: { ko: '화상 중인 적에게 주는 피해 +{v}%', en: '+{v}% damage to burning foes' },
      apply: function (st, v) { st.vsBurn += v / 100; } },
    { god: 'yeomra', key: 'judgement', legend: true, name: { ko: '염라의 심판', en: "Yeomra's Judgement" },
      desc: { ko: '체력 15% 이하의 적은 즉시 소멸한다', en: 'Foes below 15% HP are erased instantly' },
      apply: function (st) { st.execute = 0.15; } },

    /* 바리 — 생명 */
    { god: 'bari', key: 'root', base: 25, name: { ko: '생명뿌리', en: 'Life Root' },
      desc: { ko: '최대 체력 +{v}', en: 'Max HP +{v}' },
      apply: function (st, v) { st.maxHpAdd += v; } },
    { god: 'bari', key: 'dew', base
: 3, name: { ko: '이슬', en: 'Dew' },
      desc: { ko: '처치 시 체력 {v} 회복', en: 'Recover {v} HP on kill' },
      apply: function (st, v) { st.healOnKill += v; } },
    { god: 'bari', key: 'bloom', base: 14, name: { ko: '개화', en: 'Bloom' },
      desc: { ko: '방을 제압할 때마다 체력 {v} 회복', en: 'Recover {v} HP on room clear' },
      apply: function (st, v) { st.healOnClear += v; } },
    { god: 'bari', key: 'mercy', base: 30, name: { ko: '자비', en: 'Mercy' },
      desc: { ko: '모든 회복량 +{v}%', en: 'All healing +{v}%' },
      apply: function (st, v) { st.healMul += v / 100; } },
    { god: 'bari', key: 'thorn', base: 18, name: { ko: '꽃가시', en: 'Flower Thorn' },
      desc: { ko: '피격 시 주변에 {v} 반사 피해', en: 'Reflect {v} damage when hurt' },
      apply: function (st, v) { st.thorns += v; } },
    { god: 'bari', key: 'rebirth', legend: true, name: { ko: '바리의 환생', en: "Bari's Rebirth" },
      desc: { ko: '환생 1회 추가 — 쓰러지면 체력 60%로 되살아난다', en: '+1 Defiance — revive at 60% HP' },
      apply: function (st) { st.defy += 1; st.defyHeal = 0.6; } },

    /* 강림 — 대시/신속 */
    { god: 'gangnim', key: 'stride', base: 1, name: { ko: '차사의 걸음', en: "Reaper's Stride" },
      desc: { ko: '질주 충전 +1', en: '+1 dash charge' },
      apply: function (st, v) { st.dashCharges += Math.round(v); } },
    { god: 'gangnim', key: 'wake', base: 26, name: { ko: '흔적불', en: 'Wake' },
      desc: { ko: '질주 경로에 {v} 피해를 남긴다', en: 'Dashing deals {v} damage along the path' },
      apply: function (st, v) { st.dashDmg += v; } },
    { god: 'gangnim', key: 'haste', base: 12, name: { ko: '신행', en: 'Haste' },
      desc: { ko: '이동 속도 +{v}%', en: 'Move speed +{v}%' },
      apply: function (st, v) { st.moveSpd += v / 100; } },
    { god: 'gangnim', key: 'tempo', base: 20, name: { ko: '몰아치기', en: 'Tempo' },
      desc: { ko: '질주 후 2초간 공격 속도 +{v}%', en: '+{v}% attack speed for 2s after dash' },
      apply: function (st, v) { st.dashTempo += v / 100; } },
    { god: 'gangnim', key: 'breath', base: 15, name: { ko: '들숨', en: 'Inhale' },
      desc: { ko: '질주 재충전 {v}% 빨라진다', en: 'Dash recharges {v}% faster' },
      apply: function (st, v) { st.dashCd -= v / 100; } },
    { god: 'gangnim', key: 'ghostwalk', legend: true, name: { ko: '강림의 저승길', en: "Gangnim's Road" },
      desc: { ko: '질주 무적이 2배로 길어지고 적을 관통하며 {v} 피해', en: 'Dash i-frames doubled; pass through foes for damage' },
      apply: function (st) { st.dashIframe = 2; st.dashDmg += 40; } },

    /* 마고 — 대지/방어 */
    { god: 'mago', key: 'skin', base: 12, name: { ko: '돌살갗', en: 'Stone Skin' },
      desc: { ko: '받는 피해 -{v}%', en: 'Damage taken -{v}%' },
      apply: function (st, v) { st.armor += v / 100; } },
    { god: 'mago', key: 'shove', base: 40, name: { ko: '산밀치기', en: 'Mountain Shove' },
      desc: { ko: '넉백 +{v}% — 벽에 부딪힌 적은 {d} 피해', en: 'Knockback +{v}%; wall slams deal damage' },
      apply: function (st, v) { st.knockMul += v / 100; st.wallSlam += 14; } },
    { god: 'mago', key: 'toll', base: 25, name: { ko: '노잣값', en: 'Toll' },
      desc: { ko: '명전 획득 +{v}%', en: 'Coin gain +{v}%' },
      apply: function (st, v) { st.goldGain += v / 100; } },
    { god: 'mago', key: 'crag', base: 20, name: { ko: '바위그늘', en: 'Crag Shade' },
      desc: { ko: '피격 후 3초간 받는 피해 -{v}% (중첩 불가)', en: '-{v}% damage for 3s after being hit' },
      apply: function (st, v) { st.hurtGuard += v / 100; } },
    { god: 'mago', key: 'patience', base: 16, name: { ko: '기다림', en: 'Patience' },
      desc: { ko: '치명타 확률 +{v}% (1.5배 피해)', en: '+{v}% critical chance (1.5x)' },
      apply: function (st, v) { st.crit += v / 100; } },
    { god: 'mago', key: 'petrify', legend: true, name: { ko: '마고의 손바닥', en: "Mago's Palm" },
      desc: { ko: '피격 시 주변 적이 1.5초 석화된다', en: 'Foes nearby turn to stone for 1.5s when you are hurt' },
      apply: function (st) { st.petrify = 1.5; } },
  ];

  /* ── 단조(무기 강화) — 문 보상 '망치' ──────────────────────────────────── */
  var FORGE = [
    { key: 'edge', name: { ko: '벼린 날', en: 'Honed Edge' }, desc: { ko: '공격 피해 +8', en: 'Attack +8 flat' },
      apply: function (st) { st.dmgFlat += 8; } },
    { key: 'quick', name: { ko: '가벼운 자루', en: 'Light Haft' }, desc: { ko: '공격 속도 +18%', en: 'Attack speed +18%' },
      apply: function (st) { st.atkSpd += 0.18; } },
    { key: 'heavy', name: { ko: '무거운 강타', en: 'Heavy Finisher' }, desc: { ko: '강타 피해 +45%', en: 'Finisher +45%' },
      apply: function (st) { st.finisherMul += 0.45; } },
    { key: 'reach', name: { ko: '긴 칼끝', en: 'Long Reach' }, desc: { ko: '공격 범위 +20%', en: 'Attack range +20%' },
      apply: function (st) { st.reach += 0.2; } },
    { key: 'soul', name: { ko: '혼 그릇', en: 'Soul Vessel' }, desc: { ko: '투혼 충전 +1', en: '+1 cast charge' },
      apply: function (st) { st.castCharges += 1; } },
  ];

  /* ── 무기 — 하데스식 무기고. 콤보 프로필이 전투 리듬을 통째로 바꾼다 ────
   * unlock: 명전 해금 비용 (0 = 시작 무기). 콤보 t = 휘두름 시간(공속으로 나뉜다).
   */
  var WEAPONS = [
    { key: 'sword', unlock: 0, spr: 'weapon_regular_sword',
      name: { ko: '파쇄검', en: 'Sunder Blade' },
      desc: { ko: '균형 잡힌 3연격 — 마지막 타가 넓게 터진다', en: 'Balanced 3-hit combo with a wide finisher' },
      combo: [
        { dmg: 12, arc: 1.75, reach: 30, lunge: 110, t: 0.22 },
        { dmg: 12, arc: 1.75, reach: 30, lunge: 110, t: 0.22 },
        { dmg: 19, arc: 2.2, reach: 35, lunge: 150, t: 0.3, finisher: true },
      ] },
    { key: 'spear', unlock: 300, spr: 'weapon_spear',
      name: { ko: '흑창', en: 'Umbral Spear' },
      desc: { ko: '좁고 길다 — 찌르기 사거리가 검의 1.6배', en: 'Narrow thrusts with 1.6x reach' },
      combo: [
        { dmg: 11, arc: 0.85, reach: 48, lunge: 130, t: 0.2 },
        { dmg: 11, arc: 0.85, reach: 48, lunge: 130, t: 0.2 },
        { dmg: 22, arc: 1.0, reach: 56, lunge: 190, t: 0.3, finisher: true },
      ] },
    { key: 'twin', unlock: 800, spr: 'weapon_duel_sword',
      name: { ko: '쌍인', en: 'Twin Fangs' },
      desc: { ko: '짧고 빠른 4연격 — 몰아칠수록 강하다', en: 'Four rapid strikes, relentless up close' },
      combo: [
        { dmg: 8, arc: 1.6, reach: 24, lunge: 90, t: 0.15 },
        { dmg: 8, arc: 1.6, reach: 24, lunge: 90, t: 0.15 },
        { dmg: 8, arc: 1.6, reach: 24, lunge: 90, t: 0.15 },
        { dmg: 16, arc: 1.9, reach: 28, lunge: 130, t: 0.24, finisher: true },
      ] },
  ];

  /* ── 방 구조 — "맵이 하나"를 없앤다. 크기·모양·구덩이·기둥이 방마다 다르다.
   * aw/ah = 아레나 크기 (뷰 384×216 보다 크면 카메라가 따라간다).
   * pits = 이동 불가 구덩이 (타일 rect), cols = 기둥, spikes = 가시.
   */
  var LAYOUTS = [
    { key: 'court', aw: 512, ah: 288, cols: [[10, 6], [10, 11], [21, 6], [21, 11]], pits: [], crates: [[5, 4], [26, 13]], spikes: [] },
    { key: 'hall', aw: 704, ah: 240, cols: [[14, 7], [22, 7], [30, 7]], pits: [], crates: [[7, 5], [37, 9]], spikes: [[18, 4], [26, 10]] },
    { key: 'split', aw: 576, ah: 324, cols: [], pits: [[15, 8, 6, 4]], crates: [[4, 4], [31, 15]], spikes: [] },
    { key: 'quad', aw: 640, ah: 360, cols: [[9, 6], [9, 15], [29, 6], [29, 15]], pits: [[18, 10, 4, 2]], crates: [], spikes: [[5, 11], [34, 11]] },
    { key: 'lane', aw: 768, ah: 288, cols: [], pits: [[11, 5, 3, 8], [33, 5, 3, 8]], crates: [[23, 8]], spikes: [[19, 4], [27, 13]] },
    { key: 'cross', aw: 576, ah: 324, cols: [[17, 9], [18, 10]], pits: [[6, 4, 4, 3], [26, 13, 4, 3]], crates: [], spikes: [[17, 15]] },
    { key: 'den', aw: 448, ah: 252, cols: [[13, 7]], pits: [], crates: [[4, 3], [22, 11]], spikes: [[8, 10], [19, 4]] },
    { key: 'pillars', aw: 640, ah: 324, cols: [[8, 5], [16, 8], [24, 5], [32, 8], [12, 14], [20, 11], [28, 14]], pits: [], crates: [], spikes: [] },
    { key: 'grand', aw: 832, ah: 396, cols: [[12, 7], [12, 17], [39, 7], [39, 17], [25, 12]], pits: [[20, 5, 3, 3], [29, 16, 3, 3]], crates: [[6, 5], [45, 19]], spikes: [[16, 12], [35, 12]] },
  ];

  /* ── 적 — AI 는 game.js 의 kind 스위치, 여기는 수치만 ─────────────────── */
  var ENEMIES = {
    imp:    { spr: 'imp', hp: 30, spd: 100, dmg: 12, r: 5, coin: 2, atkCd: 1.2, tele: 0.32 },
    skelet: { spr: 'skelet', hp: 26, spd: 66, dmg: 10, r: 5, coin: 2, atkCd: 1.9, tele: 0.38, ranged: true },
    chort:  { spr: 'chort', hp: 38, spd: 74, dmg: 10, r: 6, coin: 3, atkCd: 2.2, tele: 0.42, ranged: true, spread: 3 },
    orc:    { spr: 'masked_orc', hp: 68, spd: 54, dmg: 18, r: 7, coin: 4, atkCd: 2.6, tele: 0.5, charger: true },
    necro:  { spr: 'necromancer', hp: 52, spd: 48, dmg: 11, r: 6, coin: 6, atkCd: 3.0, tele: 0.46, summoner: true },
    wogol:  { spr: 'wogol', hp: 42, spd: 84, dmg: 13, r: 6, coin: 4, atkCd: 1.7, tele: 0.36, blinker: true },
  };

  var BOSSES = {
    ogre:   { spr: 'ogre', name: { ko: '오거 문지기', en: 'Ogre Gatekeeper' }, hp: 520, spd: 52, r: 12, coin: 60, scale: 1 },
    bigzomb:{ spr: 'big_zombie', name: { ko: '망자 거인', en: 'Giant of the Dead' }, hp: 880, spd: 46, r: 13, coin: 90, scale: 1.1 },
    demon:  { spr: 'big_demon', name: { ko: '재의 군주', en: 'Lord of Ash' }, hp: 1350, spd: 58, r: 14, coin: 150, scale: 1.25 },
  };

  /* ── 계층 ──────────────────────────────────────────────────────────────── */
  var TIERS = [
    { name: { ko: '재의 뜰', en: 'Ashen Court' }, floor: '#8a86a8', mood: 'rgba(10,8,24,.36)',
      light: '#ff9a5c', roster: ['imp', 'skelet'], boss: 'ogre', rooms: 8 },
    { name: { ko: '핏빛 회랑', en: 'Crimson Gallery' }, floor: '#a87878', mood: 'rgba(24,6,10,.36)',
      light: '#ff6a4a', roster: ['imp', 'skelet', 'chort', 'orc'], boss: 'bigzomb', rooms: 8 },
    { name: { ko: '망각의 옥좌', en: 'Throne of Oblivion' }, floor: '#6a8a92', mood: 'rgba(4,14,20,.4)',
      light: '#6ae0ff', roster: ['chort', 'orc', 'wogol', 'necro'], boss: 'demon', rooms: 8 },
  ];

  /* ── 예언 목록 (하데스 Fated List) — check(S) 는 세이브를 보고 달성 판정 ── */
  var PROPH = [
    { id: 'first_kill', reward: 40, name: { ko: '첫 원혼', en: 'First Soul' },
      desc: { ko: '황천의 원혼을 처음으로 벤다', en: 'Fell your first shade' },
      check: function (S) { return S.proph.kills >= 1; } },
    { id: 'kills_300', reward: 200, name: { ko: '원혼 삼백', en: 'Three Hundred Souls' },
      desc: { ko: '누적 300 처치', en: '300 total kills' },
      check: function (S) { return S.proph.kills >= 300; } },
    { id: 'boss_1', reward: 120, name: { ko: '문지기를 넘어', en: 'Past the Gatekeeper' },
      desc: { ko: '오거 문지기 격파', en: 'Defeat the Ogre Gatekeeper' },
      check: function (S) { return !!S.proph.flags.boss1; } },
    { id: 'boss_2', reward: 220, name: { ko: '거인의 무릎', en: 'The Giant Kneels' },
      desc: { ko: '망자 거인 격파', en: 'Defeat the Giant of the Dead' },
      check: function (S) { return !!S.proph.flags.boss2; } },
    { id: 'victory', reward: 500, name: { ko: '이승의 빛', en: 'Light of the Living' },
      desc: { ko: '재의 군주를 꺾고 귀환', en: 'Defeat the Lord of Ash and return' },
      check: function (S) { return S.clears >= 1; } },
    { id: 'boons_8', reward: 120, name: { ko: '여덟 문장', en: 'Eight Sigils' },
      desc: { ko: '한 번의 탈주에서 문장 8개', en: '8 boons in one escape' },
      check: function (S) { return !!S.proph.flags.boons8; } },
    { id: 'all_gods', reward: 150, name: { ko: '네 신격의 총애', en: 'Favor of Four' },
      desc: { ko: '한 런에 네 신격의 문장을 모두', en: 'Boons from all four gods in one run' },
      check: function (S) { return !!S.proph.flags.allGods; } },
    { id: 'no_hit_5', reward: 150, name: { ko: '스치지 않는 자', en: 'Untouched' },
      desc: { ko: '무피격으로 연속 5개 방 제압', en: 'Clear 5 rooms in a row untouched' },
      check: function (S) { return !!S.proph.flags.noHit5; } },
    { id: 'rooms_50', reward: 150, name: { ko: '긴 회랑', en: 'The Long Gallery' },
      desc: { ko: '누적 50개 방 제압', en: 'Clear 50 rooms total' },
      check: function (S) { return S.proph.rooms >= 50; } },
    { id: 'legend', reward: 180, name: { ko: '전설의 증인', en: 'Witness of Legend' },
      desc: { ko: '전설 문장을 획득한다', en: 'Obtain a legendary boon' },
      check: function (S) { return !!S.proph.flags.legend; } },
  ];

  /* ── 허브 대사 — 뱃사공 (런 횟수·진행으로 갱신되는 최소 내러티브) ──────── */
  var STORY = [
    { at: function (S) { return S.runs === 0; },
      t: { ko: '「…또 하나 떠내려왔군. 이승 냄새가 나. 돌아가고 싶나? 그럼 베어라. 저 문 너머의 것들을, 전부.」',
           en: '"...Another one washed ashore. You reek of the living. Want to go back? Then cut. Everything beyond that gate."' } },
    { at: function (S) { return S.runs === 1; },
      t: { ko: '「한 번 죽었다고 끝이 아니야. 여긴 황천이다 — 죽음이 출발선이지.」',
           en: '"One death is no ending here. This is the Netherworld — death is the starting line."' } },
    { at: function (S) { return S.runs >= 2 && !S.proph.flags.boss1; },
      t: { ko: '「문지기 오거 말인가. 놈의 발밑이 갈라질 때, 그 자리에 서 있지 마라.」',
           en: '"The Ogre? When the ground splits beneath him — don\'t be standing there."' } },
    { at: function (S) { return !!S.proph.flags.boss1 && !S.proph.flags.boss2; },
      t: { ko: '「문지기를 넘었다고? …오랜만이군, 그 문이 열리는 소리는. 핏빛 회랑은 예의가 없다. 조심해.」',
           en: '"Past the Gatekeeper? ...Been a while since that door sang. The Crimson Gallery has no manners."' } },
    { at: function (S) { return !!S.proph.flags.boss2 && S.clears === 0; },
      t: { ko: '「재의 군주는 이 강의 주인이다. 놈을 벤 자는… 아니, 직접 확인해라.」',
           en: '"The Lord of Ash owns this river. The one who cut him... no. See for yourself."' } },
    { at: function (S) { return S.clears === 1; },
      t: { ko: '「돌아왔군. 이승의 빛은 어땠나? …또 올 거면서. 다들 그래. 강은 언제나 여기 있다.」',
           en: '"You came back. How was the light? ...You\'ll return. They all do. The river is always here."' } },
    { at: function (S) { return S.clears >= 3; },
      t: { ko: '「이제 강물이 네 이름을 안다. 명예로운 일인지는… 글쎄.」',
           en: '"The river knows your name now. Whether that\'s an honor... who can say."' } },
  ];

  /* ── 메타 강화 (GameMeta 표) ──────────────────────────────────────────── */
  var META_UP = [
    { key: 'hp', max: 5, cost: function (l) { return 30 + l * 25; },
      label: { ko: '체력 문패 (+12 체력)', en: 'Name Plate (+12 HP)' } },
    { key: 'dmg', max: 5, cost: function (l) { return 40 + l * 30; },
      label: { ko: '제물검 (+6% 공격)', en: 'Offering Blade (+6% ATK)' } },
    { key: 'dash', max: 2, cost: function (l) { return 120 + l * 180; },
      label: { ko: '차사 신발 (+1 질주)', en: "Reaper's Shoes (+1 dash)" } },
    { key: 'defy', max: 2, cost: function (l) { return 150 + l * 250; },
      label: { ko: '환생부 (+1 환생)', en: 'Rebirth Charm (+1 defiance)' } },
    { key: 'gold', max: 3, cost: function (l) { return 50 + l * 40; },
      label: { ko: '노잣돈 (시작 명전 +40)', en: 'Fare (+40 starting coins)' } },
  ];

  window.DATA = {
    GODS: GODS, BOONS: BOONS, FORGE: FORGE, RARITY: RARITY,
    ENEMIES: ENEMIES, BOSSES: BOSSES, TIERS: TIERS, LAYOUTS: LAYOUTS, WEAPONS: WEAPONS,
    PROPH: PROPH, STORY: STORY, META_UP: META_UP,
    tx: tx, lang: lang,
  };
})();
