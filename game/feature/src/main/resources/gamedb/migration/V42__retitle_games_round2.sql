-- V40 재작명 2차 교정 — 표기 정책을 바로잡는다.
--
-- V40 의 잘못은 둘이었다.
--   ① '번역투 한자어' 를 걷어낸다면서 **문어체·옛말**로 갈아탔다 ('잿불' '황천길' '통금').
--      뜻은 맞지만 한국에서 일상적으로 쓰지 않는 말이라, 트렌디해진 게 아니라 예스러워졌다.
--   ② 서구권 개념을 **억지로 한글 음차**했다 ('어비스 크라운' '기어 배스천' '서펀트' '딥 던전').
--      읽는 사람에게 아무 이득이 없다 — 영어를 한글로 적었을 뿐이다.
--
-- 정책:
--   · 서구권 장르/세계관이면 **영문 그대로** 쓴다. 음차하지 않는다.
--   · 한국어는 **진짜 한국 소재이거나 일상어일 때만** 쓴다 (급식 월드컵 · 말꼬리 잡기 · 오목 한 판).
--   · 이미 한국어에 정착한 외래어는 한글로 둔다 (데드라인 · 스도쿠).
-- title_en 은 이제 title 과 같아지는 경우가 많다 — 그게 정상이다. 억지로 다르게 만들 이유가 없다.

-- ── 옛말/문어체였던 것
UPDATE game SET title = 'Dungeon Crew', title_en = 'Dungeon Crew' WHERE slug = 'ashen-warband';   -- 잿불
UPDATE game SET title = 'Rewind',       title_en = 'Rewind'       WHERE slug = 'nether-return';   -- 황천길 · 죽으면 되감는 로그라이크
UPDATE game SET title = 'Night Shift',  title_en = 'Night Shift'  WHERE slug = 'curfew-siren';    -- 통금(80년대 말) · 낮 파밍 / 밤 전투 교대
UPDATE game SET title = 'Drift',        title_en = 'Drift'        WHERE slug = 'drift-continent'; -- 표류자

-- ── 억지 음차였던 것 (한글로 적을 이유가 없다)
UPDATE game SET title = 'Abyssal Crown', title_en = 'Abyssal Crown' WHERE slug = 'abyssal-crown';
UPDATE game SET title = 'Raging Fist',   title_en = 'Raging Fist'   WHERE slug = 'raging-fist-saga';
UPDATE game SET title = 'Echo Duel',     title_en = 'Echo Duel'     WHERE slug = 'echo-duel';
UPDATE game SET title = 'Last Gate',     title_en = 'Last Gate'     WHERE slug = 'gate-holdout';
UPDATE game SET title = 'Gear Bastion',  title_en = 'Gear Bastion'  WHERE slug = 'gear-bastion';
UPDATE game SET title = 'Iron Vanguard', title_en = 'Iron Vanguard' WHERE slug = 'iron-vanguard';
UPDATE game SET title = 'Frost Outpost', title_en = 'Frost Outpost' WHERE slug = 'frost-outpost';
UPDATE game SET title = 'Ember Temple',  title_en = 'Ember Temple'  WHERE slug = 'ember-temple';
UPDATE game SET title = 'Rift',          title_en = 'Rift'          WHERE slug = 'rift-front';
UPDATE game SET title = 'Dice Defense',  title_en = 'Dice Defense'  WHERE slug = 'dice-citadel';
UPDATE game SET title = 'Storm Runner',  title_en = 'Storm Runner'  WHERE slug = 'storm-corridor';
UPDATE game SET title = 'Serpent',       title_en = 'Serpent'       WHERE slug = 'serpent-legion';
UPDATE game SET title = 'Midnight',      title_en = 'Midnight'      WHERE slug = 'midnight-tide';
UPDATE game SET title = 'Spud Battle',   title_en = 'Spud Battle'   WHERE slug = 'spud-arena';
UPDATE game SET title = 'Moon Fishing',  title_en = 'Moon Fishing'  WHERE slug = 'moon-angler';
UPDATE game SET title = 'Hand Alchemy',  title_en = 'Hand Alchemy'  WHERE slug = 'hand-alchemy';
UPDATE game SET title = 'Elemental',     title_en = 'Elemental'     WHERE slug = 'element-pilgrim';
UPDATE game SET title = 'Relic',         title_en = 'Relic'         WHERE slug = 'relic-heir';
UPDATE game SET title = 'Deep Dungeon',  title_en = 'Deep Dungeon'  WHERE slug = 'depth-delver';
UPDATE game SET title = 'Monster Tamer', title_en = 'Monster Tamer' WHERE slug = 'monster-tamer';
UPDATE game SET title = 'Overworld',     title_en = 'Overworld'     WHERE slug = 'overworld-quest';
UPDATE game SET title = 'Cog Factory',   title_en = 'Cog Factory'   WHERE slug = 'cog-foundry';
UPDATE game SET title = 'Deep Drill',    title_en = 'Deep Drill'    WHERE slug = 'abyss-drill';
UPDATE game SET title = 'Hero Gig',      title_en = 'Hero Gig'      WHERE slug = 'hero-dispatch';
UPDATE game SET title = 'Starlight Farm',title_en = 'Starlight Farm'WHERE slug = 'starlight-farm';
UPDATE game SET title = 'Rune Merge',    title_en = 'Rune Merge'    WHERE slug = 'rune-merge';
UPDATE game SET title = 'Block Burst',   title_en = 'Block Burst'   WHERE slug = 'block-burst';
UPDATE game SET title = 'Crate Shift',   title_en = 'Crate Shift'   WHERE slug = 'crate-shift';
UPDATE game SET title = 'Minefield',     title_en = 'Minefield'     WHERE slug = 'mine-pioneer';
UPDATE game SET title = 'Rope Puzzle',   title_en = 'Rope Puzzle'   WHERE slug = 'rope-works';
UPDATE game SET title = 'Wall Breaker',  title_en = 'Wall Breaker'  WHERE slug = 'wall-breaker';
UPDATE game SET title = 'Cave Glide',    title_en = 'Cave Glide'    WHERE slug = 'cave-glide';
UPDATE game SET title = 'Alley Pool',    title_en = 'Alley Pool'    WHERE slug = 'alley-pool';
UPDATE game SET title = 'Breeze Golf',   title_en = 'Breeze Golf'   WHERE slug = 'breeze-links';
UPDATE game SET title = 'Beat Dojo',     title_en = 'Beat Dojo'     WHERE slug = 'beat-dojo';
UPDATE game SET title = 'Snake',         title_en = 'Snake'         WHERE slug = 'snake';
UPDATE game SET title = 'Cliff Climb',   title_en = 'Cliff Climb'   WHERE slug = 'cliff-climber';
UPDATE game SET title = 'Nova Strike',   title_en = 'Nova Strike'   WHERE slug = 'nova-strike';
UPDATE game SET title = 'Golden Forge',  title_en = 'Golden Forge'  WHERE slug = 'golden-forge';
UPDATE game SET title = 'Crimson Ravine',title_en = 'Crimson Ravine'WHERE slug = 'crimson-ravine';
UPDATE game SET title = 'Acid Rain',     title_en = 'Acid Rain'     WHERE slug = 'acid-rain';
UPDATE game SET title = 'Outlaw Frontier', title_en = 'Outlaw Frontier' WHERE slug = 'outlaw-frontier';

-- ── 한국어를 유지하는 것: 한국 소재이거나 일상어이거나, 이미 정착한 외래어
--    deadline(데드라인) · word-chain(말꼬리 잡기) · bracket-battle(급식 월드컵)
--    sketch-sleuth(그려봐) · stone-sage(오목 한 판) · number-garden(스도쿠)
--    pixel-mine(네모로직) · word-warden(낱말 다섯) · royal-grid(하루 한 판)
--    dawn-ward(새벽까지) · code-magnifier(코드 돋보기) · fill-blank-quiz(빈칸 채우기)
--    concept-memory(개념 짝맞추기)
UPDATE game SET title = '네 줄 잇기', title_en = 'Quad Link'    WHERE slug = 'quad-weave';       -- '넉' 은 옛 말투
UPDATE game SET title = '개념 폭포',  title_en = 'Concept Drop' WHERE slug = 'concept-cascade';  -- '낙하' 는 한자어

UPDATE game SET content_updated_at = NOW(6) WHERE slug <> '';
