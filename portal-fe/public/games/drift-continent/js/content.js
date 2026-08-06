'use strict';
(function () {
/**
 * 표류 대륙 (Drift Continent) — 콘텐츠 데이터 레이어.
 *
 * 아이템 / 적 / 스킬 / NPC 대사 / 퀘스트 / 상점 테이블만 담는다. 로직 없음.
 * 가장 먼저 로드되며 DC 네임스페이스를 만든다.
 *
 * 다국어 규칙
 *  - UI 크롬(버튼·패널 제목·힌트)은 GameI18n 사전(DC.STR) 사용
 *  - 콘텐츠 문자열(아이템명·대사·퀘스트)은 {ko,en} 인라인 객체 + DC.tx() 로 해석
 *    → 키 폭발 없이 대사량을 늘릴 수 있다
 */
var DC = window.DC || (window.DC = {});

/** {ko,en} 객체(또는 평문)를 현재 언어 문자열로 해석 */
DC.tx = function (o) {
  if (o == null) return '';
  if (typeof o === 'string') return o;
  var l = (window.GameI18n && window.GameI18n.lang) || 'ko';
  return o[l] || o.ko || '';
};

/** "{n}" 치환 */
DC.sub = function (s, vars) {
  return String(s).replace(/\{(\w+)\}/g, function (m, k) {
    return vars && vars[k] != null ? vars[k] : m;
  });
};

/* ══════════════════════════ UI 문자열 ══════════════════════════ */
DC.STR = {
  ko: {
    gameTitle: '🌊 표류 대륙',
    tagline: '난파선에서 눈을 떴다. 등대는 아직 꺼져 있다.',
    newBtn: '새 여정', contBtn: '이어하기', importBtn: '📂 파일 불러오기',
    menuFoot: 'WASD 이동 · Space 공격 · Shift 회피 · Q/E 스킬 · F 상호작용 · I 가방 · T 기술 · L 일지 · Esc 메뉴',
    noSave: '저장된 여정이 없다',
    loadedSave: '여정을 이어간다',
    hudLv: 'Lv', hudGold: '금화',
    invTitle: '🎒 가방', equipTitle: '장비', statTitle: '능력치',
    skillTitle: '🌿 기술의 나무', questTitle: '📜 여정 일지', shopTitle: '🛒 상점',
    innTitle: '🛏️ 표착항 여관', pauseTitle: '⏸ 잠시 멈춤',
    deathTitle: '💀 파도에 삼켜졌다', clearTitle: '🔥 등대에 불이 들어왔다',
    closeBtn: '닫기 (Esc)', resumeBtn: '계속하기', saveBtn: '💾 저장', exportBtn: '⬇ 내보내기',
    backBtn: '처음으로', againBtn: '🔁 마을에서 다시', restBtn: '휴식 (30 금화)',
    freeRestBtn: '휴식하고 저장', buyBtn: '구매', sellBtn: '판매', equipBtn: '장착', useBtn: '사용',
    learnBtn: '익히기', talkBtn: '대화',
    slotWeapon: '무기', slotArmor: '방어구', slotTrinket: '장신구', slotEmpty: '— 비어 있음 —',
    stStr: '힘', stAgi: '민첩', stVit: '체력', stWil: '의지',
    stAtk: '공격력', stDef: '방어력', stCrit: '치명', stSpd: '속도',
    spLeft: '기술 점수 {n}', spNone: '기술 점수 없음',
    reqLv: 'Lv {n} 필요', reqPrev: '앞 기술 필요', learned: '익힘',
    qActive: '진행 중', qDone: '완료', qReady: '보고 가능', qNone: '받은 의뢰가 없다',
    invEmpty: '가방이 비었다', invFull: '가방이 가득 찼다',
    goldShort: '금화가 모자란다', bought: '구매했다', sold: '팔았다', equipped: '장착했다',
    saved: '기록했다', autoSaved: '자동 기록', exported: '파일로 내보냈다', imported: '불러왔다',
    importFail: '세이브 파일을 읽지 못했다',
    hintMove: '방향키 / WASD 로 움직인다',
    hintAttack: 'Space 3연타 — 마지막 타격이 가장 무겁다',
    hintDash: 'Shift 회피 — 구르는 동안은 맞지 않는다',
    hintTalk: 'F — 말을 건다',
    hintSkill: 'Q 회오리 · E 파도 창 — 의지를 쓴다',
    hintShield: '방패는 앞만 막는다 — 등 뒤를 노리거나 3타 마무리로 뚫어라',
    hintPotion: '1 회복약 · 2 의지 회복',
    hintLocked: '잠겨 있다 — 열쇠가 필요하다',
    hintUnlocked: '열쇠로 문을 열었다',
    hintNeedQuest: '아직 들어갈 이유가 없다 — 촌장에게 물어보자',
    hintHerb: 'F — 약초를 캔다',
    hintChest: 'F — 상자를 연다',
    hintStairsDown: 'F — 아래로 내려간다',
    hintStairsUp: 'F — 위로 올라간다',
    hintExit: 'F — 밖으로 나간다',
    hintLevel: '레벨 {n} — T 를 눌러 기술을 익힌다',
    hintQuestNew: '📜 새 의뢰: {n}',
    hintQuestDone: '✅ 의뢰 완료: {n}',
    hintGot: '{n} 획득',
    hintFullBag: '가방이 가득 차 줍지 못했다',
    hintNoMp: '의지가 모자란다',
    hintSave: '💾 기록했다',
    bossName: '등대지기 망령',
    phase2: '— 망령이 등불을 삼킨다 —',
    deathDesc: '표착항 여관에서 다시 눈을 뜬다. 금화 절반을 잃었다.',
    clearDesc: '망령은 흩어지고 등대에 불이 돌아왔다. 표류 대륙의 첫 장이 끝났다.',
    resultLine: 'Lv {lv} · 의뢰 {q}/4 · 처치 {k} · 점수 {s}',
    zoneEnter: '— {n} —',
    payRest: '30 금화를 내고 쉬었다',
    restDone: '충분히 쉬었다. 여정이 기록됐다',
    shopEmpty: '오늘은 물건이 없다',
    dlgClose: '(대화를 끝낸다)',
  },
  en: {
    gameTitle: '🌊 Drift Continent',
    tagline: 'You wake on a wreck. The lighthouse is still dark.',
    newBtn: 'New Journey', contBtn: 'Continue', importBtn: '📂 Load File',
    menuFoot: 'WASD move · Space attack · Shift dodge · Q/E skills · F interact · I bag · T skills · L journal · Esc menu',
    noSave: 'No saved journey',
    loadedSave: 'Your journey continues',
    hudLv: 'Lv', hudGold: 'Gold',
    invTitle: '🎒 Bag', equipTitle: 'Gear', statTitle: 'Stats',
    skillTitle: '🌿 Skill Tree', questTitle: '📜 Journal', shopTitle: '🛒 Shop',
    innTitle: '🛏️ Castaway Inn', pauseTitle: '⏸ Paused',
    deathTitle: '💀 Taken by the tide', clearTitle: '🔥 The beacon burns again',
    closeBtn: 'Close (Esc)', resumeBtn: 'Resume', saveBtn: '💾 Save', exportBtn: '⬇ Export',
    backBtn: 'Main Menu', againBtn: '🔁 Back to town', restBtn: 'Rest (30 gold)',
    freeRestBtn: 'Rest & Save', buyBtn: 'Buy', sellBtn: 'Sell', equipBtn: 'Equip', useBtn: 'Use',
    learnBtn: 'Learn', talkBtn: 'Talk',
    slotWeapon: 'Weapon', slotArmor: 'Armor', slotTrinket: 'Trinket', slotEmpty: '— empty —',
    stStr: 'STR', stAgi: 'AGI', stVit: 'VIT', stWil: 'WIL',
    stAtk: 'Attack', stDef: 'Defense', stCrit: 'Crit', stSpd: 'Speed',
    spLeft: '{n} skill points', spNone: 'No skill points',
    reqLv: 'Needs Lv {n}', reqPrev: 'Needs previous', learned: 'Learned',
    qActive: 'Active', qDone: 'Done', qReady: 'Ready to report', qNone: 'No quests yet',
    invEmpty: 'Your bag is empty', invFull: 'Bag is full',
    goldShort: 'Not enough gold', bought: 'Bought', sold: 'Sold', equipped: 'Equipped',
    saved: 'Saved', autoSaved: 'Autosaved', exported: 'Exported to file', imported: 'Loaded',
    importFail: 'Could not read that save file',
    hintMove: 'Move with arrows / WASD',
    hintAttack: 'Space for a 3-hit combo — the last blow hits hardest',
    hintDash: 'Shift to dodge — you are untouchable mid-roll',
    hintTalk: 'F — talk',
    hintSkill: 'Q whirl · E tide spear — they cost Will',
    hintShield: 'A shield only guards the front — flank it, or break it with the 3rd hit',
    hintPotion: '1 potion · 2 will incense',
    hintLocked: 'Locked — you need a key',
    hintUnlocked: 'The key turns',
    hintNeedQuest: 'No reason to go in yet — ask the chief',
    hintHerb: 'F — gather herb',
    hintChest: 'F — open chest',
    hintStairsDown: 'F — descend',
    hintStairsUp: 'F — ascend',
    hintExit: 'F — step outside',
    hintLevel: 'Level {n} — press T to spend skill points',
    hintQuestNew: '📜 New quest: {n}',
    hintQuestDone: '✅ Quest complete: {n}',
    hintGot: 'Got {n}',
    hintFullBag: 'Bag full — could not pick it up',
    hintNoMp: 'Not enough Will',
    hintSave: '💾 Saved',
    bossName: 'The Keeper Wraith',
    phase2: '— the wraith swallows the lantern —',
    deathDesc: 'You wake at the Castaway Inn, half your gold gone.',
    clearDesc: 'The wraith scatters and the beacon burns. Chapter one of the Drift Continent ends here.',
    resultLine: 'Lv {lv} · Quests {q}/4 · Kills {k} · Score {s}',
    zoneEnter: '— {n} —',
    payRest: 'You pay 30 gold and rest',
    restDone: 'Well rested. Journey recorded',
    shopEmpty: 'Nothing for sale today',
    dlgClose: '(end conversation)',
  },
};

/* ══════════════════════════ 아이템 ══════════════════════════ */
/* slot: weapon|armor|trinket|use|mat · price 0 = 상점 미취급 */
DC.ITEMS = {
  rusty_dagger: {
    slot: 'weapon', icon: '🗡️', atk: 2, price: 0,
    n: { ko: '녹슨 단검', en: 'Rusty Dagger' },
    d: { ko: '표류물 더미에서 건진 물건. 없는 것보단 낫다.', en: 'Pulled from the driftwood. Better than fists.' },
  },
  drift_sword: {
    slot: 'weapon', icon: '⚔️', atk: 6, price: 90,
    n: { ko: '표류목 검', en: 'Driftwood Sword' },
    d: { ko: '소금기에 단단해진 나무심에 쇳조각을 박았다.', en: 'Salt-hardened core with iron shards driven in.' },
  },
  tide_saber: {
    slot: 'weapon', icon: '🌊', atk: 11, price: 260,
    n: { ko: '파도무늬 도', en: 'Tidewave Saber' },
    d: { ko: '날에 물결이 새겨져 있다. 베는 궤적이 길다.', en: 'Waves etched in the blade; the arc runs long.' },
  },
  beacon_steel: {
    slot: 'weapon', icon: '🔱', atk: 16, price: 0,
    n: { ko: '등대 강철검', en: 'Beacon Steel' },
    d: { ko: '등대 골조를 녹여 벼린 검. 어둠 속에서 희미하게 빛난다.', en: 'Forged from the beacon frame. It glows faintly in the dark.' },
  },
  quilt_coat: {
    slot: 'armor', icon: '🧥', def: 2, price: 0,
    n: { ko: '누비 옷', en: 'Quilted Coat' },
    d: { ko: '난파 당시 입고 있던 옷. 아직 젖어 있다.', en: 'What you wore in the wreck. Still damp.' },
  },
  leather_vest: {
    slot: 'armor', icon: '🦺', def: 5, price: 110,
    n: { ko: '가죽 흉갑', en: 'Leather Vest' },
    d: { ko: '늑대 가죽을 덧댄 흉갑.', en: 'Reinforced with wolf hide.' },
  },
  chain_mail: {
    slot: 'armor', icon: '🛡️', def: 9, price: 300,
    n: { ko: '사슬 갑옷', en: 'Chain Mail' },
    d: { ko: '대장장이 도로의 자랑. 무겁지만 확실하다.', en: "Doro's pride. Heavy, but it works." },
  },
  warden_plate: {
    slot: 'armor', icon: '🪖', def: 13, hp: 20, price: 0,
    n: { ko: '파수병 판금', en: 'Warden Plate' },
    d: { ko: '등대를 지키던 자의 갑옷. 안쪽에 이름이 긁혀 있다.', en: 'Armor of a lighthouse warden. A name is scratched inside.' },
  },
  castaway_charm: {
    slot: 'trinket', icon: '🐚', mp: 10, price: 70,
    n: { ko: '표류자의 부적', en: "Castaway's Charm" },
    d: { ko: '조개껍데기 목걸이. 의지 최대치 +10.', en: 'A shell pendant. Max Will +10.' },
  },
  tide_ring: {
    slot: 'trinket', icon: '💍', cdr: 0.15, price: 0,
    n: { ko: '조류 반지', en: 'Tide Ring' },
    d: { ko: '기술 재사용 대기 -15%.', en: 'Skill cooldowns -15%.' },
  },
  wraith_sigil: {
    slot: 'trinket', icon: '🔮', crit: 0.08, price: 0,
    n: { ko: '망령의 각인', en: 'Wraith Sigil' },
    d: { ko: '치명타 확률 +8%. 만지면 손끝이 시리다.', en: 'Crit chance +8%. Cold to the touch.' },
  },
  potion: {
    slot: 'use', icon: '🧪', heal: 40, price: 25, stack: 9,
    n: { ko: '약초 물약', en: 'Herb Potion' },
    d: { ko: '체력 40 회복.', en: 'Restores 40 HP.' },
  },
  potion_hi: {
    slot: 'use', icon: '🍶', heal: 90, price: 60, stack: 9,
    n: { ko: '상급 물약', en: 'Strong Potion' },
    d: { ko: '체력 90 회복.', en: 'Restores 90 HP.' },
  },
  elixir: {
    slot: 'use', icon: '💧', mana: 40, price: 35, stack: 9,
    n: { ko: '의지의 향', en: 'Will Incense' },
    d: { ko: '의지 40 회복.', en: 'Restores 40 Will.' },
  },
  herb: {
    slot: 'mat', icon: '🌿', price: 8, stack: 20,
    n: { ko: '바닷바람 약초', en: 'Seawind Herb' },
    d: { ko: '절벽 비탈에서만 자란다.', en: 'Grows only on the cliff slopes.' },
  },
  key_rust: {
    slot: 'mat', icon: '🗝️', price: 0, stack: 1, quest: true,
    n: { ko: '녹슨 열쇠', en: 'Rusted Key' },
    d: { ko: '등대 1층 안쪽 문을 연다.', en: 'Opens the inner door on the first floor.' },
  },
  key_lantern: {
    slot: 'mat', icon: '🔑', price: 0, stack: 1, quest: true,
    n: { ko: '등롱 열쇠', en: 'Lantern Key' },
    d: { ko: '등롱실로 통하는 문을 연다.', en: 'Opens the way to the lantern room.' },
  },
};

/* ══════════════════════════ 적 ══════════════════════════ */
/* ai: hopper | lunger | kiter | bulwark | wraith | keeper */
DC.ENEMIES = {
  slime: {
    ai: 'hopper', hp: 22, atk: 5, def: 0, spd: 44, xp: 7, gold: 3, r: 13,
    body: '#22c55e', dark: '#166534',
    n: { ko: '갯바위 슬라임', en: 'Tidepool Slime' },
  },
  wolf: {
    ai: 'lunger', hp: 34, atk: 9, def: 1, spd: 98, xp: 14, gold: 6, r: 14,
    body: '#94a3b8', dark: '#475569',
    n: { ko: '잿빛 늑대', en: 'Ash Wolf' },
  },
  archer: {
    ai: 'kiter', hp: 26, atk: 8, def: 0, spd: 64, xp: 16, gold: 9, r: 12,
    body: '#eab308', dark: '#854d0e',
    n: { ko: '해적 사수', en: 'Reef Marksman' },
  },
  shield: {
    ai: 'bulwark', hp: 62, atk: 12, def: 6, spd: 46, xp: 26, gold: 15, r: 15,
    body: '#0ea5e9', dark: '#075985',
    n: { ko: '난파선 방패병', en: 'Wreck Bulwark' },
  },
  wraith: {
    ai: 'wraith', hp: 165, atk: 14, def: 3, spd: 74, xp: 90, gold: 60, r: 18, elite: true,
    body: '#a78bfa', dark: '#5b21b6',
    n: { ko: '파수병 망령', en: 'Warden Shade' },
  },
  keeper: {
    ai: 'keeper', hp: 540, atk: 18, def: 5, spd: 64, xp: 340, gold: 220, r: 26, boss: true,
    body: '#ef4444', dark: '#7f1d1d',
    n: { ko: '등대지기 망령', en: 'The Keeper Wraith' },
  },
};

/* ══════════════════════════ 액티브 스킬 ══════════════════════════ */
DC.SKILLS = {
  whirl: {
    key: 'Q', icon: '🌀', mp: 8, cd: 6, radius: 78, mult: 1.5,
    n: { ko: '회오리 베기', en: 'Whirl Slash' },
    d: { ko: '주변을 한 바퀴 베어 넘긴다.', en: 'Sweep everything around you.' },
  },
  tide: {
    key: 'E', icon: '🌊', mp: 6, cd: 4, mult: 1.3, pierce: 2, speed: 420,
    n: { ko: '파도 창', en: 'Tide Spear' },
    d: { ko: '물의 창을 던져 관통시킨다.', en: 'Hurl a spear of water that pierces through.' },
  },
};

/* ══════════════════════════ 기술의 나무 (3계열 × 3) ══════════════════════════ */
/* line 0 검로 · 1 조류 · 2 강인 — tier 0/1/2, 각 1 포인트 */
DC.TREE = [
  { id: 'blade1', line: 0, tier: 0, icon: '⚔️', reqLv: 1,
    n: { ko: '연격 강화', en: 'Chained Edge' }, d: { ko: '연타 피해 +20%', en: 'Combo damage +20%' } },
  { id: 'blade2', line: 0, tier: 1, icon: '🩸', reqLv: 3,
    n: { ko: '처형', en: 'Execute' }, d: { ko: '체력 30% 이하 적에게 +40%', en: '+40% vs enemies below 30% HP' } },
  { id: 'blade3', line: 0, tier: 2, icon: '💥', reqLv: 6,
    n: { ko: '폭풍의 검', en: 'Storm Blade' }, d: { ko: '3타 마무리에 충격파', en: 'Combo finisher releases a shockwave' } },

  { id: 'tide1', line: 1, tier: 0, icon: '🌊', reqLv: 1,
    n: { ko: '깊은 물길', en: 'Deep Current' }, d: { ko: '파도 창 피해 +30%, 관통 +2', en: 'Tide Spear +30% damage, +2 pierce' } },
  { id: 'tide2', line: 1, tier: 1, icon: '💠', reqLv: 3,
    n: { ko: '밀물 회복', en: 'Flood Mend' }, d: { ko: '처치 시 체력 +3', en: 'Heal 3 HP on kill' } },
  { id: 'tide3', line: 1, tier: 2, icon: '🌀', reqLv: 6,
    n: { ko: '해일', en: 'Surge' }, d: { ko: '회오리 범위 +40%, 피해 +25%', en: 'Whirl radius +40%, damage +25%' } },

  { id: 'grit1', line: 2, tier: 0, icon: '🧱', reqLv: 1,
    n: { ko: '굳은 살', en: 'Callus' }, d: { ko: '받는 피해 -12%', en: 'Damage taken -12%' } },
  { id: 'grit2', line: 2, tier: 1, icon: '🌬️', reqLv: 3,
    n: { ko: '긴 호흡', en: 'Long Breath' }, d: { ko: '회피 대기 -25%, 무적 +0.06초', en: 'Dodge cooldown -25%, i-frames +0.06s' } },
  { id: 'grit3', line: 2, tier: 2, icon: '🕯️', reqLv: 6,
    n: { ko: '불굴', en: 'Unbroken' }, d: { ko: '치명적 피해를 60초마다 1회 버틴다', en: 'Survive one lethal blow every 60s' } },
];

/* ══════════════════════════ 성장 곡선 ══════════════════════════ */
/** 레벨 lv → lv+1 에 필요한 경험치 */
DC.xpNeed = function (lv) { return 30 + 22 * lv + 6 * lv * lv; };
DC.MAX_LEVEL = 20;

/* ══════════════════════════ 상점 ══════════════════════════ */
DC.SHOPS = {
  smith: ['drift_sword', 'tide_saber', 'leather_vest', 'chain_mail'],
  herbalist: ['potion', 'potion_hi', 'elixir', 'castaway_charm'],
};

/* ══════════════════════════ 퀘스트 ══════════════════════════ */
/* state: 0 미수락 · 1 진행 · 2 보고 가능 · 3 완료 */
DC.QUESTS = {
  main_light: {
    kind: 'main', order: 1,
    n: { ko: '꺼진 등대', en: 'The Dark Beacon' },
    d: { ko: '등대 곶으로 가서 등대 안을 살펴본다.', en: 'Reach the cape and step inside the lighthouse.' },
    goal: { type: 'flag', flag: 'entered_lighthouse' },
    reward: { xp: 90, gold: 60, items: ['potion', 'potion'] },
  },
  main_keeper: {
    kind: 'main', order: 2,
    n: { ko: '등대지기의 마지막 밤', en: "The Keeper's Last Night" },
    d: { ko: '등롱실 꼭대기의 망령을 잠재운다.', en: 'Put the wraith in the lantern room to rest.' },
    goal: { type: 'flag', flag: 'boss_down' },
    reward: { xp: 400, gold: 250, items: [] },
  },
  side_herb: {
    kind: 'side',
    n: { ko: '바닷바람 약초', en: 'Seawind Herbs' },
    d: { ko: '약초상 셀린에게 줄 약초 5개를 캔다.', en: 'Gather 5 herbs for Selin the herbalist.' },
    goal: { type: 'collect', item: 'herb', count: 5 },
    reward: { xp: 60, gold: 40, items: ['potion_hi', 'potion_hi', 'potion_hi'] },
  },
  side_wolf: {
    kind: 'side',
    n: { ko: '골짜기의 이빨', en: 'Teeth in the Vale' },
    d: { ko: '늑대 골짜기의 잿빛 늑대 8마리를 정리한다.', en: 'Thin the ash wolves — 8 of them.' },
    goal: { type: 'kill', enemy: 'wolf', count: 8 },
    reward: { xp: 80, gold: 60, items: ['tide_ring'] },
  },
};
DC.QUEST_ORDER = ['main_light', 'main_keeper', 'side_herb', 'side_wolf'];

/** 퀘스트 진행 상태 조회 (0 미수락 · 1 진행 · 2 보고 가능 · 3 완료) */
DC.qs = function (S, id) {
  var q = S && S.quests && S.quests[id];
  return q ? q.state : 0;
};

/* ══════════════════════════ NPC · 대화 트리 ══════════════════════════
 * root(S) 가 진행 상황에 맞는 시작 노드를 고른다.
 * 선택지: { t:{ko,en}, to:'다음노드', act:'명령' }
 *   act — accept:<퀘스트> · turnin:<퀘스트> · shop:<상점> · inn · end
 *   to 가 없으면 대화 종료.
 * ────────────────────────────────────────────────────────────────── */
DC.NPCS = {
  chief: {
    icon: '🧓', color: '#eab308',
    n: { ko: '촌장 하란', en: 'Chief Haran' },
    root: function (S) {
      if (DC.qs(S, 'main_keeper') === 3) return 'done';
      if (DC.qs(S, 'main_keeper') >= 1) return 'keeper_wait';
      if (DC.qs(S, 'main_light') === 2) return 'light_report';
      if (DC.qs(S, 'main_light') >= 1) return 'light_wait';
      return 'intro';
    },
    nodes: {
      intro: {
        t: { ko: '살아남았군. 사흘째 등대가 꺼져 있네. 등대가 꺼지면 배가 들어오지 않고, 배가 없으면 이 마을은 겨울을 못 넘겨.',
          en: 'So you lived. The beacon has been dark three nights. No light, no ships. No ships, no winter for this town.' },
        c: [
          { t: { ko: '등대에 무슨 일이 있었습니까?', en: 'What happened out there?' }, to: 'why' },
          { t: { ko: '제가 가보겠습니다.', en: "I'll go look." }, to: 'accept', act: 'accept:main_light' },
        ],
      },
      why: {
        t: { ko: '등대지기 노인이 폭풍 날 밤에 올라간 뒤로 내려오질 않았어. 곶에 다녀온 젊은 것들은 하나같이 "안에서 누가 부른다"고만 하더군.',
          en: 'The old keeper climbed up the night of the storm and never came down. Everyone who goes near says the same thing — someone is calling from inside.' },
        c: [
          { t: { ko: '제가 가보겠습니다.', en: "I'll go look." }, to: 'accept', act: 'accept:main_light' },
          { t: { ko: '조금 더 준비하고 오겠습니다.', en: 'Let me prepare first.' }, act: 'end' },
        ],
      },
      accept: {
        t: { ko: '동쪽 곶이야. 늑대 골짜기는 돌아가게. 도로한테 내 이름 대면 값을 좀 깎아줄 걸세.',
          en: 'East cape. Go around the wolf vale. Tell Doro I sent you — he might shave the price.' },
        c: [{ t: { ko: '다녀오겠습니다.', en: 'On my way.' }, act: 'end' }],
      },
      light_wait: {
        t: { ko: '아직 곶에 안 갔나? 등대는 동쪽 끝이야. 문은 열려 있을 걸세 — 열려 있는 게 더 무섭지만.',
          en: 'Not gone yet? East end of the cape. The door is open — which frightens me more than a locked one.' },
        c: [{ t: { ko: '가는 길입니다.', en: 'On my way.' }, act: 'end' }],
      },
      light_report: {
        t: { ko: '들어갔다 나왔다고? …자네 얼굴빛이 안 좋군. 안에 뭐가 있었나. 아니, 말하지 말게. 대신 부탁 하나 더 하지.',
          en: "You went in and came out? Your face says enough. Don't tell me. Instead — one more favor." },
        c: [{ t: { ko: '(보고한다)', en: '(report)' }, to: 'keeper_offer', act: 'turnin:main_light' }],
      },
      keeper_offer: {
        t: { ko: '등롱실 꼭대기, 거기 있는 게 무엇이든 잠재워 주게. 등대지기 노인이었다면… 편히 보내주고.',
          en: 'Whatever sits in the lantern room — put it to rest. And if it was the old keeper… let him go gently.' },
        c: [{ t: { ko: '맡겨 주십시오.', en: 'I will.' }, act: 'accept:main_keeper' }],
      },
      keeper_wait: {
        t: { ko: '등롱실은 3층이야. 중간 문들은 잠겨 있을 걸세. 열쇠는 안에 있어 — 늘 그렇듯이.',
          en: 'Lantern room is the third floor. The inner doors are locked. The keys are inside — they always are.' },
        c: [{ t: { ko: '알겠습니다.', en: 'Understood.' }, act: 'end' }],
      },
      done: {
        t: { ko: '오늘 밤 항구에 배가 셋이나 들어왔네. 자네 덕이야. …그런데 서쪽 바다에서도 불빛이 보였다더군. 등대가 하나 더 있나?',
          en: 'Three ships docked tonight. Your doing. …Though someone saw a light to the west. Is there another beacon out there?' },
        c: [{ t: { ko: '언젠가 가보죠.', en: 'Someday I will look.' }, act: 'end' }],
      },
    },
  },

  innkeeper: {
    icon: '👩‍🦰', color: '#22c55e',
    n: { ko: '여관 주인 마르타', en: 'Marta the Innkeeper' },
    root: function (S) { return DC.qs(S, 'main_keeper') === 3 ? 'after' : 'intro'; },
    nodes: {
      intro: {
        t: { ko: '난파선에서 자네를 끌어낸 게 우리 애들이야. 침대는 비어 있어. 자고 가면 몸도 낫고, 여정도 종이에 적어두지.',
          en: 'My boys dragged you off that wreck. A bed is free. Sleep and you heal — and I write your journey down.' },
        c: [
          { t: { ko: '쉬어가겠습니다', en: 'I will rest' }, act: 'inn' },
          { t: { ko: '마을 이야기를 들려주세요', en: 'Tell me about the town' }, to: 'town' },
          { t: { ko: '나중에 오죠', en: 'Later' }, act: 'end' },
        ],
      },
      town: {
        t: { ko: '표착항 — 이름 그대로 떠밀려 온 사람들이 세운 항구야. 여기 사는 사람 중에 여기서 태어난 사람은 없어.',
          en: 'Castaway Harbor — built by people the sea spat out. Nobody living here was born here.' },
        c: [
          { t: { ko: '쉬어가겠습니다', en: 'I will rest' }, act: 'inn' },
          { t: { ko: '고맙습니다', en: 'Thank you' }, act: 'end' },
        ],
      },
      after: {
        t: { ko: '등대가 켜진 밤은 처음이야. 오늘은 방값 안 받네.',
          en: 'First night with the beacon lit. Your room is free tonight.' },
        c: [
          { t: { ko: '쉬어가겠습니다', en: 'I will rest' }, act: 'inn' },
          { t: { ko: '고맙습니다', en: 'Thank you' }, act: 'end' },
        ],
      },
    },
  },

  smith: {
    icon: '🧔', color: '#0ea5e9',
    n: { ko: '대장장이 도로', en: 'Doro the Smith' },
    root: function () { return 'intro'; },
    nodes: {
      intro: {
        t: { ko: '그 단검으로 늑대를 상대할 생각인가? 그건 밧줄 자르는 물건이야.',
          en: 'Planning to fight wolves with that? That thing cuts rope, not fur.' },
        c: [
          { t: { ko: '물건을 보여주세요', en: 'Show me your wares' }, act: 'shop:smith' },
          { t: { ko: '등대에 대해 아는 게 있습니까?', en: 'Know anything about the lighthouse?' }, to: 'light' },
          { t: { ko: '다음에 오죠', en: 'Another time' }, act: 'end' },
        ],
      },
      light: {
        t: { ko: '등대 골조는 내가 못 다루는 강철이야. 육지에서 온 물건이지. 안에 그 강철로 벼린 검이 하나 남아 있다는 소문은 있네.',
          en: "The beacon frame is steel I can't work. Came from the mainland. They say a blade forged from it still lies inside." },
        c: [
          { t: { ko: '물건을 보여주세요', en: 'Show me your wares' }, act: 'shop:smith' },
          { t: { ko: '알겠습니다', en: 'Noted' }, act: 'end' },
        ],
      },
    },
  },

  herbalist: {
    icon: '👧', color: '#a3e635',
    n: { ko: '약초상 셀린', en: 'Selin the Herbalist' },
    root: function (S) {
      var s = DC.qs(S, 'side_herb');
      if (s === 2) return 'report';
      if (s === 1) return 'wait';
      if (s === 3) return 'after';
      return 'intro';
    },
    nodes: {
      intro: {
        t: { ko: '물약이 떨어졌어요. 재료가 없어서요 — 바닷바람 약초는 남쪽 비탈에만 자라는데, 거기 슬라임이 늘었거든요.',
          en: 'I am out of potions. No stock — seawind herb only grows on the south slopes, and the slimes moved in.' },
        c: [
          { t: { ko: '제가 캐다 드리죠', en: 'I will gather them' }, to: 'accepted', act: 'accept:side_herb' },
          { t: { ko: '남은 물건을 보여주세요', en: 'Show me what is left' }, act: 'shop:herbalist' },
          { t: { ko: '나중에요', en: 'Later' }, act: 'end' },
        ],
      },
      accepted: {
        t: { ko: '5개면 충분해요. 🌿 표시가 난 덤불을 찾으면 돼요. 남쪽 비탈, 숲 어디든요.',
          en: 'Five will do. Look for the 🌿 bushes — south slopes, the woods, anywhere green.' },
        c: [{ t: { ko: '금방 오죠', en: 'Back soon' }, act: 'end' }],
      },
      wait: {
        t: { ko: '아직 5개가 안 됐죠? 🌿 표시를 찾으세요.', en: 'Not five yet? Look for the 🌿 marks.' },
        c: [
          { t: { ko: '물건을 보여주세요', en: 'Show me your wares' }, act: 'shop:herbalist' },
          { t: { ko: '가볼게요', en: 'Going' }, act: 'end' },
        ],
      },
      report: {
        t: { ko: '와, 전부 성한 잎이네요! 값은 물약으로 드릴게요 — 그게 더 도움 될 거예요.',
          en: 'All whole leaves! I will pay you in potions — you will need them more than coin.' },
        c: [{ t: { ko: '(약초를 건넨다)', en: '(hand over the herbs)' }, act: 'turnin:side_herb' }],
      },
      after: {
        t: { ko: '이제 재고가 넉넉해요. 등대 가실 거면 상급 물약 꼭 챙기세요.',
          en: 'Stocked up again. If you are heading to the lighthouse, take the strong ones.' },
        c: [
          { t: { ko: '물건을 보여주세요', en: 'Show me your wares' }, act: 'shop:herbalist' },
          { t: { ko: '고마워요', en: 'Thanks' }, act: 'end' },
        ],
      },
    },
  },

  elder: {
    icon: '🧙', color: '#a78bfa',
    n: { ko: '수수께끼 노인', en: 'The Riddling Elder' },
    root: function (S) {
      var s = DC.qs(S, 'side_wolf');
      if (s === 2) return 'report';
      if (s === 1) return 'wait';
      if (s === 3) return 'after';
      return 'intro';
    },
    nodes: {
      intro: {
        t: { ko: '자네도 떠밀려 왔군. 여기 사람들은 다 그래. …묻지. 물에 빠진 자를 구하는 건 뭍인가, 밧줄인가?',
          en: 'Washed up too, did you. Everyone here did. …Answer me: what saves a drowning man — the shore, or the rope?' },
        c: [
          { t: { ko: '밧줄이죠.', en: 'The rope.' }, to: 'good' },
          { t: { ko: '뭍입니다.', en: 'The shore.' }, to: 'bad' },
        ],
      },
      good: {
        t: { ko: '옳아. 뭍은 가만히 있을 뿐이고, 손을 뻗는 건 늘 누군가지. 자네가 밧줄이 될 셈이면 일거리를 하나 주지.',
          en: 'Right. The shore just sits there; someone always throws the rope. If you mean to be the rope, I have work.' },
        c: [
          { t: { ko: '말씀하시죠', en: 'Go on' }, to: 'offer' },
          { t: { ko: '나중에요', en: 'Later' }, act: 'end' },
        ],
      },
      bad: {
        t: { ko: '흠. 틀렸다곤 안 하겠네 — 뭍에 닿아야 사는 건 맞으니. 하지만 손을 뻗는 건 늘 누군가야. 일거리 하나 주지.',
          en: 'Hm. Not wrong — you do need the shore. But someone still throws the rope. I have work for you.' },
        c: [
          { t: { ko: '말씀하시죠', en: 'Go on' }, to: 'offer' },
          { t: { ko: '나중에요', en: 'Later' }, act: 'end' },
        ],
      },
      offer: {
        t: { ko: '골짜기의 늑대가 등대 길을 막고 있어. 여덟 마리쯤 줄이면 사람들이 다시 다닐 걸세.',
          en: 'Wolves hold the vale and the road to the cape. Thin them — eight should do — and folk will walk again.' },
        c: [
          { t: { ko: '맡겨 주십시오', en: 'Consider it done' }, act: 'accept:side_wolf' },
          { t: { ko: '생각해 보죠', en: 'I will think on it' }, act: 'end' },
        ],
      },
      wait: {
        t: { ko: '늑대는 혼자 오는 법이 없네. 한 마리를 보면 셋을 세게.',
          en: 'A wolf never comes alone. See one, count three.' },
        c: [{ t: { ko: '알겠습니다', en: 'Understood' }, act: 'end' }],
      },
      report: {
        t: { ko: '골짜기가 조용하군. 이걸 받게 — 물때를 읽는 반지야. 자네 기술이 더 빨리 돌아올 걸세.',
          en: 'The vale is quiet. Take this — a ring that reads the tide. Your skills will come back faster.' },
        c: [{ t: { ko: '(반지를 받는다)', en: '(take the ring)' }, act: 'turnin:side_wolf' }],
      },
      after: {
        t: { ko: '등대 안에서는 뒤를 보게. 방패는 앞만 막으니까.',
          en: 'Inside the lighthouse, look behind you. A shield only guards the front.' },
        c: [{ t: { ko: '기억하죠', en: 'I will remember' }, act: 'end' }],
      },
    },
  },
};

/* ══════════════════════════ 지역 이름 ══════════════════════════ */
DC.ZONES = {
  harbor: { ko: '표착항', en: 'Castaway Harbor' },
  coast: { ko: '소금 해안길', en: 'Salt Coast Road' },
  marsh: { ko: '소금 습지', en: 'Brine Marsh' },
  cape: { ko: '등대 곶', en: 'Beacon Cape' },
  forest: { ko: '속삭이는 숲', en: 'Whispering Wood' },
  vale: { ko: '늑대 골짜기', en: 'Wolf Vale' },
  ruins: { ko: '폐허 야영지', en: 'Ruined Camp' },
  cliff: { ko: '절벽 오솔길', en: 'Cliff Path' },
  slope: { ko: '약초 비탈', en: 'Herb Slope' },
  moss: { ko: '이끼 어귀', en: 'Moss Hollow' },
  pier: { ko: '부서진 부두', en: 'Broken Pier' },
  wreck: { ko: '난파 해안', en: 'Wreck Shore' },
  f1: { ko: '가라앉은 등대 1층', en: 'Sunken Lighthouse · F1' },
  f2: { ko: '가라앉은 등대 2층', en: 'Sunken Lighthouse · F2' },
  f3: { ko: '등롱실', en: 'The Lantern Room' },
};
})();
