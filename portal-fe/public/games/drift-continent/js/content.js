'use strict';
(function () {
/**
 * 표류 대륙 (Drift Continent) — 콘텐츠 데이터 레이어.
 *
 * 아이템 / 적 / 직업 / 스킬 / 기술나무 / 동료 / NPC 대사 / 메인 챕터 / 의뢰 / 상점 테이블.
 * 로직 없음. 가장 먼저 로드되며 DC 네임스페이스를 만든다.
 *
 * 다국어 규칙
 *  - UI 크롬(버튼·패널 제목·힌트)은 GameI18n 사전(DC.STR) 사용
 *  - 콘텐츠 문자열(아이템명·대사·퀘스트)은 {ko,en} 인라인 객체 + DC.tx() 로 해석
 *    → 키 폭발 없이 대사량을 늘릴 수 있다
 *
 * 메인 스토리
 *  - DC.MAIN 이 8챕터의 단일 원본이다. 챕터 정의에서 NPC 대화 노드(제안/대기/보고)를
 *    자동 생성해 DC.NPCS 에 심는다 — 대사와 목표가 한 곳에 붙어 있어 어긋나지 않는다
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
    menuFoot: 'WASD 이동 · Space 공격 · Shift 회피 · Q/E/R 기술 · F 상호작용 · I 가방 · T 기술 · L 일지 · M 지도 · Esc 메뉴',
    noSave: '저장된 여정이 없다',
    loadedSave: '여정을 이어간다',
    hudLv: 'Lv', hudGold: '금화',
    invTitle: '🎒 가방', equipTitle: '장비', statTitle: '능력치',
    skillTitle: '🌿 기술의 나무', questTitle: '📜 여정 일지', shopTitle: '🛒 상점',
    innTitle: '🛏️ 표착항 여관', pauseTitle: '⏸ 잠시 멈춤',
    deathTitle: '💀 파도에 삼켜졌다', clearTitle: '🔥 먼 기슭에 불이 들어왔다',
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
    qOpen: '수락 가능', qLocked: '아직 이르다',
    invEmpty: '가방이 비었다', invFull: '가방이 가득 찼다',
    goldShort: '금화가 모자란다', bought: '구매했다', sold: '팔았다', equipped: '장착했다',
    wrongClass: '내 손에 맞는 물건이 아니다',
    saved: '기록했다', autoSaved: '자동 기록', exported: '파일로 내보냈다', imported: '불러왔다',
    importFail: '세이브 파일을 읽지 못했다',
    hintMove: '방향키 / WASD 로 움직인다',
    hintAttack: 'Space 공격 — 손에 든 것에 따라 방식이 다르다',
    hintDash: 'Shift 회피 — 구르는 동안은 맞지 않는다',
    hintTalk: 'F — 말을 건다',
    hintSkill: 'Q · E 기술 — 의지를 쓴다',
    hintSkillR: 'R — 전직 기술이 열렸다',
    hintShield: '방패는 앞만 막는다 — 등 뒤를 노리거나 마무리 타격으로 뚫어라',
    hintPotion: '1 회복약 · 2 의지 회복',
    hintLocked: '잠겨 있다 — 열쇠가 필요하다',
    hintUnlocked: '열쇠로 문을 열었다',
    hintNeedQuest: '아직 들어갈 이유가 없다 — 촌장에게 물어보자',
    hintHerb: 'F — 약초를 캔다',
    hintChest: 'F — 상자를 연다',
    hintStatue: 'F — 석상의 글귀를 읽는다',
    hintStatueRead: '오래된 글귀가 머릿속에 들어온다',
    hintSpring: 'F — 샘물을 마신다',
    hintSpringDrink: '차가운 물이 몸을 되살린다',
    hintBonfire: 'F — 화톳불 곁에서 숨을 고른다',
    hintBonfireOn: '불기운이 몸을 데운다 — 곁에 있는 동안 회복된다',
    hintBoard: 'F — 의뢰 게시판을 본다',
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
    hintMap: 'M — 대륙 지도',
    bossName: '등대지기 망령',
    phase2: '— 망령이 등불을 삼킨다 —',
    deathDesc: '표착항 여관에서 다시 눈을 뜬다. 금화 절반을 잃었다.',
    clearDesc: '먼 기슭의 등불이 살아났다. 표류 대륙은 더 이상 어둠 속에 있지 않다.',
    resultLine: 'Lv {lv} · 챕터 {c}/{ct} · 의뢰 {q} · 처치 {k} · 점수 {s}',
    zoneEnter: '— {n} —',
    payRest: '30 금화를 내고 쉬었다',
    restDone: '충분히 쉬었다. 여정이 기록됐다',
    shopEmpty: '오늘은 물건이 없다',
    dlgClose: '(대화를 끝낸다)',

    /* 직업 */
    classTitle: '⚔ 어떤 손으로 살아남을 것인가',
    classDesc: '난파에서 건진 몸 하나. 그래도 손에 익은 것은 남는다.',
    classPick: '이 길로 간다',
    clsLabel: '직업', advLabel: '전직',
    hudClass: '{c}',

    /* 전직 */
    advTitle: '🌗 갈림길',
    advDesc: '한 번 고르면 되돌릴 수 없다. 신중히.',
    advNeed: 'Lv {lv} · {q} 완료가 필요하다',
    advReady: '길을 고를 수 있다',
    advPick: '이 길을 걷는다',
    advWarn: '⚠ 전직은 한 번뿐이다. 되돌릴 수 없다.',
    advDone: '이미 길을 골랐다 — {n}',
    advTaken: '{n} — 새 기술이 열렸다',

    /* 치유사 */
    healTitle: '✚ 치유소',
    healBtn: '치료받기 ({g} 금화)', healFree: '치료받기 (무료)',
    healDone: '숨이 트인다. 몸이 가벼워졌다',
    healClean: '몸에 붙어 있던 것이 떨어져 나갔다',
    healNothing: '지금은 멀쩡하다',
    curseOn: '망령의 한기 — 최대 체력이 깎였다',

    /* 의뢰 게시판 */
    boardTitle: '📋 의뢰 게시판',
    boardMain: '★ 본줄기', boardSide: '· 곁가지', boardRepeat: '↻ 상시 의뢰',
    boardAccept: '수락', boardTurnin: '보고', boardSeeNpc: '{n} 에게',
    boardNone: '붙어 있는 종이가 없다',
    boardRepeatNote: '언제든 다시 받을 수 있다 · {n}회 완료',
    chapterOf: '{n}장',
    questTarget: '목표: {n}',

    /* 동료 */
    mercTitle: '🎖 용병 대기소',
    mercHire: '고용 ({g} 금화)', mercUp: '단련 ({g} 금화)',
    mercRevive: '소생 ({g} 금화)', mercDismiss: '내보내기',
    mercNone: '지금은 혼자 다닌다',
    mercHired: '{n} 이(가) 따라나섰다',
    mercLeft: '{n} 이(가) 남았다',
    mercDown: '{n} 이(가) 쓰러졌다 — {s}초 뒤 일어난다',
    mercUpDone: '{n} 이(가) 더 단단해졌다',
    mercBack: '{n} 이(가) 다시 일어섰다',
    mercMax: '더 단련할 수 없다',
    mercBusy: '이미 동료가 있다',
    mercLvTxt: '단련 {n}',
    mercAlive: '체력 {a} / {b}',

    /* 지도 */
    mapTitle: '🗺 대륙 지도',
    mapZoomIn: '＋ 확대', mapZoomOut: '－ 축소',
    mapYou: '현재 위치', mapHarbor: '표착항', mapCape: '등대 곶',
    mapDelve: '갱도', mapUnseen: '미답', mapGoal: '이번 목표',
    mapFoot: 'M / Esc 닫기 · +/- 확대·축소',
    mapWp: '웨이포인트', mapWpOff: '미발견 웨이포인트', mapWarpBtn: '🚩 이동',

    /* 웨이포인트 */
    warpTitle: '🚩 웨이포인트',
    warpDesc: '한 번 새긴 비석 사이는 건너뛸 수 있다. 처음 가는 길은 두 발로.',
    warpNone: '아직 새긴 비석이 없다',
    warpHere: '지금 여기',
    warpGo: '이동',
    warpCount: '새긴 비석 {n}곳',
    warpReady: '여기서 다른 비석으로 갈 수 있다',
    warpNeedStone: '비석 앞에 서 있어야 떠날 수 있다',
    warpFoe: '적이 가까이 있다 — 지금은 떠날 수 없다',
    warpPoor: '뱃삯이 모자란다',
    warpDone: '{n} 에 내려섰다',
    warpDist: '{n}청크 · 🪙{g}',
    warpGoalNote: '★ 이번 목표에 가장 가까운 비석 — {n} ({d}청크)',
    warpGoalNone: '★ 이번 목표 근처엔 아직 새긴 비석이 없다',
    wpFound: '🚩 {n} — 비석에 이름을 새겼다 ({c}곳)',
    hintWaypointNew: 'F — 비석에 이름을 새긴다',
    hintWaypointUse: 'F — 비석에서 길을 고른다',
    charmHome: '표착항의 불빛이 몸을 끌어당긴다',

    /* 오프닝 · 튜토리얼 */
    tutSkip: '(안내를 건너뛴다)',
    tutStart: '가르쳐 주십시오',
    tutMove: '① WASD / 방향키로 걸어 보자',
    tutAttack: '② Space — 손에 든 것으로 한 번 휘둘러 보자',
    tutDash: '③ Shift — 구르면 잠깐 맞지 않는다',
    tutTalk: '④ F — 화톳불이나 사람 앞에서 눌러 보자',
    tutBag: '⑤ I — 가방을 열어 장비를 확인하자',
    tutTree: '⑥ T — 기술의 나무를 펼쳐 보자',
    tutTown: '⑦ 치유소나 상점에 들러 보자',
    tutKill: '⑧ 울타리 밖에서 한 마리 잡아 보자',
    tutDone: '충분하다. 장로에게 돌아가자',
    tutSkipped: '안내를 건너뛰었다',
    chapterNew: '{n}장 — {t}',
    chapterEnd: '✦ {n}장 끝 — {t}',
  },
  en: {
    gameTitle: '🌊 Drift Continent',
    tagline: 'You wake on a wreck. The lighthouse is still dark.',
    newBtn: 'New Journey', contBtn: 'Continue', importBtn: '📂 Load File',
    menuFoot: 'WASD move · Space attack · Shift dodge · Q/E/R skills · F interact · I bag · T skills · L journal · M map · Esc menu',
    noSave: 'No saved journey',
    loadedSave: 'Your journey continues',
    hudLv: 'Lv', hudGold: 'Gold',
    invTitle: '🎒 Bag', equipTitle: 'Gear', statTitle: 'Stats',
    skillTitle: '🌿 Skill Tree', questTitle: '📜 Journal', shopTitle: '🛒 Shop',
    innTitle: '🛏️ Castaway Inn', pauseTitle: '⏸ Paused',
    deathTitle: '💀 Taken by the tide', clearTitle: '🔥 The far shore burns',
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
    qOpen: 'Available', qLocked: 'Not yet',
    invEmpty: 'Your bag is empty', invFull: 'Bag is full',
    goldShort: 'Not enough gold', bought: 'Bought', sold: 'Sold', equipped: 'Equipped',
    wrongClass: 'That does not sit right in your hands',
    saved: 'Saved', autoSaved: 'Autosaved', exported: 'Exported to file', imported: 'Loaded',
    importFail: 'Could not read that save file',
    hintMove: 'Move with arrows / WASD',
    hintAttack: 'Space to strike — the swing follows what you carry',
    hintDash: 'Shift to dodge — you are untouchable mid-roll',
    hintTalk: 'F — talk',
    hintSkill: 'Q · E skills — they cost Will',
    hintSkillR: 'R — your advanced skill is unlocked',
    hintShield: 'A shield only guards the front — flank it, or break it with a finisher',
    hintPotion: '1 potion · 2 will incense',
    hintLocked: 'Locked — you need a key',
    hintUnlocked: 'The key turns',
    hintNeedQuest: 'No reason to go in yet — ask the chief',
    hintHerb: 'F — gather herb',
    hintChest: 'F — open chest',
    hintStatue: 'F — read the standing stone',
    hintStatueRead: 'The old inscription settles into your mind',
    hintSpring: 'F — drink from the spring',
    hintSpringDrink: 'The cold water brings you back',
    hintBonfire: 'F — catch your breath by the fire',
    hintBonfireOn: 'The fire works into you — you mend while you stay',
    hintBoard: 'F — read the notice board',
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
    hintMap: 'M — continent map',
    bossName: 'The Keeper Wraith',
    phase2: '— the wraith swallows the lantern —',
    deathDesc: 'You wake at the Castaway Inn, half your gold gone.',
    clearDesc: 'The far beacon is alive again. The Drift Continent is no longer in the dark.',
    resultLine: 'Lv {lv} · Chapters {c}/{ct} · Quests {q} · Kills {k} · Score {s}',
    zoneEnter: '— {n} —',
    payRest: 'You pay 30 gold and rest',
    restDone: 'Well rested. Journey recorded',
    shopEmpty: 'Nothing for sale today',
    dlgClose: '(end conversation)',

    classTitle: '⚔ What will your hands remember?',
    classDesc: 'The wreck left you nothing but a body. Skill, though, stays in the hands.',
    classPick: 'Take this path',
    clsLabel: 'Class', advLabel: 'Path',
    hudClass: '{c}',

    advTitle: '🌗 The Fork',
    advDesc: 'Chosen once, never undone. Think it through.',
    advNeed: 'Requires Lv {lv} and “{q}”',
    advReady: 'You may choose a path',
    advPick: 'Walk this road',
    advWarn: '⚠ You may advance only once. There is no going back.',
    advDone: 'Your road is already chosen — {n}',
    advTaken: '{n} — a new skill opens',

    healTitle: '✚ Healing House',
    healBtn: 'Be treated ({g} gold)', healFree: 'Be treated (free)',
    healDone: 'Your breath comes easy again',
    healClean: 'Whatever clung to you lets go',
    healNothing: 'Nothing ails you right now',
    curseOn: 'A wraith’s chill — your maximum health is cut',

    boardTitle: '📋 Notice Board',
    boardMain: '★ Main thread', boardSide: '· Side work', boardRepeat: '↻ Standing work',
    boardAccept: 'Accept', boardTurnin: 'Report', boardSeeNpc: 'See {n}',
    boardNone: 'No papers pinned today',
    boardRepeatNote: 'Always available · done {n}×',
    chapterOf: 'Ch. {n}',
    questTarget: 'Target: {n}',

    mercTitle: '🎖 Mercenary Post',
    mercHire: 'Hire ({g} gold)', mercUp: 'Train ({g} gold)',
    mercRevive: 'Revive ({g} gold)', mercDismiss: 'Dismiss',
    mercNone: 'You walk alone for now',
    mercHired: '{n} falls in beside you',
    mercLeft: '{n} stays behind',
    mercDown: '{n} is down — back up in {s}s',
    mercUpDone: '{n} stands a little firmer',
    mercBack: '{n} is on their feet again',
    mercMax: 'No further training possible',
    mercBusy: 'You already have a companion',
    mercLvTxt: 'Training {n}',
    mercAlive: 'HP {a} / {b}',

    mapTitle: '🗺 Continent Map',
    mapZoomIn: '＋ Zoom in', mapZoomOut: '－ Zoom out',
    mapYou: 'You', mapHarbor: 'Harbor', mapCape: 'Beacon Cape',
    mapDelve: 'Delve', mapUnseen: 'Unseen', mapGoal: 'Current goal',
    mapFoot: 'M / Esc to close · +/- to zoom',
    mapWp: 'Waystone', mapWpOff: 'Uncarved waystone', mapWarpBtn: '🚩 Travel',

    warpTitle: '🚩 Waystones',
    warpDesc: 'You may skip between stones you have carved. New ground is walked.',
    warpNone: 'You have carved no stones yet',
    warpHere: 'You are here',
    warpGo: 'Travel',
    warpCount: '{n} stones carved',
    warpNeedStone: 'You must stand at a stone to leave',
    warpReady: 'From here you may take any carved road',
    warpFoe: 'Something is close — you cannot leave now',
    warpPoor: 'Not enough for the passage',
    warpDone: 'You step down at {n}',
    warpDist: '{n} chunks · 🪙{g}',
    warpGoalNote: '★ Nearest stone to your goal — {n} ({d} chunks)',
    warpGoalNone: '★ No carved stone near your current goal yet',
    wpFound: '🚩 {n} — you cut your name into the stone ({c} total)',
    hintWaypointNew: 'F — carve your name into the stone',
    hintWaypointUse: 'F — choose a road from the stone',
    charmHome: 'The harbor light pulls you back',

    tutSkip: '(skip the lesson)',
    tutStart: 'Teach me',
    tutMove: '① Walk — WASD or the arrow keys',
    tutAttack: '② Space — swing whatever you carry',
    tutDash: '③ Shift — roll, and nothing touches you',
    tutTalk: '④ F — try it at the fire, or in front of someone',
    tutBag: '⑤ I — open your bag and check your gear',
    tutTree: '⑥ T — unfold the skill tree',
    tutTown: '⑦ Visit the healer or a shop',
    tutKill: '⑧ Take down one thing beyond the fence',
    tutDone: 'That is enough. Go back to the elder',
    tutSkipped: 'Lesson skipped',
    chapterNew: 'Ch. {n} — {t}',
    chapterEnd: '✦ End of Ch. {n} — {t}',
  },
};

/* ══════════════════════════ 아이템 ══════════════════════════ */
/* slot: weapon|armor|trinket|use|mat · price 0 = 상점 미취급 · cls = 전용 직업 */
DC.ITEMS = {
  /* ── 기사 무기 ── */
  rusty_dagger: {
    slot: 'weapon', cls: 'knight', icon: '🗡️', atk: 2, price: 0,
    n: { ko: '녹슨 단검', en: 'Rusty Dagger' },
    d: { ko: '표류물 더미에서 건진 물건. 없는 것보단 낫다.', en: 'Pulled from the driftwood. Better than fists.' },
  },
  drift_sword: {
    slot: 'weapon', cls: 'knight', icon: '⚔️', atk: 6, price: 90,
    n: { ko: '표류목 검', en: 'Driftwood Sword' },
    d: { ko: '소금기에 단단해진 나무심에 쇳조각을 박았다.', en: 'Salt-hardened core with iron shards driven in.' },
  },
  tide_saber: {
    slot: 'weapon', cls: 'knight', icon: '🌊', atk: 11, price: 260,
    n: { ko: '파도무늬 도', en: 'Tidewave Saber' },
    d: { ko: '날에 물결이 새겨져 있다. 베는 궤적이 길다.', en: 'Waves etched in the blade; the arc runs long.' },
  },
  beacon_steel: {
    slot: 'weapon', cls: 'knight', icon: '🔱', atk: 16, price: 0,
    n: { ko: '등대 강철검', en: 'Beacon Steel' },
    d: { ko: '등대 골조를 녹여 벼린 검. 어둠 속에서 희미하게 빛난다.', en: 'Forged from the beacon frame. It glows faintly in the dark.' },
  },

  /* ── 궁수 무기 ── */
  worn_bow: {
    slot: 'weapon', cls: 'ranger', icon: '🏹', atk: 2, price: 0,
    n: { ko: '해진 단궁', en: 'Frayed Shortbow' },
    d: { ko: '시위가 두 번 끊어졌다 이어졌다. 아직은 쏜다.', en: 'The string has snapped twice and been tied twice. It still shoots.' },
  },
  drift_bow: {
    slot: 'weapon', cls: 'ranger', icon: '🎯', atk: 6, price: 90,
    n: { ko: '표류목 활', en: 'Driftwood Bow' },
    d: { ko: '휘어 굳은 나무를 그대로 깎아 만들었다.', en: 'Carved straight from wood the sea already bent.' },
  },
  reef_longbow: {
    slot: 'weapon', cls: 'ranger', icon: '🌊', atk: 11, price: 260,
    n: { ko: '여울 장궁', en: 'Shoal Longbow' },
    d: { ko: '길고 무겁다. 대신 화살이 멀리 간다.', en: 'Long and heavy — and the arrow goes far.' },
  },
  beacon_bow: {
    slot: 'weapon', cls: 'ranger', icon: '✴️', atk: 16, price: 0,
    n: { ko: '등대 강철궁', en: 'Beacon Steel Bow' },
    d: { ko: '등대 골조로 만든 활. 시위를 당기면 낮게 운다.', en: 'A bow of beacon steel. Drawn, it hums low.' },
  },

  /* ── 마법사 무기 ── */
  cracked_rod: {
    slot: 'weapon', cls: 'mage', icon: '🪄', atk: 2, mp: 6, price: 0,
    n: { ko: '금 간 지팡이', en: 'Cracked Rod' },
    d: { ko: '난파선 돛대 조각. 아직 물기가 돈다.', en: 'A shard of the wreck’s mast. Still damp.' },
  },
  drift_rod: {
    slot: 'weapon', cls: 'mage', icon: '🔮', atk: 6, mp: 10, price: 90,
    n: { ko: '표류목 지팡이', en: 'Driftwood Rod' },
    d: { ko: '옹이에 소금이 박혀 원소가 잘 붙는다.', en: 'Salt in the knots — the elements take hold easily.' },
  },
  tide_rod: {
    slot: 'weapon', cls: 'mage', icon: '💠', atk: 11, mp: 16, price: 260,
    n: { ko: '조류 지팡이', en: 'Tidecall Rod' },
    d: { ko: '끝에 물이 고여 있다. 아무리 털어도 마르지 않는다.', en: 'Water pools at the tip and never dries.' },
  },
  beacon_rod: {
    slot: 'weapon', cls: 'mage', icon: '🕯️', atk: 16, mp: 20, price: 0,
    n: { ko: '등대 강철봉', en: 'Beacon Steel Rod' },
    d: { ko: '등대 골조를 녹여 감았다. 쥐면 손끝이 따뜻하다.', en: 'Wound from molten beacon steel. Warm in the hand.' },
  },

  /* ── 방어구 · 장신구 ── */
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
  keeper_lens: {
    slot: 'trinket', icon: '🔭', crit: 0.05, cdr: 0.10, hp: 15, price: 0,
    n: { ko: '등대지기의 렌즈', en: "Keeper's Lens" },
    d: { ko: '깨진 등롱 유리 조각. 멀리 있는 것이 가깝게 보인다.', en: 'A shard of lantern glass. Far things look near.' },
  },

  /* ── 소모품 · 재료 ── */
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
  salve: {
    slot: 'use', icon: '🫙', cleanse: true, heal: 20, price: 45, stack: 5,
    n: { ko: '소금 연고', en: 'Brine Salve' },
    d: { ko: '한기를 씻어낸다. 체력 20 회복.', en: 'Washes off the chill. Restores 20 HP.' },
  },
  home_charm: {
    slot: 'use', icon: '🪬', price: 55, stack: 5, warpHome: true,
    n: { ko: '귀환 부적', en: 'Homing Charm' },
    d: { ko: '어디서든 표착항으로 돌아간다. 적이 가까이 있으면 실이 끊긴다.',
      en: 'Takes you back to Castaway Harbor from anywhere. The thread snaps if something is close.' },
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
  drift_token: {
    slot: 'mat', icon: '🪙', price: 0, stack: 9, quest: true,
    n: { ko: '표류패', en: 'Drift Token' },
    d: { ko: '옛 등대망이 쓰던 통행패. 전직의 증표가 된다.', en: 'A passage token of the old beacon-chain. Proof enough to advance.' },
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
    ai: 'wraith', hp: 165, atk: 14, def: 3, spd: 74, xp: 90, gold: 60, r: 18, elite: true, chill: true,
    body: '#a78bfa', dark: '#5b21b6',
    n: { ko: '파수병 망령', en: 'Warden Shade' },
  },
  keeper: {
    ai: 'keeper', hp: 540, atk: 18, def: 5, spd: 64, xp: 340, gold: 220, r: 26, boss: true, chill: true,
    body: '#ef4444', dark: '#7f1d1d',
    n: { ko: '등대지기 망령', en: 'The Keeper Wraith' },
  },
};

/* ══════════════════════════ 액티브 스킬 ══════════════════════════ */
/* Q = s1 · E = s2 · R = 전직 전용 */
DC.SKILLS = {
  /* 기사 */
  whirl: {
    key: 'Q', icon: '🌀', mp: 8, cd: 6, radius: 78, mult: 1.5, kind: 'sweep',
    n: { ko: '회오리 베기', en: 'Whirl Slash' },
    d: { ko: '주변을 한 바퀴 베어 넘긴다.', en: 'Sweep everything around you.' },
  },
  bulwark: {
    key: 'E', icon: '🛡️', mp: 10, cd: 9, mult: 1.9, dash: 340, guard: 3.0, dr: 0.45, kind: 'charge',
    n: { ko: '방벽 돌진', en: 'Bulwark Charge' },
    d: { ko: '방패를 세우고 밀고 들어간다. 3초간 받는 피해 -45%.', en: 'Shield up and drive forward. Damage taken -45% for 3s.' },
  },
  /* 궁수 */
  volley: {
    key: 'Q', icon: '🏹', mp: 7, cd: 5, mult: 0.8, shots: 5, speed: 430, spread: 0.5, kind: 'fan',
    n: { ko: '화살 비', en: 'Arrow Rain' },
    d: { ko: '부채꼴로 화살 다섯 대를 뿌린다.', en: 'Fan five arrows outward.' },
  },
  pinshot: {
    key: 'E', icon: '🎯', mp: 9, cd: 7, mult: 2.6, pierce: 3, speed: 620, kind: 'shot',
    n: { ko: '꿰뚫기', en: 'Pin Shot' },
    d: { ko: '한 발로 줄줄이 꿰뚫는다.', en: 'One shot, straight through the line.' },
  },
  /* 마법사 */
  emberburst: {
    key: 'Q', icon: '🔥', mp: 12, cd: 6, mult: 1.7, radius: 96, kind: 'blast',
    n: { ko: '불씨 폭발', en: 'Ember Burst' },
    d: { ko: '앞쪽에 불씨를 터뜨린다.', en: 'Detonate an ember ahead of you.' },
  },
  frostlance: {
    key: 'E', icon: '❄️', mp: 8, cd: 4, mult: 1.35, pierce: 3, speed: 430, slow: 1.6, kind: 'shot',
    n: { ko: '서리 창', en: 'Frost Lance' },
    d: { ko: '얼음 창이 관통하며 적을 늦춘다.', en: 'An ice lance pierces through and slows.' },
  },

  /* 전직 전용 (R) */
  sanctuary: {
    key: 'R', icon: '✨', mp: 18, cd: 24, heal: 0.35, dr: 0.55, dur: 7, radius: 120, kind: 'aura',
    n: { ko: '성역', en: 'Sanctuary' },
    d: { ko: '발밑에 빛을 깐다. 7초간 회복 + 피해 -55%.', en: 'Light pools at your feet — heal and take 55% less for 7s.' },
  },
  frenzy: {
    key: 'R', icon: '💢', mp: 14, cd: 22, dur: 9, atk: 0.5, spd: 0.25, dr: -0.15, kind: 'buff',
    n: { ko: '광란', en: 'Frenzy' },
    d: { ko: '9초간 공격 +50%, 속도 +25%, 방어는 버린다.', en: 'For 9s: +50% attack, +25% speed, defense abandoned.' },
  },
  piercer: {
    key: 'R', icon: '➶', mp: 16, cd: 18, mult: 4.4, pierce: 9, speed: 780, kind: 'shot',
    n: { ko: '한 발', en: 'The One Shot' },
    d: { ko: '숨을 멈추고 한 발. 무엇이 서 있든 뚫는다.', en: 'Hold your breath. It goes through whatever stands there.' },
  },
  snarefield: {
    key: 'R', icon: '🕸️', mp: 16, cd: 20, count: 6, mult: 1.2, dur: 9, kind: 'traps',
    n: { ko: '덫 뿌리기', en: 'Snare Scatter' },
    d: { ko: '주변에 덫을 흩뿌린다. 밟으면 터지고 늦어진다.', en: 'Scatter snares around you — they burst and slow.' },
  },
  tempest: {
    key: 'R', icon: '🌪️', mp: 22, cd: 26, mult: 1.0, radius: 150, ticks: 7, kind: 'storm',
    n: { ko: '소용돌이', en: 'Maelstrom' },
    d: { ko: '머리 위로 물기둥을 세워 넓게 두드린다.', en: 'Raise a column of water and hammer a wide circle.' },
  },
  callshade: {
    key: 'R', icon: '👻', mp: 20, cd: 30, dur: 22, kind: 'summon',
    n: { ko: '그림자 부름', en: 'Call the Shade' },
    d: { ko: '안개에서 그림자를 불러 잠시 함께 싸운다.', en: 'Pull a shade out of the fog to fight beside you.' },
  },
};

/* ══════════════════════════ 직업 ══════════════════════════ */
DC.CLASSES = {
  knight: {
    icon: '🛡️', color: '#0ea5e9', atk: 'melee', s1: 'whirl', s2: 'bulwark',
    beacon: 'beacon_steel',
    n: { ko: '기사', en: 'Knight' },
    d: { ko: '3연타로 몰아치고 방벽으로 버틴다. 체력·방어가 가장 높다.',
      en: 'Presses with a three-hit chain and holds behind a bulwark. Highest health and defense.' },
    tip: { ko: '근접 · 튼튼함 · 쉬움', en: 'Melee · Sturdy · Forgiving' },
    stats: { str: 6, agi: 3, vit: 7, wil: 3 },
    hp: 96, mp: 35,
    equip: { weapon: 'rusty_dagger', armor: 'quilt_coat', trinket: null },
    bag: [{ id: 'potion', n: 2 }],
    grow: ['vit', 'str', 'vit', 'agi', 'str'],
  },
  ranger: {
    icon: '🏹', color: '#a3e635', atk: 'bow', s1: 'volley', s2: 'pinshot',
    beacon: 'beacon_bow',
    n: { ko: '궁수', en: 'Ranger' },
    d: { ko: '화살로 거리를 지배한다. 이동 속도와 치명타가 높고 몸이 가볍다.',
      en: 'Rules the distance with arrows. Quick and deadly, lightly built.' },
    tip: { ko: '원거리 · 빠름 · 보통', en: 'Ranged · Fast · Moderate' },
    stats: { str: 4, agi: 7, vit: 4, wil: 4 },
    hp: 72, mp: 40,
    equip: { weapon: 'worn_bow', armor: 'quilt_coat', trinket: null },
    bag: [{ id: 'potion', n: 2 }],
    grow: ['agi', 'agi', 'str', 'vit', 'wil'],
  },
  mage: {
    icon: '🔮', color: '#a78bfa', atk: 'staff', s1: 'emberburst', s2: 'frostlance',
    beacon: 'beacon_rod',
    n: { ko: '마법사', en: 'Mage' },
    d: { ko: '의지를 태워 원소를 던진다. 광역이 강하지만 체력이 가장 낮다.',
      en: 'Burns Will to throw the elements. Strong in a crowd, frail alone.' },
    tip: { ko: '원소 · 광역 · 어려움', en: 'Elemental · Wide · Demanding' },
    stats: { str: 3, agi: 4, vit: 3, wil: 8 },
    hp: 64, mp: 60,
    equip: { weapon: 'cracked_rod', armor: 'quilt_coat', trinket: null },
    bag: [{ id: 'potion', n: 1 }, { id: 'elixir', n: 2 }],
    grow: ['wil', 'wil', 'agi', 'vit', 'str'],
  },
};
DC.CLASS_ORDER = ['knight', 'ranger', 'mage'];
DC.DEFAULT_CLASS = 'knight';

/** 저장본에 직업이 없으면 기사로 폴백 */
DC.classOf = function (p) {
  return (p && DC.CLASSES[p.cls]) ? p.cls : DC.DEFAULT_CLASS;
};
DC.classDef = function (p) { return DC.CLASSES[DC.classOf(p)]; };

/* ══════════════════════════ 전직 ══════════════════════════ */
DC.ADV_LEVEL = 15;
DC.ADV_QUEST = 'm4_keeper';        // 이 챕터를 끝내야 갈림길이 열린다

DC.ADVANCES = {
  /* 기사 */
  warden: {
    from: 'knight', icon: '🕯️', color: '#eab308', skill: 'sanctuary',
    n: { ko: '등불 수호자', en: 'Lantern Warden' },
    d: { ko: '지키는 쪽을 고른다. 성역으로 아군과 자신을 붙든다.',
      en: 'You choose to hold. Sanctuary keeps you and yours standing.' },
    bonus: { maxHp: 0.18, def: 0.25, dr: 0.06 },
    grow: ['vit', 'vit', 'wil', 'str', 'vit'],
  },
  breaker: {
    from: 'knight', icon: '💢', color: '#ef4444', skill: 'frenzy',
    n: { ko: '파쇄자', en: 'Breaker' },
    d: { ko: '부수는 쪽을 고른다. 방어를 버리고 앞으로만 간다.',
      en: 'You choose to break. Defense abandoned, only forward.' },
    bonus: { atk: 0.22, crit: 0.04, maxHp: 0.05 },
    grow: ['str', 'str', 'agi', 'vit', 'str'],
  },
  /* 궁수 */
  farsight: {
    from: 'ranger', icon: '➶', color: '#7dd3fc', skill: 'piercer',
    n: { ko: '먼눈 사수', en: 'Farsight' },
    d: { ko: '한 발에 모든 것을 싣는다. 사거리와 한 방이 늘어난다.',
      en: 'Everything rides on one arrow. Range and impact both grow.' },
    bonus: { atk: 0.20, crit: 0.07, range: 0.30 },
    grow: ['str', 'agi', 'agi', 'wil', 'str'],
  },
  shadowfoot: {
    from: 'ranger', icon: '🕸️', color: '#a3e635', skill: 'snarefield',
    n: { ko: '그림자 발', en: 'Shadowfoot' },
    d: { ko: '적이 오는 길을 미리 망쳐둔다. 연사와 덫으로 싸운다.',
      en: 'Ruin the ground before they reach it — rapid fire and snares.' },
    bonus: { spd: 0.14, rate: 0.22, crit: 0.03 },
    grow: ['agi', 'agi', 'agi', 'vit', 'wil'],
  },
  /* 마법사 */
  tidecaller: {
    from: 'mage', icon: '🌪️', color: '#0ea5e9', skill: 'tempest',
    n: { ko: '조류술사', en: 'Tidecaller' },
    d: { ko: '물을 크게 쓴다. 광역이 넓어지고 의지가 깊어진다.',
      en: 'You use the water big. Wider blasts, deeper Will.' },
    bonus: { maxMp: 0.30, area: 0.25, regen: 0.6 },
    grow: ['wil', 'wil', 'wil', 'vit', 'agi'],
  },
  mistcaller: {
    from: 'mage', icon: '👻', color: '#a78bfa', skill: 'callshade',
    n: { ko: '안개 부름', en: 'Mistcaller' },
    d: { ko: '안개 속의 것과 거래한다. 잠시나마 남의 손을 빌린다.',
      en: 'You bargain with what lives in the fog — and borrow its hands.' },
    bonus: { maxMp: 0.18, atk: 0.10, summon: 1 },
    grow: ['wil', 'agi', 'wil', 'vit', 'str'],
  },
};
DC.ADV_OF = { knight: ['warden', 'breaker'], ranger: ['farsight', 'shadowfoot'], mage: ['tidecaller', 'mistcaller'] };

DC.advOf = function (p) {
  return (p && p.adv && DC.ADVANCES[p.adv] && DC.ADVANCES[p.adv].from === DC.classOf(p)) ? DC.ADVANCES[p.adv] : null;
};

/* ══════════════════════════ 기술의 나무 (직업별 3계열 × 3) ══════════════════════════ */
/* 기사 계열 id 는 옛 세이브(blade/tide/grit)와 같다 — 찍어둔 점수가 그대로 살아난다 */
DC.TREES = {
  knight: [
    { id: 'blade1', line: 0, tier: 0, icon: '⚔️', reqLv: 1,
      n: { ko: '연격 강화', en: 'Chained Edge' }, d: { ko: '연타 피해 +20%', en: 'Combo damage +20%' } },
    { id: 'blade2', line: 0, tier: 1, icon: '🩸', reqLv: 3,
      n: { ko: '처형', en: 'Execute' }, d: { ko: '체력 30% 이하 적에게 +40%', en: '+40% vs enemies below 30% HP' } },
    { id: 'blade3', line: 0, tier: 2, icon: '💥', reqLv: 6,
      n: { ko: '폭풍의 검', en: 'Storm Blade' }, d: { ko: '3타 마무리에 충격파', en: 'Combo finisher releases a shockwave' } },

    { id: 'tide1', line: 1, tier: 0, icon: '🛡️', reqLv: 1,
      n: { ko: '굳은 방벽', en: 'Set Bulwark' }, d: { ko: '방벽 돌진 피해 +35%, 감쇄 +10%', en: 'Bulwark Charge +35% damage, +10% mitigation' } },
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
  ],
  ranger: [
    { id: 'aim1', line: 0, tier: 0, icon: '🎯', reqLv: 1,
      n: { ko: '예리한 촉', en: 'Keen Head' }, d: { ko: '기본 화살 피해 +25%', en: 'Basic arrow damage +25%' } },
    { id: 'aim2', line: 0, tier: 1, icon: '🩸', reqLv: 3,
      n: { ko: '급소', en: 'Soft Spot' }, d: { ko: '치명타 확률 +8%', en: 'Crit chance +8%' } },
    { id: 'aim3', line: 0, tier: 2, icon: '➶', reqLv: 6,
      n: { ko: '관통 사격', en: 'Through-Shot' }, d: { ko: '기본 화살 관통 +1', en: 'Basic arrows pierce +1' } },

    { id: 'vol1', line: 1, tier: 0, icon: '🏹', reqLv: 1,
      n: { ko: '잰 손', en: 'Quick Hands' }, d: { ko: '연사 속도 +20%, 화살 비 +1발', en: 'Fire rate +20%, Arrow Rain +1 shot' } },
    { id: 'vol2', line: 1, tier: 1, icon: '📌', reqLv: 3,
      n: { ko: '못박기', en: 'Nail Down' }, d: { ko: '꿰뚫기 피해 +40%', en: 'Pin Shot damage +40%' } },
    { id: 'vol3', line: 1, tier: 2, icon: '🎇', reqLv: 6,
      n: { ko: '이중 시위', en: 'Twin String' }, d: { ko: '화살 비가 두 겹으로 나간다', en: 'Arrow Rain fires a second layer' } },

    { id: 'swf1', line: 2, tier: 0, icon: '👟', reqLv: 1,
      n: { ko: '가벼운 발', en: 'Light Feet' }, d: { ko: '이동 속도 +12%', en: 'Move speed +12%' } },
    { id: 'swf2', line: 2, tier: 1, icon: '🌬️', reqLv: 3,
      n: { ko: '미끄러짐', en: 'Slip' }, d: { ko: '회피 대기 -30%, 무적 +0.05초', en: 'Dodge cooldown -30%, i-frames +0.05s' } },
    { id: 'swf3', line: 2, tier: 2, icon: '💨', reqLv: 6,
      n: { ko: '잔상', en: 'Afterimage' }, d: { ko: '회피 후 1.5초 치명 +25%', en: 'Crit +25% for 1.5s after a dodge' } },
  ],
  mage: [
    { id: 'emb1', line: 0, tier: 0, icon: '🔥', reqLv: 1,
      n: { ko: '타오름', en: 'Kindle' }, d: { ko: '불씨 폭발 피해 +30%', en: 'Ember Burst damage +30%' } },
    { id: 'emb2', line: 0, tier: 1, icon: '🕯️', reqLv: 3,
      n: { ko: '잔불', en: 'Embers' }, d: { ko: '폭발 자리가 잠시 타오른다', en: 'The blast site burns for a while' } },
    { id: 'emb3', line: 0, tier: 2, icon: '💥', reqLv: 6,
      n: { ko: '대폭발', en: 'Detonation' }, d: { ko: '불씨 폭발 범위 +40%', en: 'Ember Burst radius +40%' } },

    { id: 'frs1', line: 1, tier: 0, icon: '❄️', reqLv: 1,
      n: { ko: '깊은 서리', en: 'Deep Frost' }, d: { ko: '서리 창 관통 +2, 둔화 강화', en: 'Frost Lance pierce +2, stronger slow' } },
    { id: 'frs2', line: 1, tier: 1, icon: '🧊', reqLv: 3,
      n: { ko: '결빙', en: 'Lock Ice' }, d: { ko: '둔화된 적에게 피해 +25%', en: '+25% damage to slowed enemies' } },
    { id: 'frs3', line: 1, tier: 2, icon: '💠', reqLv: 6,
      n: { ko: '서리 폭풍', en: 'Frostfall' }, d: { ko: '서리 창 명중 시 작은 폭발', en: 'Frost Lance bursts on hit' } },

    { id: 'man1', line: 2, tier: 0, icon: '💧', reqLv: 1,
      n: { ko: '마르지 않는 샘', en: 'Deep Well' }, d: { ko: '의지 재생 +120%', en: 'Will regeneration +120%' } },
    { id: 'man2', line: 2, tier: 1, icon: '🪶', reqLv: 3,
      n: { ko: '절약', en: 'Thrift' }, d: { ko: '기술 의지 소모 -20%', en: 'Skill Will cost -20%' } },
    { id: 'man3', line: 2, tier: 2, icon: '🔷', reqLv: 6,
      n: { ko: '각인', en: 'Etching' }, d: { ko: '기본 공격 의지 소모 없음 (피해 -15%)', en: 'Basic attack costs no Will (damage -15%)' } },
  ],
};
DC.TREE_LINES = {
  knight: [['⚔️', { ko: '검로', en: 'Blade' }], ['🛡️', { ko: '방벽', en: 'Bulwark' }], ['🧱', { ko: '강인', en: 'Grit' }]],
  ranger: [['🎯', { ko: '조준', en: 'Aim' }], ['🏹', { ko: '사격술', en: 'Volley' }], ['👟', { ko: '질주', en: 'Swift' }]],
  mage: [['🔥', { ko: '불씨', en: 'Ember' }], ['❄️', { ko: '서리', en: 'Frost' }], ['💧', { ko: '원천', en: 'Well' }]],
};

/** 전 직업 노드를 합친 평면 목록 — id 로 찾는 코드가 쓴다 */
DC.TREE = (function () {
  var all = [];
  DC.CLASS_ORDER.forEach(function (c) {
    DC.TREES[c].forEach(function (nd) {
      var copy = {};
      for (var k in nd) if (Object.prototype.hasOwnProperty.call(nd, k)) copy[k] = nd[k];
      copy.cls = c;
      all.push(copy);
    });
  });
  return all;
})();
DC.treeOf = function (p) { return DC.TREES[DC.classOf(p)]; };
DC.treeNode = function (id) {
  for (var i = 0; i < DC.TREE.length; i++) if (DC.TREE[i].id === id) return DC.TREE[i];
  return null;
};

/* ══════════════════════════ 동료 (용병) ══════════════════════════ */
DC.MERCS = {
  pike: {
    icon: '🔱', color: '#0ea5e9', role: 'tank', cost: 180,
    hp: 78, atk: 9, spd: 152, range: 46, rate: 1.1,
    n: { ko: '창잡이 게일', en: 'Gale the Pikehand' },
    d: { ko: '앞에 서서 받아낸다. 적을 자기 쪽으로 끌어당긴다.',
      en: 'Stands in front and takes it. Pulls attention onto himself.' },
  },
  bow: {
    icon: '🏹', color: '#a3e635', role: 'ranged', cost: 200,
    hp: 50, atk: 8, spd: 162, range: 330, rate: 1.35,
    n: { ko: '사수 노라', en: 'Nora the Loose' },
    d: { ko: '뒤에서 화살을 보탠다. 몸은 약하니 앞세우지 말 것.',
      en: 'Adds arrows from behind. Frail — do not put her in front.' },
  },
  chant: {
    icon: '🕯️', color: '#eab308', role: 'healer', cost: 240,
    hp: 58, atk: 5, spd: 156, range: 70, rate: 1.6, heal: 8, healCd: 4.5,
    n: { ko: '읊는 이 세하', en: 'Seha the Chanter' },
    d: { ko: '싸우다 말고 노래한다. 곁에 있으면 상처가 빨리 아문다.',
      en: 'Sings mid-fight. Wounds close faster with her nearby.' },
  },
};
DC.MERC_ORDER = ['pike', 'bow', 'chant'];
DC.MERC_MAXLV = 8;
DC.MERC_DOWN = 40;                  // 쓰러진 뒤 스스로 일어나기까지(초)

/** 단련 단계별 능력치 — 금화로만 올린다 */
DC.mercStat = function (id, lv) {
  var d = DC.MERCS[id];
  if (!d) return null;
  var k = 1 + (Math.max(1, lv || 1) - 1) * 0.22;
  return {
    hp: Math.round(d.hp * k), atk: Math.round(d.atk * k * 10) / 10,
    spd: d.spd, range: d.range, rate: d.rate, heal: d.heal ? Math.round(d.heal * k) : 0,
    healCd: d.healCd || 0,
  };
};
DC.mercUpCost = function (lv) { return 90 + 70 * Math.max(1, lv || 1); };
DC.MERC_REVIVE_COST = 60;

/* ══════════════════════════ 성장 곡선 ══════════════════════════ */
/** 레벨 lv → lv+1 에 필요한 경험치 */
DC.xpNeed = function (lv) { return 30 + 22 * lv + 6 * lv * lv; };
DC.MAX_LEVEL = 30;

/* ══════════════════════════ 상점 ══════════════════════════ */
/* 직업 전용 무기는 renderShop 이 직업으로 걸러낸다 */
DC.SHOPS = {
  smith: ['drift_sword', 'tide_saber', 'drift_bow', 'reef_longbow', 'drift_rod', 'tide_rod',
    'leather_vest', 'chain_mail'],
  herbalist: ['potion', 'potion_hi', 'elixir', 'salve', 'home_charm', 'castaway_charm'],
  wanderer: ['potion_hi', 'elixir', 'salve', 'home_charm', 'castaway_charm', 'tide_saber', 'reef_longbow', 'tide_rod', 'chain_mail'],
};

/* ══════════════════════════ 웨이포인트 이름 ══════════════════════════
 * 비석 하나하나에 대사를 붙일 수는 없으니 두 낱말을 좌표 해시로 조합한다.
 * 목록에는 청크 좌표가 함께 나오므로 이름이 겹쳐도 헷갈리지 않는다.
 * ────────────────────────────────────────────────────────────────── */
DC.WP_WORDS = {
  a: [
    { ko: '소금', en: 'Salt' }, { ko: '서리', en: 'Rime' }, { ko: '잿빛', en: 'Cinder' },
    { ko: '안개', en: 'Fog' }, { ko: '오래된', en: 'Old' }, { ko: '바람', en: 'Wind' },
    { ko: '검은', en: 'Black' }, { ko: '부서진', en: 'Broken' }, { ko: '물결', en: 'Tide' },
    { ko: '마른', en: 'Dry' }, { ko: '이끼', en: 'Moss' }, { ko: '별', en: 'Star' },
  ],
  b: [
    { ko: '이정표', en: 'Marker' }, { ko: '노두', en: 'Outcrop' }, { ko: '디딤돌', en: 'Steppingstone' },
    { ko: '표석', en: 'Waystone' }, { ko: '초소', en: 'Post' }, { ko: '문턱', en: 'Threshold' },
    { ko: '갈림돌', en: 'Fork Stone' }, { ko: '눈금돌', en: 'Tally Stone' },
  ],
};

/** 웨이포인트 정의 → 표시 이름. 앵커 둘은 지역 이름을 그대로 쓴다 */
DC.wpName = function (w) {
  if (!w) return '';
  if (w.wid === 'home') return DC.tx(DC.ZONES.harbor);
  if (w.wid === 'cape') return DC.tx(DC.ZONES.cape);
  var A = DC.WP_WORDS.a, Bw = DC.WP_WORDS.b;
  var a = A[Math.floor((w.n1 || 0) * A.length) % A.length];
  var b = Bw[Math.floor((w.n2 || 0) * Bw.length) % Bw.length];
  return DC.tx(a) + ' ' + DC.tx(b);
};

/* ══════════════════════════ 메인 스토리 (8챕터) ══════════════════════════
 * 챕터 하나가 다음 챕터의 동기를 만든다. 목표 지역이 챕터마다 바뀌어
 * 표착항 → 근교 → 등대 곶 → 원거리 티어 → 갱도 → 최외곽으로 대륙을 실제로 쓰게 한다.
 *
 * goal.type
 *   flag     S.flags[flag] 가 서면 완료
 *   killAny  아무 적 count 마리
 *   kill     특정 종 count 마리
 *   collect  아이템 count 개
 *   counter  S.counters[key] ≥ count
 *   tier     S.counters.maxTier ≥ tier (표착항에서 얼마나 멀리 갔는가)
 * ────────────────────────────────────────────────────────────────── */
DC.MAIN = [
  {
    id: 'm1_awake', ch: 1, giver: 'elder',
    n: { ko: '떠밀려 온 아침', en: 'The Morning It Spat You Out' },
    d: { ko: '표착항에서 몸을 추스르고, 장로 릴로에게 살아가는 법을 배운다.',
      en: 'Get your legs under you in Castaway Harbor and let Elder Rilo teach you how to live here.' },
    area: { ko: '표착항', en: 'Castaway Harbor' },
    goal: { type: 'flag', flag: 'tutorial_done' },
    reward: { xp: 40, gold: 40, items: ['potion'] },
    offer: {
      ko: '눈을 떴군. 어젯밤 파도가 자네를 부두에 얹어 놓고 갔네. …놀라지 말게, 여기 사는 사람은 전부 그렇게 왔어.\n일어설 수 있으면 몇 가지만 알려주지. 표착항에서 사흘을 넘기려면 그 정도는 알아야 해.',
      en: 'Awake, then. The tide set you on the pier last night and left. …Do not look so startled — everyone here arrived the same way.\nIf you can stand, let me show you a few things. You need that much to last three days in Castaway Harbor.',
    },
    go: {
      ko: '천천히 해. 몸이 기억하는 게 있을 걸세 — 손이 먼저 움직일 거야.',
      en: 'Take your time. Your body remembers something — the hands move first.',
    },
    wait: {
      ko: '아직 다 못 해봤군. 서두를 것 없네, 다만 등 뒤는 늘 보게.',
      en: 'Not through it yet. No rush — only, always watch behind you.',
    },
    report: {
      ko: '됐네. 이제 자네는 손님이 아니라 주민이야.\n…그리고 주민이 되었으니 말해 주지. 사흘 전부터 등대가 꺼져 있네. 등대가 꺼지면 배가 안 들어오고, 배가 안 들어오면 겨울에 이 마을은 없어져.',
      en: 'That will do. You are not a guest now — you are a resident.\n…And since you are, you should know: the beacon has been dark three nights. No light, no ships. No ships, and this town does not survive winter.',
    },
    outro: { ko: '표착항이 자네를 받아들였다.', en: 'Castaway Harbor has taken you in.' },
  },
  {
    id: 'm2_fence', ch: 2, giver: 'elder',
    n: { ko: '울타리 밖', en: 'Beyond the Fence' },
    d: { ko: '마을 울타리 밖의 것들을 여섯 마리 정리해 길을 튼다.',
      en: 'Clear six of the things outside the palisade and open the road.' },
    area: { ko: '표착항 근교 (티어 1~2)', en: 'Harbor outskirts (Tier 1–2)' },
    goal: { type: 'killAny', count: 6 },
    reward: { xp: 90, gold: 70, items: ['potion', 'potion'] },
    offer: {
      ko: '등대까지 가려면 먼저 마을 문을 나서야 하는데, 울타리 밖이 요새 소란해. 갯바위 것들이 길까지 올라왔네.\n여섯 마리쯤 줄이면 사람들이 다시 다닐 걸세.',
      en: 'To reach the beacon you must first walk out the gate — and lately the ground outside is busy. The tidepool things have crawled up onto the road.\nThin six of them and folk will use it again.',
    },
    go: { ko: '문은 네 방향 다 열려 있네. 어디로 나가도 좋아.', en: 'All four gates stand open. Pick any of them.' },
    wait: { ko: '여섯. 세면서 하게. 무리하면 여관에서 다시 눈을 뜨게 될 거야.', en: 'Six. Keep count. Overreach and you wake at the inn.' },
    report: {
      ko: '길이 트였군. …이제 곶 이야기를 해야겠네. 촌장 하란이 자네를 기다리고 있어. 그 노인이 먼저 말을 꺼내지 않는 건, 부탁이 무겁다는 뜻이야.',
      en: 'The road is open. …Now the cape. Chief Haran is waiting for you. When that man does not speak first, it means the favor is heavy.',
    },
    outro: { ko: '길이 열렸다. 촌장이 기다린다.', en: 'The road is open. The chief is waiting.' },
  },
  {
    id: 'm3_signal', ch: 3, giver: 'chief',
    n: { ko: '꺼진 등대', en: 'The Dark Beacon' },
    d: { ko: '동쪽 등대 곶으로 가서 등대 안으로 들어간다.',
      en: 'Reach the cape to the east and step inside the lighthouse.' },
    area: { ko: '등대 곶 (동쪽)', en: 'Beacon Cape (east)' },
    goal: { type: 'flag', flag: 'entered_lighthouse' },
    reward: { xp: 160, gold: 90, items: ['potion_hi', 'potion_hi'] },
    offer: {
      ko: '릴로가 보냈군. …사흘째야. 등대지기 노인이 폭풍 날 밤에 올라간 뒤로 내려오질 않았네.\n곶에 다녀온 젊은 것들은 하나같이 같은 말을 해 — 안에서 누가 부른다고.\n누가 부르는지 확인해 주게. 그게 전부야. 싸우라고는 안 하네.',
      en: 'Rilo sent you. …Three nights now. The old keeper climbed up the night of the storm and never came down.\nEveryone who nears the cape says the same thing — someone is calling from inside.\nFind out who is calling. That is all. I am not asking you to fight.',
    },
    go: { ko: '동쪽 곶이야. 늑대 골짜기는 돌아가게. 도로한테 내 이름 대면 값을 좀 깎아줄 걸세.',
      en: 'East cape. Go around the wolf vale. Tell Doro I sent you — he might shave the price.' },
    wait: { ko: '아직 곶에 안 갔나? 문은 열려 있을 걸세 — 열려 있는 게 더 무섭지만.',
      en: 'Not gone yet? The door will be open — which frightens me more than a locked one.' },
    report: {
      ko: '들어갔다 나왔다고? …자네 얼굴빛이 안 좋군. 안에 뭐가 있었나. 아니, 말하지 말게.\n대신 부탁 하나 더 하지. 이번엔 싸우라고 하는 걸세.',
      en: 'You went in and came out? Your face says enough. Do not tell me.\nInstead — one more favor. This time I am asking you to fight.',
    },
    outro: { ko: '등대 안의 것이 무엇인지 알았다.', en: 'You know now what is inside the lighthouse.' },
  },
  {
    id: 'm4_keeper', ch: 4, giver: 'chief',
    n: { ko: '등롱실의 마지막 밤', en: "The Keeper's Last Night" },
    d: { ko: '등대 3층 등롱실 꼭대기의 망령을 잠재운다.',
      en: 'Put the wraith in the third-floor lantern room to rest.' },
    area: { ko: '가라앉은 등대 F1~F3', en: 'Sunken Lighthouse F1–F3' },
    goal: { type: 'flag', flag: 'boss_down' },
    reward: { xp: 520, gold: 300, items: ['keeper_lens', 'drift_token'] },
    offer: {
      ko: '등롱실 꼭대기, 거기 있는 게 무엇이든 잠재워 주게. 등대지기 노인이었다면… 편히 보내주고.\n중간 문들은 잠겨 있을 걸세. 열쇠는 안에 있어 — 늘 그렇듯이.',
      en: 'Whatever sits in the lantern room — put it to rest. And if it was the old keeper… let him go gently.\nThe inner doors are locked. The keys are inside — they always are.',
    },
    go: { ko: '3층이야. 살아 돌아오는 게 첫째고, 불을 켜는 건 둘째일세.',
      en: 'Third floor. Coming back alive is first. Lighting the lamp is second.' },
    wait: { ko: '등롱실은 3층이야. 2층 갤러리의 그림자는 눈을 마주치지 말게.',
      en: 'Lantern room is the third floor. On the second, do not meet the shadow’s eyes.' },
    report: {
      ko: '불이 들어왔네. 오늘 밤 배가 셋이나 들어왔어. 자네 덕이야.\n…그런데 어젯밤 서쪽 바다에서도 불빛을 봤다는 사람이 있네. 우리 등대는 하나뿐인데 말이야.',
      en: 'The lamp is lit. Three ships docked tonight. Your doing.\n…Though someone saw a light to the west last night. We only have the one beacon.',
    },
    outro: { ko: '등대에 불이 돌아왔다. 그런데 서쪽에도 불빛이 있다.', en: 'The beacon burns again — but something burns to the west too.' },
  },
  {
    id: 'm5_westlight', ch: 5, giver: 'chief',
    n: { ko: '서쪽에서 온 불빛', en: 'The Light From the West' },
    d: { ko: '표착항에서 한참 떨어진 땅(티어 4 이상)까지 나가 서쪽 불빛의 정체를 확인한다.',
      en: 'Push far out from the harbor — into Tier 4 country — and find what burns to the west.' },
    area: { ko: '원거리 지역 (티어 4)', en: 'Far country (Tier 4)' },
    goal: { type: 'tier', tier: 4 },
    reward: { xp: 700, gold: 380, items: ['potion_hi', 'potion_hi', 'elixir', 'drift_token'] },
    offer: {
      ko: '자네가 아니면 부탁할 사람이 없어. 서쪽으로 한참 나가 보게. 표착항에서 멀어질수록 땅이 사나워지니 준비를 단단히 하고.\n돌아와서 무엇을 봤는지만 말해주게.',
      en: 'There is no one else to ask. Go west — far. The land gets meaner the farther you are from the harbor, so go prepared.\nCome back and tell me only what you saw.',
    },
    go: { ko: '지도를 자주 보게(M). 돌아올 길은 항상 세어 두고.', en: 'Check your map often (M). Always count your way back.' },
    wait: { ko: '아직 멀리 못 갔군. 표착항이 멀어질수록 티어가 올라가네 — 지도 우하단 숫자를 보게.',
      en: 'Not far enough yet. The farther from the harbor, the higher the tier — watch the number on your map.' },
    report: {
      ko: '등대였다고? …하나가 아니라. 그럼 옛말이 사실이었군.\n표류 대륙에는 등대가 여럿 있었고, 그것들이 하나씩 꺼지면서 배들이 여기로 떠밀려 온 거야. 우리 전부가 그 증거였던 셈이지.',
      en: 'A beacon? …So not one. Then the old talk was true.\nThere were many beacons on this continent, and as they went dark one by one the ships drifted here. All of us were the proof.',
    },
    outro: { ko: '등대는 하나가 아니었다.', en: 'There was never only one beacon.' },
  },
  {
    id: 'm6_delve', ch: 6, giver: 'steward',
    n: { ko: '돌 아래의 길', en: 'The Road Under the Stone' },
    d: { ko: '무너진 갱도 세 곳을 열어 등대망을 잇던 옛 길을 확인한다.',
      en: 'Open three collapsed delves and trace the old road that linked the beacons.' },
    area: { ko: '대륙 각지의 미니 던전 (갱도)', en: 'Delves across the continent' },
    goal: { type: 'counter', key: 'delves', count: 3 },
    reward: { xp: 900, gold: 450, items: ['potion_hi', 'potion_hi', 'salve', 'salve'] },
    offer: {
      ko: '촌장님 얘기 들었습니다. 등대가 여럿이었다면 그걸 잇는 길도 있었겠지요.\n게시판에 오래된 지도 조각이 붙어 있었는데, 석상 아래 갱도가 서로 통한다는 얘기였어요. 세 군데만 열어봐 주세요.',
      en: 'I heard the chief. If there were many beacons, there was a road between them.\nAn old map scrap was pinned here — it said the delves under the standing stones connect. Open three of them.',
    },
    go: { ko: '지도(M)에서 보라색 점이 갱도 입구입니다. 들어가기 전에 물약은 챙기시고요.',
      en: 'On the map (M), the violet dots are delve mouths. Take potions before you go down.' },
    wait: { ko: '아직 {n} 군데군요. 갱도는 깊이 들어갈수록 값이 나갑니다.',
      en: 'Only some so far. The deeper the delve, the better it pays.' },
    report: {
      ko: '전부 같은 돌로 쌓았네요. 같은 사람들이 판 겁니다.\n…이 표식, 석상에도 있었어요. 릴로 어르신께 보여드리세요. 그분이 옛 글자를 읽습니다.',
      en: 'All the same stonework. The same hands dug them.\n…This mark — it is on the standing stones too. Show Elder Rilo. He reads the old letters.',
    },
    outro: { ko: '갱도는 서로 통해 있었다.', en: 'The delves were all connected.' },
  },
  {
    id: 'm7_stones', ch: 7, giver: 'elder',
    n: { ko: '옛 사람들의 글귀', en: 'What the Old Folk Wrote' },
    d: { ko: '대륙 각지의 석상 다섯 개를 읽어 등대망의 마지막 자리를 찾는다.',
      en: 'Read five standing stones across the continent and find the last place on the beacon-chain.' },
    area: { ko: '대륙 각지의 석상', en: 'Standing stones, continent-wide' },
    goal: { type: 'counter', key: 'statues', count: 5 },
    reward: { xp: 1200, gold: 520, items: ['wraith_sigil', 'drift_token'] },
    offer: {
      ko: '세하가 가져온 표식 봤네. 이건 이름일세 — 등대의 이름.\n석상마다 하나씩 새겨져 있어. 다섯 개만 읽어 오게. 그럼 마지막 등대가 어디 있는지 나올 걸세.',
      en: 'I saw the mark. It is a name — the name of a beacon.\nOne is cut into each standing stone. Read five of them and the last beacon will name itself.',
    },
    go: { ko: '석상은 지도에서 흰 점이야. 한 번 읽으면 머릿속에 남으니 두 번 갈 필요 없네.',
      en: 'Standing stones are the white dots on your map. Read one and it stays in your head — no need to return.' },
    wait: { ko: '다섯일세. 하나씩 늘 때마다 글자가 이어지는 게 느껴질 거야.',
      en: 'Five. With each one you will feel the letters joining up.' },
    report: {
      ko: '…“먼 기슭”. 마지막 등대의 이름이야. 대륙 끝, 아무도 안 가는 데지.\n자네가 거기까지 갈 사람인지는 자네가 알겠지. 다만 이건 알아두게 — 그 불을 켜면, 떠밀려 오는 사람이 더는 없네.',
      en: '…“Farshore.” The last beacon’s name. The far edge, where no one goes.\nOnly you know whether you are the sort who walks that far. But know this — light it, and no one drifts here again.',
    },
    outro: { ko: '마지막 등대의 이름은 「먼 기슭」이다.', en: 'The last beacon is named Farshore.' },
  },
  {
    id: 'm8_farshore', ch: 8, giver: 'chief',
    n: { ko: '먼 기슭의 등불', en: 'The Lamp at Farshore' },
    d: { ko: '대륙 최외곽(티어 5)까지 나가 파수병 망령 셋을 잠재우고 마지막 등대에 불을 붙인다.',
      en: 'Reach the outermost country (Tier 5), put three warden shades to rest, and light the last beacon.' },
    area: { ko: '대륙 최외곽 (티어 5)', en: 'Outermost country (Tier 5)' },
    goal: { type: 'kill', enemy: 'wraith', count: 3 },
    reward: { xp: 2000, gold: 900, items: ['keeper_lens'] },
    offer: {
      ko: '릴로가 이름을 찾았다더군. 먼 기슭.\n거기 등대를 지키던 것들이 아직 남아 있을 걸세 — 파수병이라 부르던 것들이야. 셋은 잠재워야 등롱까지 갈 수 있어.\n…자네가 돌아오면, 이 마을은 더 이상 표착항이 아닐 걸세.',
      en: 'Rilo found the name. Farshore.\nWhatever guarded that beacon is still there — wardens, they called them. Three must be put down before you reach the lamp.\n…If you come back, this town stops being a place people wash up in.',
    },
    go: { ko: '가장 바깥이야. 지도에서 티어 5. 살아 돌아오게.', en: 'The outermost ring. Tier 5 on your map. Come back alive.' },
    wait: { ko: '파수병은 순간이동을 하네. 등 뒤를 늘 비워두게.', en: 'Wardens blink. Never leave your back full.' },
    report: {
      ko: '…불이 들어왔군. 서쪽 하늘이 밝네.\n오늘부터 표착항은 사람이 떠밀려 오는 곳이 아니라, 사람이 찾아오는 항구일세. 자네가 그렇게 만들었어.',
      en: '…It is lit. The western sky is bright.\nFrom today Castaway Harbor is not where people wash up — it is where people arrive. You did that.',
    },
    outro: { ko: '먼 기슭에 불이 들어왔다. 표류 대륙의 첫 장이 끝난다.', en: 'Farshore burns. The first book of the Drift Continent closes.' },
  },
];
DC.MAIN_ORDER = DC.MAIN.map(function (c) { return c.id; });
DC.MAIN_COUNT = DC.MAIN.length;

/* ══════════════════════════ 곁가지 · 상시 의뢰 ══════════════════════════ */
/* state: 0 미수락 · 1 진행 · 2 보고 가능 · 3 완료 */
DC.SIDE = {
  side_herb: {
    kind: 'side', board: true, giver: 'herbalist',
    n: { ko: '바닷바람 약초', en: 'Seawind Herbs' },
    d: { ko: '약초상 셀린에게 줄 약초 5개를 캔다.', en: 'Gather 5 herbs for Selin the herbalist.' },
    area: { ko: '남쪽 비탈 · 숲', en: 'South slopes and woods' },
    goal: { type: 'collect', item: 'herb', count: 5 },
    reward: { xp: 60, gold: 40, items: ['potion_hi', 'potion_hi', 'potion_hi'] },
  },
  side_wolf: {
    kind: 'side', board: true, giver: 'elder',
    n: { ko: '골짜기의 이빨', en: 'Teeth in the Vale' },
    d: { ko: '늑대 골짜기의 잿빛 늑대 8마리를 정리한다.', en: 'Thin the ash wolves — 8 of them.' },
    area: { ko: '늑대 골짜기', en: 'Wolf Vale' },
    goal: { type: 'kill', enemy: 'wolf', count: 8 },
    reward: { xp: 80, gold: 60, items: ['tide_ring'] },
  },
  side_shade: {
    kind: 'side', board: true, giver: 'healer',
    n: { ko: '한기를 씻는 법', en: 'Washing Off the Chill' },
    d: { ko: '망령의 한기를 씻을 소금 연고 재료로 약초 8개를 모은다.',
      en: 'Bring 8 herbs — the brine salve that scrubs off a wraith’s chill needs them.' },
    area: { ko: '표착항 근교', en: 'Harbor outskirts' },
    goal: { type: 'collect', item: 'herb', count: 8 },
    reward: { xp: 140, gold: 90, items: ['salve', 'salve', 'salve'] },
  },
};

/* 상시 의뢰 — 무한 반복. 보상은 소액이되 완료 횟수에 따라 조금씩 오른다 */
DC.REPEAT = {
  rep_cull: {
    kind: 'repeat', board: true, giver: 'steward', icon: '↻',
    n: { ko: '상시 의뢰 · 길 정리', en: 'Standing Work · Clear the Road' },
    d: { ko: '아무 적이나 10마리를 정리한다. 언제든 다시 받을 수 있다.',
      en: 'Put down any ten things. Always available.' },
    area: { ko: '어디든', en: 'Anywhere' },
    goal: { type: 'killAny', count: 10 },
    reward: { xp: 70, gold: 55, items: [] },
  },
  rep_gather: {
    kind: 'repeat', board: true, giver: 'steward', icon: '↻',
    n: { ko: '상시 의뢰 · 약초 수급', en: 'Standing Work · Herb Supply' },
    d: { ko: '바닷바람 약초 6개를 게시판에 납품한다. 언제든 다시 받을 수 있다.',
      en: 'Deliver six seawind herbs to the board. Always available.' },
    area: { ko: '숲 · 비탈 · 이끼 어귀', en: 'Woods, slopes, moss hollows' },
    goal: { type: 'collect', item: 'herb', count: 6 },
    reward: { xp: 55, gold: 45, items: ['potion'] },
  },
  rep_delve: {
    kind: 'repeat', board: true, giver: 'steward', icon: '↻',
    n: { ko: '상시 의뢰 · 갱도 순찰', en: 'Standing Work · Delve Patrol' },
    d: { ko: '갱도 한 곳의 보물을 확보한다. 티어가 높을수록 값이 나간다.',
      en: 'Secure the prize in one delve. The higher the tier, the better it pays.' },
    area: { ko: '대륙 각지의 갱도', en: 'Delves, continent-wide' },
    goal: { type: 'counter', key: 'delves', count: 1, rel: true },
    reward: { xp: 120, gold: 95, items: ['potion_hi'] },
  },
};

/* ══════════════════════════ 통합 퀘스트 테이블 ══════════════════════════ */
DC.QUESTS = {};
DC.MAIN.forEach(function (c) {
  DC.QUESTS[c.id] = {
    kind: 'main', ch: c.ch, giver: c.giver, n: c.n, d: c.d, area: c.area,
    goal: c.goal, reward: c.reward, outro: c.outro,
  };
});
Object.keys(DC.SIDE).forEach(function (k) { DC.QUESTS[k] = DC.SIDE[k]; });
Object.keys(DC.REPEAT).forEach(function (k) { DC.QUESTS[k] = DC.REPEAT[k]; });

DC.SIDE_ORDER = ['side_herb', 'side_wolf', 'side_shade'];
DC.REPEAT_ORDER = ['rep_cull', 'rep_gather', 'rep_delve'];
DC.QUEST_ORDER = DC.MAIN_ORDER.concat(DC.SIDE_ORDER, DC.REPEAT_ORDER);

/** 퀘스트 진행 상태 조회 (0 미수락 · 1 진행 · 2 보고 가능 · 3 완료) */
DC.qs = function (S, id) {
  var q = S && S.quests && S.quests[id];
  return q ? q.state : 0;
};

/** 현재 진행 중인 메인 챕터 정의 (없으면 null) */
DC.curChapter = function (S) {
  for (var i = 0; i < DC.MAIN.length; i++) {
    if (DC.qs(S, DC.MAIN[i].id) !== 3) return DC.MAIN[i];
  }
  return null;
};
/** 완료한 메인 챕터 수 */
DC.chaptersDone = function (S) {
  var n = 0;
  for (var i = 0; i < DC.MAIN.length; i++) if (DC.qs(S, DC.MAIN[i].id) === 3) n++;
  return n;
};
/** 챕터를 지금 수락할 수 있는가 — 앞 챕터가 끝나야 열린다 */
DC.chapterOpen = function (S, idx) {
  return idx === 0 ? true : DC.qs(S, DC.MAIN[idx - 1].id) === 3;
};

/* ══════════════════════════ NPC · 대화 트리 ══════════════════════════
 * root(S) 가 진행 상황에 맞는 시작 노드를 고른다.
 * 선택지: { t:{ko,en}, to:'다음노드', act:'명령' }
 *   act — accept:<퀘스트> · turnin:<퀘스트> · shop:<상점> · inn · heal · board ·
 *         mercs · advance · tutorial · tutskip · end
 *   to 가 없으면 대화 종료. to:'__root' 이면 root(S) 를 다시 계산해 이어간다.
 * ────────────────────────────────────────────────────────────────── */
var C_OK = { ko: '알겠습니다', en: 'Understood' };
var C_GO = { ko: '다녀오겠습니다', en: 'On my way' };
var C_LATER = { ko: '나중에요', en: 'Later' };
var C_TAKE = { ko: '맡겨 주십시오', en: 'Consider it done' };
var C_REPORT = { ko: '(보고한다)', en: '(report)' };

DC.NPCS = {
  chief: {
    icon: '🧓', color: '#eab308',
    n: { ko: '촌장 하란', en: 'Chief Haran' },
    root: function (S) {
      var c = DC.chapterNode(S, 'chief');
      if (c) return c;
      return DC.chaptersDone(S) >= DC.MAIN_COUNT ? 'done' : 'idle';
    },
    nodes: {
      idle: {
        t: { ko: '자네 할 일은 릴로나 게시판 쪽에 있을 걸세. 나는 늘 여기 있으니 등대 이야기가 생기면 오게.',
          en: 'Your business is with Rilo or the board just now. I am always here — come back when the beacon has something to say.' },
        c: [{ t: C_OK, act: 'end' }],
      },
      done: {
        t: { ko: '먼 기슭에 불이 들어온 뒤로 부두가 조용할 날이 없네. 좋은 소란이지.\n다음 대륙 이야기는… 그건 자네가 쉬고 나서 하지.',
          en: 'Since Farshore lit, the pier has not had a quiet day. Good noise.\nThe next continent… that talk can wait until you have rested.' },
        c: [{ t: { ko: '그러죠', en: 'It can wait' }, act: 'end' }],
      },
    },
  },

  elder: {
    icon: '🧙', color: '#a78bfa',
    n: { ko: '장로 릴로', en: 'Elder Rilo' },
    root: function (S) {
      /* 오프닝 — 튜토리얼 이전에는 무조건 도입 대화 */
      if (!S.flags.tutorial_done && DC.qs(S, 'm1_awake') <= 1) {
        return S.flags.tut_started ? 'tut_wait' : 'tut_intro';
      }
      var c = DC.chapterNode(S, 'elder');
      if (c) return c;
      var s = DC.qs(S, 'side_wolf');
      if (s === 2) return 'wolf_report';
      if (s === 1) return 'wolf_wait';
      if (s === 0) return 'riddle';
      return 'after';
    },
    nodes: {
      tut_intro: {
        t: { ko: '눈을 떴군. 어젯밤 파도가 자네를 부두에 얹어 놓고 갔네. …놀라지 말게, 여기 사는 사람은 전부 그렇게 왔어.\n일어설 수 있으면 몇 가지만 알려주지. 표착항에서 사흘을 넘기려면 그 정도는 알아야 해.',
          en: 'Awake, then. The tide set you on the pier last night and left. …Do not look so startled — everyone here arrived the same way.\nIf you can stand, let me show you a few things. You need that much to last three days in Castaway Harbor.' },
        c: [
          { t: { ko: '가르쳐 주십시오', en: 'Teach me' }, act: 'tutorial' },
          { t: { ko: '몸은 기억하고 있습니다 (안내 건너뛰기)', en: 'My hands remember (skip the lesson)' }, act: 'tutskip' },
        ],
      },
      tut_wait: {
        t: { ko: '아직 다 못 해봤군. 서두를 것 없네 — 화면 아래 안내만 하나씩 따라 하게.\n다 끝나면 나한테 오게.',
          en: 'Not through it yet. No rush — just follow the notes at the bottom of your sight, one at a time.\nCome to me when you are done.' },
        c: [
          { t: C_OK, act: 'end' },
          { t: { ko: '그냥 건너뛰겠습니다', en: 'I will skip it after all' }, act: 'tutskip' },
        ],
      },
      riddle: {
        t: { ko: '한 가지 묻지. 물에 빠진 자를 구하는 건 뭍인가, 밧줄인가?',
          en: 'Answer me one thing: what saves a drowning man — the shore, or the rope?' },
        c: [
          { t: { ko: '밧줄이죠.', en: 'The rope.' }, to: 'riddle_good' },
          { t: { ko: '뭍입니다.', en: 'The shore.' }, to: 'riddle_bad' },
        ],
      },
      riddle_good: {
        t: { ko: '옳아. 뭍은 가만히 있을 뿐이고, 손을 뻗는 건 늘 누군가지. 자네가 밧줄이 될 셈이면 일거리를 하나 주지.',
          en: 'Right. The shore just sits there; someone always throws the rope. If you mean to be the rope, I have work.' },
        c: [
          { t: { ko: '말씀하시죠', en: 'Go on' }, to: 'wolf_offer' },
          { t: C_LATER, act: 'end' },
        ],
      },
      riddle_bad: {
        t: { ko: '흠. 틀렸다곤 안 하겠네 — 뭍에 닿아야 사는 건 맞으니. 하지만 손을 뻗는 건 늘 누군가야. 일거리 하나 주지.',
          en: 'Hm. Not wrong — you do need the shore. But someone still throws the rope. I have work for you.' },
        c: [
          { t: { ko: '말씀하시죠', en: 'Go on' }, to: 'wolf_offer' },
          { t: C_LATER, act: 'end' },
        ],
      },
      wolf_offer: {
        t: { ko: '골짜기의 늑대가 등대 길을 막고 있어. 여덟 마리쯤 줄이면 사람들이 다시 다닐 걸세.',
          en: 'Wolves hold the vale and the road to the cape. Thin them — eight should do — and folk will walk again.' },
        c: [
          { t: C_TAKE, act: 'accept:side_wolf' },
          { t: { ko: '생각해 보죠', en: 'I will think on it' }, act: 'end' },
        ],
      },
      wolf_wait: {
        t: { ko: '늑대는 혼자 오는 법이 없네. 한 마리를 보면 셋을 세게.',
          en: 'A wolf never comes alone. See one, count three.' },
        c: [{ t: C_OK, act: 'end' }],
      },
      wolf_report: {
        t: { ko: '골짜기가 조용하군. 이걸 받게 — 물때를 읽는 반지야. 자네 기술이 더 빨리 돌아올 걸세.',
          en: 'The vale is quiet. Take this — a ring that reads the tide. Your skills will come back faster.' },
        c: [{ t: { ko: '(반지를 받는다)', en: '(take the ring)' }, act: 'turnin:side_wolf', to: '__root' }],
      },
      after: {
        t: { ko: '등대 안에서는 뒤를 보게. 방패는 앞만 막으니까.\n그리고 지도(M)를 자주 펴게. 이 대륙은 자네 생각보다 훨씬 넓어.',
          en: 'Inside the lighthouse, look behind you — a shield only guards the front.\nAnd open your map often (M). This continent is wider than you think.' },
        c: [{ t: { ko: '기억하죠', en: 'I will remember' }, act: 'end' }],
      },
    },
  },

  steward: {
    icon: '🧑‍💼', color: '#7dd3fc',
    n: { ko: '게시판지기 미르', en: 'Mir, Keeper of the Board' },
    root: function (S) {
      var c = DC.chapterNode(S, 'steward');
      if (c) return c;
      return 'intro';
    },
    nodes: {
      intro: {
        t: { ko: '의뢰는 전부 이 판에 붙습니다. 본줄기는 촌장님과 릴로 어르신 쪽이고, 나머지는 제가 받고 제가 값을 치릅니다.\n상시 의뢰는 몇 번이든 다시 받으실 수 있어요.',
          en: 'Every job goes on this board. The main thread runs through the chief and Elder Rilo; the rest I take in and I pay out.\nThe standing work you can take as many times as you like.' },
        c: [
          { t: { ko: '게시판을 본다', en: 'Read the board' }, act: 'board' },
          { t: { ko: '상시 의뢰가 뭡니까?', en: 'What is standing work?' }, to: 'about' },
          { t: C_LATER, act: 'end' },
        ],
      },
      about: {
        t: { ko: '길에 올라온 것들을 치우거나, 약초를 대거나, 갱도를 한 번 훑고 오시거나. 큰돈은 안 되지만 마르지도 않습니다.\n마을에 돌아올 이유가 하나쯤은 있어야죠.',
          en: 'Clearing what crawls onto the road, keeping herbs in stock, sweeping a delve. It is never much, but it never runs out.\nA person should have a reason to come back to town.' },
        c: [
          { t: { ko: '게시판을 본다', en: 'Read the board' }, act: 'board' },
          { t: C_OK, act: 'end' },
        ],
      },
    },
  },

  healer: {
    icon: '🧝', color: '#22c55e',
    n: { ko: '치유사 아이린', en: 'Irin the Mender' },
    root: function (S) {
      var c = DC.chapterNode(S, 'healer');
      if (c) return c;
      var s = DC.qs(S, 'side_shade');
      if (s === 2) return 'shade_report';
      if (s === 1) return 'shade_wait';
      if (s === 3) return 'intro';
      return DC.qs(S, 'm3_signal') >= 1 ? 'shade_offer' : 'intro';
    },
    nodes: {
      intro: {
        t: { ko: '앉으세요. 값은 나중에 생각하시고요 — 여기서 돈 없다고 돌려보낸 적은 없습니다.\n상처든, 몸에 붙어 온 한기든, 제가 봅니다.',
          en: 'Sit. Worry about coin later — no one has ever been turned away from this room for being broke.\nWounds, or whatever chill you dragged home, I will look at it.' },
        c: [
          { t: { ko: '치료를 받는다', en: 'Be treated' }, act: 'heal' },
          { t: { ko: '동료를 부탁합니다', en: 'See to my companion' }, act: 'mercs' },
          { t: { ko: '괜찮습니다', en: 'I am fine' }, act: 'end' },
        ],
      },
      shade_offer: {
        t: { ko: '등대에 다녀오셨죠. 눈 밑이 파랗습니다 — 망령의 한기예요.\n소금 연고를 만들려면 약초가 여덟 개 필요합니다. 캐다 주시면 넉넉히 만들어 나눠 드리죠.',
          en: 'You have been to the lighthouse. Blue under the eyes — that is a wraith’s chill.\nBrine salve takes eight herbs. Bring them and I will make enough to share.' },
        c: [
          { t: C_TAKE, act: 'accept:side_shade' },
          { t: { ko: '치료부터 받겠습니다', en: 'Treat me first' }, act: 'heal' },
          { t: C_LATER, act: 'end' },
        ],
      },
      shade_wait: {
        t: { ko: '약초 여덟 개예요. 그동안 한기가 심해지면 언제든 오세요, 그냥 봐 드립니다.',
          en: 'Eight herbs. If the chill worsens meanwhile, come — I will look at it for nothing.' },
        c: [
          { t: { ko: '치료를 받는다', en: 'Be treated' }, act: 'heal' },
          { t: C_GO, act: 'end' },
        ],
      },
      shade_report: {
        t: { ko: '충분해요. 이건 가져가세요 — 셋이면 등롱실까지는 버팁니다.',
          en: 'That is plenty. Take these — three will get you to the lantern room.' },
        c: [{ t: { ko: '(약초를 건넨다)', en: '(hand over the herbs)' }, act: 'turnin:side_shade', to: '__root' }],
      },
    },
  },

  captain: {
    icon: '🎖️', color: '#f97316',
    n: { ko: '대기소장 보른', en: 'Born of the Post' },
    root: function () { return 'intro'; },
    nodes: {
      intro: {
        t: { ko: '여기 있는 셋은 전부 자네처럼 떠밀려 온 것들이야. 갈 데가 없으니 남의 싸움에 끼는 거지.\n값만 치르면 따라나서네. 죽지는 않아 — 쓰러지면 좀 누워 있다가 일어난다.',
          en: 'All three here washed up the same as you. Nowhere to go, so they take other people’s fights.\nPay and they walk with you. They do not die — they go down, lie a while, and get up.' },
        c: [
          { t: { ko: '사람을 보겠습니다', en: 'Let me see them' }, act: 'mercs' },
          { t: { ko: '어떤 사람들입니까?', en: 'What sort are they?' }, to: 'about' },
          { t: C_LATER, act: 'end' },
        ],
      },
      about: {
        t: { ko: '게일은 앞에 서서 받아내고, 노라는 뒤에서 화살을 보태고, 세하는 노래로 상처를 아물게 하지.\n한 번에 한 사람만 데려갈 수 있어. 나머지는 여기서 기다리네.',
          en: 'Gale stands in front and takes it. Nora adds arrows from the back. Seha sings and the wounds close faster.\nOne at a time. The rest wait here.' },
        c: [
          { t: { ko: '사람을 보겠습니다', en: 'Let me see them' }, act: 'mercs' },
          { t: C_OK, act: 'end' },
        ],
      },
    },
  },

  innkeeper: {
    icon: '👩‍🦰', color: '#22c55e',
    n: { ko: '여관 주인 마르타', en: 'Marta the Innkeeper' },
    root: function (S) { return DC.qs(S, 'm4_keeper') === 3 ? 'after' : 'intro'; },
    nodes: {
      intro: {
        t: { ko: '난파선에서 자네를 끌어낸 게 우리 애들이야. 침대는 비어 있어.\n자고 가면 몸도 낫고 여정도 종이에 적어두지 — 급하면 아이린한테 가게, 걘 재우지 않고 낫게 해.',
          en: 'My boys dragged you off that wreck. A bed is free.\nSleep and you heal, and I write your journey down — if you are in a hurry, see Irin instead. She mends without the sleeping.' },
        c: [
          { t: { ko: '쉬어가겠습니다 (회복 + 기록)', en: 'I will rest (heal + save)' }, act: 'inn' },
          { t: { ko: '마을 이야기를 들려주세요', en: 'Tell me about the town' }, to: 'town' },
          { t: C_LATER, act: 'end' },
        ],
      },
      town: {
        t: { ko: '표착항 — 이름 그대로 떠밀려 온 사람들이 세운 항구야. 여기 사는 사람 중에 여기서 태어난 사람은 없어.\n광장 한가운데 불은 절대 안 꺼뜨리네. 그게 우리 등대야.',
          en: 'Castaway Harbor — built by people the sea spat out. Nobody living here was born here.\nWe never let the fire in the square go out. That is our beacon.' },
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
        t: { ko: '그걸로 늑대를 상대할 생각인가? 그건 밧줄 자르는 물건이야.',
          en: 'Planning to fight wolves with that? That thing cuts rope, not fur.' },
        c: [
          { t: { ko: '물건을 보여주세요', en: 'Show me your wares' }, act: 'shop:smith' },
          { t: { ko: '등대에 대해 아는 게 있습니까?', en: 'Know anything about the lighthouse?' }, to: 'light' },
          { t: { ko: '다음에 오죠', en: 'Another time' }, act: 'end' },
        ],
      },
      light: {
        t: { ko: '등대 골조는 내가 못 다루는 강철이야. 육지에서 온 물건이지. 안에 그 강철로 벼린 물건이 하나 남아 있다는 소문은 있네.',
          en: "The beacon frame is steel I can't work. Came from the mainland. They say something forged from it still lies inside." },
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
      var c = DC.chapterNode(S, 'herbalist');
      if (c) return c;
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
          { t: C_LATER, act: 'end' },
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
        c: [{ t: { ko: '(약초를 건넨다)', en: '(hand over the herbs)' }, act: 'turnin:side_herb', to: '__root' }],
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

  /* 갈림길 — 전직을 맡는다 */
  oracle: {
    icon: '🌗', color: '#c4b5fd',
    n: { ko: '갈림길의 무녀 카엔', en: 'Kaen at the Fork' },
    root: function (S) {
      if (S.p && S.p.adv) return 'done';
      var ok = S.p && S.p.lv >= DC.ADV_LEVEL && DC.qs(S, DC.ADV_QUEST) === 3;
      return ok ? 'ready' : 'notyet';
    },
    nodes: {
      notyet: {
        t: { ko: '아직은 갈래가 하나뿐이야. 사람은 충분히 걸어본 뒤에야 갈림길을 보게 되지.\n등롱실을 끝내고, 열다섯 번쯤 자란 다음에 오게.',
          en: 'For now your road has one lane. A person only sees the fork after walking far enough.\nFinish the lantern room, grow about fifteen times, then come.' },
        c: [{ t: C_OK, act: 'end' }],
      },
      ready: {
        t: { ko: '보이는군. 자네 앞에 길이 둘로 갈라져 있어.\n하나를 밟으면 다른 하나는 닫히네. 되돌아오는 사람은 여태 없었어.',
          en: 'There it is — your road splits in two.\nStep on one and the other closes. No one has ever come back to try the other.' },
        c: [
          { t: { ko: '길을 보겠습니다', en: 'Show me the roads' }, act: 'advance' },
          { t: { ko: '더 생각해 보죠', en: 'I will think longer' }, act: 'end' },
        ],
      },
      done: {
        t: { ko: '이미 골랐군. 뒤를 보지 말게 — 볼 게 없어.\n대신 자네 손에 새로 붙은 것을 써 보게. R 일세.',
          en: 'Chosen already. Do not look back — there is nothing there.\nUse what has attached itself to your hands instead. That is R.' },
        c: [{ t: C_OK, act: 'end' }],
      },
    },
  },

  /* 야생 상인 — 대륙 각지 랜드마크에 결정적으로 배치된다 */
  wanderer: {
    icon: '🧳', color: '#a78bfa',
    n: { ko: '떠돌이 짐꾼', en: 'The Wandering Packman' },
    root: function () { return 'intro'; },
    nodes: {
      intro: {
        t: { ko: '사람이네. 이 안쪽에서 사람을 보는 건 두 달 만이야. 짐은 무겁고 갈 길은 머니, 값은 항구와 같이 쳐주지.',
          en: 'A person. First one I have seen this far in for two months. The pack is heavy and the road is long — harbor prices, same as always.' },
        c: [
          { t: { ko: '물건을 보여주세요', en: 'Show me your wares' }, act: 'shop:wanderer' },
          { t: { ko: '여기서 뭘 하고 있습니까?', en: 'What are you doing out here?' }, to: 'why' },
          { t: { ko: '가던 길 가겠습니다', en: 'I will move on' }, act: 'end' },
        ],
      },
      why: {
        t: { ko: '대륙은 자네 생각보다 훨씬 크네. 표착항은 가장자리야. 안쪽으로 갈수록 옛 사람들이 세운 석상이 나오고, 그 아래엔 대개 갱도가 있지 — 들어갈 땐 돌아올 길부터 세어 두게.',
          en: 'This continent runs far wider than you think. The harbor is its edge. Go inward and you find standing stones the old folk raised — and under them, delves. Count your way back before you go down.' },
        c: [
          { t: { ko: '물건을 보여주세요', en: 'Show me your wares' }, act: 'shop:wanderer' },
          { t: { ko: '새겨두죠', en: 'I will remember' }, act: 'end' },
        ],
      },
    },
  },
};

/* ── 메인 챕터 대화 노드 자동 생성 ────────────────────────────────────
 * 챕터 정의(DC.MAIN)에서 제안/안내/대기/보고 노드를 만들어 담당 NPC 에 심는다.
 * 보고 노드는 turnin 뒤 '__root' 로 돌아가므로, 같은 NPC 가 다음 챕터를
 * 이어서 제안하면 대화가 끊기지 않고 그대로 넘어간다.
 * ────────────────────────────────────────────────────────────────── */
DC.MAIN.forEach(function (c) {
  var npc = DC.NPCS[c.giver];
  if (!npc) return;
  npc.nodes[c.id + '_offer'] = {
    t: c.offer,
    c: [
      { t: c.ch === 1 ? { ko: '가르쳐 주십시오', en: 'Teach me' } : C_TAKE, act: 'accept:' + c.id, to: c.id + '_go' },
      { t: C_LATER, act: 'end' },
    ],
  };
  npc.nodes[c.id + '_go'] = { t: c.go, c: [{ t: C_GO, act: 'end' }] };
  npc.nodes[c.id + '_wait'] = { t: c.wait, c: [{ t: C_OK, act: 'end' }] };
  npc.nodes[c.id + '_report'] = {
    t: c.report,
    c: [{ t: C_REPORT, act: 'turnin:' + c.id, to: '__root' }],
  };
});

/**
 * 이 NPC 가 지금 꺼내야 할 메인 챕터 노드 — 없으면 null.
 * 보고 가능 > 진행 중 > (앞 챕터가 끝났고) 아직 안 받음 순.
 */
DC.chapterNode = function (S, npcId) {
  var i, c, st;
  for (i = 0; i < DC.MAIN.length; i++) {
    c = DC.MAIN[i];
    if (c.giver !== npcId) continue;
    st = DC.qs(S, c.id);
    if (st === 2) return c.id + '_report';
  }
  for (i = 0; i < DC.MAIN.length; i++) {
    c = DC.MAIN[i];
    if (c.giver !== npcId) continue;
    st = DC.qs(S, c.id);
    if (st === 1) return c.id + '_wait';
    if (st === 0) return DC.chapterOpen(S, i) ? c.id + '_offer' : null;
  }
  return null;
};

/* ══════════════════════════ 지역 이름 ══════════════════════════ */
DC.ZONES = {
  harbor: { ko: '표착항', en: 'Castaway Harbor' },
  shoal: { ko: '얕은 여울', en: 'Pale Shoals' },
  tundra: { ko: '서리 벌판', en: 'Rime Flats' },
  desert: { ko: '마른 모래벌', en: 'Parched Sands' },
  ash: { ko: '잿빛 황무지', en: 'Cinder Waste' },
  peak: { ko: '검은 봉우리', en: 'Black Spires' },
  delve: { ko: '무너진 갱도', en: 'Collapsed Delve' },
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

/* ══════════════════════════ 오프닝 튜토리얼 단계 ══════════════════════════ */
/* 각 단계는 플레이어가 실제로 그 행동을 해야 넘어간다. 게임은 멈추지 않는다 */
DC.TUTORIAL = [
  { id: 'move', hint: 'tutMove' },
  { id: 'attack', hint: 'tutAttack' },
  { id: 'dash', hint: 'tutDash' },
  { id: 'interact', hint: 'tutTalk' },
  { id: 'bag', hint: 'tutBag' },
  { id: 'tree', hint: 'tutTree' },
  { id: 'town', hint: 'tutTown' },
  { id: 'kill', hint: 'tutKill' },
];
})();
