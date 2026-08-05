-- 카탈로그 이중언어(en) + 장르 재분류.
-- title/description 은 한국어 원문 유지, *_en 은 브라우저 언어가 en 계열일 때 노출.
-- genre 재분류: 수비형 게임을 DEFENSE 로, 대전 게임을 VERSUS 로 분리 (FE 카테고리 축 명확화).

ALTER TABLE game
    ADD COLUMN title_en       VARCHAR(200) NULL AFTER description,
    ADD COLUMN description_en TEXT         NULL AFTER title_en;

-- 장르 재분류
UPDATE game SET genre = 'DEFENSE' WHERE slug IN ('outlaw-frontier', 'gate-holdout', 'gear-bastion', 'frost-outpost');
UPDATE game SET genre = 'VERSUS'  WHERE slug = 'echo-duel';

-- 영문 백필
UPDATE game SET title_en = 'Concept Memory',
                description_en = 'Flip cards to match IT concepts with their definitions. A memory game powered by the Code Dictionary dataset.'
WHERE slug = 'concept-memory';

UPDATE game SET title_en = 'Fill Blank Quiz',
                description_en = 'Fill in the blanks of IT concept descriptions. Pick the right term and test your knowledge.'
WHERE slug = 'fill-blank-quiz';

UPDATE game SET title_en = 'Code Magnifier',
                description_en = 'Inspect code snippets under a magnifier and guess which concept is used.'
WHERE slug = 'code-magnifier';

UPDATE game SET title_en = 'Concept Cascade',
                description_en = 'Drag falling concept cards into the right category before they pile up.'
WHERE slug = 'concept-cascade';

UPDATE game SET title_en = 'Snake Arcade',
                description_en = 'The classic snake — eat and grow. The server replays your inputs to verify every score, so leaderboard cheating does not work.'
WHERE slug = 'snake';

UPDATE game SET title_en = 'Overworld Quest',
                description_en = 'An action RPG across an open overworld. Upgrade your sword, earn gold, and conquer every dungeon.'
WHERE slug = 'overworld-quest';

UPDATE game SET title_en = 'Depth Delver',
                description_en = 'A roguelike where each run opens the same dungeon from a server-issued seed. Death keeps your gold — buy permanent upgrades and conquer floor 6. Save-scumming does not work.'
WHERE slug = 'depth-delver';

UPDATE game SET title_en = 'Monster Tamer',
                description_en = 'Meet wild monsters in the tall grass, battle, capture, and complete your codex. Battles use the same type-matchup formula as the server sim core.'
WHERE slug = 'monster-tamer';

UPDATE game SET title_en = 'Outlaw Frontier',
                description_en = 'Start as a lone drifter and push the lawless frontier westward. Recruit companions with bounty money and gamble two of them for a higher grade. Fallen companions add death points — cross the limit and the journey ends.'
WHERE slug = 'outlaw-frontier';

UPDATE game SET title_en = 'Gate Holdout',
                description_en = 'Raise watchtowers on the pass, fill them with archers, and hold 20 rounds against the horde. Towers break — repair crews decide the battle.'
WHERE slug = 'gate-holdout';

UPDATE game SET title_en = 'Gear Bastion',
                description_en = 'Golem legions march down a fixed path. Combine four turret types to stop 25 waves — flying golems ignore the road, so mix in anti-air.'
WHERE slug = 'gear-bastion';

UPDATE game SET title_en = 'Iron Vanguard',
                description_en = 'Micro-control a squad of four against the swarm. Archers kite, the knight tanks, the priest heals. The dead do not come back.'
WHERE slug = 'iron-vanguard';

UPDATE game SET title_en = 'Ember Temple',
                description_en = 'Cross a temple whose floor breathes fire. Read the glowing tiles and clear all eight chambers — deaths are counted, but never final.'
WHERE slug = 'ember-temple';

UPDATE game SET title_en = 'Frost Outpost',
                description_en = 'Miners dig crystal while you wall off the canyon mouth with barricades and turrets. Survive 12 minutes — the crystal is finite.'
WHERE slug = 'frost-outpost';

UPDATE game SET title_en = 'Echo Duel',
                description_en = 'A duel of growing sequences: repeat the previous procedure exactly, then add one more step. First to slip loses. Two players on one keyboard, or solo practice.'
WHERE slug = 'echo-duel';

UPDATE game SET title_en = 'Golden Forge',
                description_en = 'An idle clicker of hammering gold on the anvil. Hire auto-hammers, bellows apprentices, and a fire dragon; star-quenching grants permanent multipliers each rebirth. The furnace keeps working while you sleep (up to 8 hours offline).'
WHERE slug = 'golden-forge';

UPDATE game SET title_en = 'Rune Merge',
                description_en = 'Slide and merge identical runes to complete the ancient glyphs on a 4x4 board. One undo, 4096 is the goal. Swipe or arrow keys.'
WHERE slug = 'rune-merge';

UPDATE game SET title_en = 'Cave Glide',
                description_en = 'Press to flap, release to glide. A one-button arcade through a narrowing cave — dodge the stalactites and collect crystals.'
WHERE slug = 'cave-glide';

UPDATE game SET title_en = 'Wall Breaker',
                description_en = 'Bring down castle walls with a battering orb. Three-tier bricks, four supply drops (wide/multi/pierce/slow), and a paddle that shrinks as you climb.'
WHERE slug = 'wall-breaker';
