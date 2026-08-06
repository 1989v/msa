-- 확장 팩 1차 — 17종 (2026-08-06 확장 리서치, docs/product/2026-08-06-game-expansion-research.md).
-- 클래식 퍼즐/보드 · 한국 특화 · 방치/인크리멘탈 · 액션/스포츠 클러스터.
-- 전부 클라이언트 자기완결 HTML(외부 의존 없음) + 랭킹(game_score) + 한/영 i18n.
-- bracket-battle 만 점수 경쟁이 무의미해 랭킹 미사용(sdk_integrated=0, 결과 공유형).

INSERT INTO game_tag (slug, name, display_order) VALUES
    ('physics', 'Physics', 31),
    ('typing', 'Typing', 32),
    ('board', 'Board', 33),
    ('sports', 'Sports', 34),
    ('rhythm', 'Rhythm', 35),
    ('factory', 'Factory', 36),
    ('survivors', 'Survivors', 37),
    ('io', 'IO', 38);

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('block-burst', '블록 폭파',
     '8×8 판에 폴리오미노 조각을 끼워 줄을 터뜨린다. 동시에 여러 줄을 지우면 콤보 배수, 연속 턴 폭파는 스트릭 보너스 — 놓을 자리가 사라지는 순간이 끝이다.',
     'Block Burst',
     'Fit polyomino pieces into an 8×8 board and burst full lines. Clearing several lines at once multiplies the combo, and consecutive bursting turns add a streak bonus — it ends the moment nothing fits.',
     '/games/thumbs/art/block-burst.svg', NULL, 'HTML5', 'IFRAME', '/games/block-burst/index.html',
     'PORTRAIT', 1, 'kgd', 1, 'PUBLISHED', 'PUZZLE', '["puzzle","casual","leaderboard"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('crate-shift', '창고 대이동',
     '상자는 밀 수만 있고 당길 수는 없다. 24개 창고를 순서대로 열어 모든 상자를 목표 지점에 올려라 — 무르기는 무제한, 필요한 건 한 수 앞의 그림이다.',
     'Crate Shift',
     'Crates can only be pushed, never pulled. Open 24 warehouses in order and land every crate on its target — undo is unlimited, foresight is not.',
     '/games/thumbs/art/crate-shift.svg', NULL, 'HTML5', 'IFRAME', '/games/crate-shift/index.html',
     'PORTRAIT', 1, 'kgd', 1, 'PUBLISHED', 'PUZZLE', '["puzzle","logic","strategy"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('mine-pioneer', '지뢰 개척단',
     '지뢰찾기에 목숨 3개와 연속 돌파를 얹었다. 판을 깰 때마다 지뢰가 늘어나고, 판마다 3×3 스캔 한 번. 언제 퇴각해 점수를 확정할지가 진짜 승부다.',
     'Mine Pioneer',
     'Minesweeper with three lives and an endless push. Every cleared field adds more mines, each field grants one 3×3 scan — the real decision is when to retreat and bank your score.',
     '/games/thumbs/art/mine-pioneer.svg', NULL, 'HTML5', 'IFRAME', '/games/mine-pioneer/index.html',
     'PORTRAIT', 1, 'kgd', 1, 'PUBLISHED', 'PUZZLE', '["puzzle","logic","roguelike"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('stone-sage', '오목 사범',
     '15줄 판에서 사범과 겨루는 오목. 수련생·사범·명인 3단계 — 명인은 두 수 앞을 읽고 열린 4를 먼저 만든다. 무르기는 한 번뿐이다.',
     'Stone Sage',
     'Gomoku against the dojo on a 15×15 board. Three tiers — the Master reads two plies ahead and races you to the open four. You get exactly one undo.',
     '/games/thumbs/art/stone-sage.svg', NULL, 'HTML5', 'IFRAME', '/games/stone-sage/index.html',
     'PORTRAIT', 1, 'kgd', 1, 'PUBLISHED', 'PUZZLE', '["board","strategy","turn-based"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('rope-works', '밧줄 공방',
     '매달린 별사탕을 밧줄을 잘라 정령의 항아리에 떨어뜨려라. 20개 작업대에 바람·범퍼·가시·움직이는 항아리가 차례로 등장 — 자르는 순간이 곧 궤적이다.',
     'Rope Works',
     'Cut the ropes and drop the star candy into the spirit jar. Twenty workbenches introduce wind, bumpers, spikes and moving jars — the instant you cut is the trajectory you get.',
     '/games/thumbs/art/rope-works.svg', NULL, 'HTML5', 'IFRAME', '/games/rope-works/index.html',
     'LANDSCAPE', 1, 'kgd', 1, 'PUBLISHED', 'PUZZLE', '["physics","puzzle","casual"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('acid-rain', '산성비',
     '하늘에서 쏟아지는 낱말을 타이핑해 지워라. 바닥에 닿으면 산성 풀이 차오르고 다섯 번이면 끝 — 회복·번개·슬로우 특수 낱말과 콤보 배수가 생존을 가른다.',
     'Acid Rain',
     'Type the falling words away before they hit the ground. Five splashes and the acid pool wins — healing, lightning and slow words plus a combo multiplier decide how long you last.',
     '/games/thumbs/art/acid-rain.svg', NULL, 'HTML5', 'IFRAME', '/games/acid-rain/index.html',
     'LANDSCAPE', 1, 'kgd', 1, 'PUBLISHED', 'ARCADE', '["typing","word","arcade"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('word-chain', '말꼬리 잡기',
     '1,788개 낱말을 아는 상대와의 끝말잇기. 두음법칙까지 인정하고, 승부사 난이도는 이어갈 말이 가장 적은 글자를 골라 넘긴다 — 한방 단어로 되받아쳐라.',
     'Word Chain',
     'Korean word-chain against an AI that knows 1,788 words. Initial-sound rules are honored, and the Duelist tier hands you the letter with the fewest continuations — answer it with a dead-end word of your own.',
     '/games/thumbs/art/word-chain.svg', NULL, 'HTML5', 'IFRAME', '/games/word-chain/index.html',
     'PORTRAIT', 1, 'kgd', 1, 'PUBLISHED', 'PUZZLE', '["word","turn-based","education"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('bracket-battle', '급식 대전',
     '급식·야식·분식·개발자 간식 32강 토너먼트. 둘 중 하나만 고르며 결승까지 올리고, 우승 항목은 나만의 명예의 전당에 쌓인다. 결과는 한 줄로 공유.',
     'Bracket Battle',
     'A 32-item tournament across school lunch, late-night, snack-bar and developer-fuel packs. Pick one of two until a champion emerges, then watch your personal hall of fame fill up — results share in one line.',
     '/games/thumbs/art/bracket-battle.svg', NULL, 'HTML5', 'IFRAME', '/games/bracket-battle/index.html',
     'PORTRAIT', 1, 'kgd', 0, 'PUBLISHED', 'CASUAL', '["party","casual"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('abyss-drill', '심연 시추장',
     '드릴이 알아서 심연을 파 내려간다. 지층 열 개를 지나며 광석을 모아 장비를 키우고, 별빛 융해로 결정을 얻어 영구 배수를 쌓아라 — 자는 동안에도 최대 8시간 채굴한다.',
     'Abyss Drill',
     'The drill digs the abyss on its own. Pass ten strata, spend ore on gear, and melt starlight for permanent multipliers — it keeps mining up to eight hours while you sleep.',
     '/games/thumbs/art/abyss-drill.svg', NULL, 'HTML5', 'IFRAME', '/games/abyss-drill/index.html',
     'PORTRAIT', 1, 'kgd', 1, 'PUBLISHED', 'CASUAL', '["idle","casual"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('cog-foundry', '태엽 공방',
     '컨베이어와 용광로, 조립기와 분배기를 놓아 광석이 부품이 되는 흐름을 만들어라. 16개 도면 — 적은 부품으로 납품을 채울수록 별이 늘어난다.',
     'Cog Foundry',
     'Lay conveyors, furnaces, assemblers and splitters until ore flows into finished parts. Sixteen blueprints — the fewer machines you spend, the more stars you keep.',
     '/games/thumbs/art/cog-foundry.svg', NULL, 'HTML5', 'IFRAME', '/games/cog-foundry/index.html',
     'LANDSCAPE', 1, 'kgd', 1, 'PUBLISHED', 'STRATEGY', '["factory","puzzle","strategy"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('hero-dispatch', '용사 파견소',
     '용사를 고용해 던전에 보내고 귀환을 기다리는 길드 경영. 편성 전투력이 성공률을 정하고, 파견은 접속을 끊어도 진행된다 — 전설 용사와 도감을 노려라.',
     'Hero Dispatch',
     'Hire heroes, send them into dungeons and wait for the return — a guild you manage between sessions. Party power sets the success rate and expeditions keep running while you are away.',
     '/games/thumbs/art/hero-dispatch.svg', NULL, 'HTML5', 'IFRAME', '/games/hero-dispatch/index.html',
     'PORTRAIT', 1, 'kgd', 1, 'PUBLISHED', 'CASUAL', '["idle","rpg","casual"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('starlight-farm', '별빛 온실',
     '밤하늘 아래 별빛 식물을 기르는 느긋한 온실. 반짝풀 30초부터 은하수 연꽃 4시간까지 스무 종을 모으고, 여문 밭끼리 이웃하면 희귀 변종이 태어난다.',
     'Starlight Farm',
     'A gentle greenhouse of starlight plants under the night sky. Collect twenty species from 30-second sparkle grass to the four-hour galaxy lotus, and let ripe neighbors cross into rare variants.',
     '/games/thumbs/art/starlight-farm.svg', NULL, 'HTML5', 'IFRAME', '/games/starlight-farm/index.html',
     'PORTRAIT', 1, 'kgd', 1, 'PUBLISHED', 'CASUAL', '["idle","casual"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('alley-pool', '골목 당구장',
     '당겨서 놓는 한 번의 샷. 9볼을 순서대로 넣는 타임어택과, 정해진 샷 수로 풀어야 하는 트릭샷 12판 — 고스트 볼 가이드가 각도를 미리 보여준다.',
     'Alley Pool',
     'One shot, pulled back and released. Run the 9-ball rack against the clock or solve twelve trick-shot puzzles within a shot limit — the ghost ball guide previews your angle.',
     '/games/thumbs/art/alley-pool.svg', NULL, 'HTML5', 'IFRAME', '/games/alley-pool/index.html',
     'LANDSCAPE', 1, 'kgd', 1, 'PUBLISHED', 'ARCADE', '["physics","sports","arcade"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('breeze-links', '바람 골프장',
     '탑다운 미니 골프 18홀. 모래·얼음·경사·터널을 지나는 동안 홀마다 다른 바람이 공을 계속 밀어낸다 — 조준은 나침반을 보고 하는 것이다.',
     'Breeze Links',
     'Eighteen holes of top-down mini golf. Sand, ice, slopes and tunnels are only half of it — every hole carries its own wind that keeps nudging the ball, so aim by the compass.',
     '/games/thumbs/art/breeze-links.svg', NULL, 'HTML5', 'IFRAME', '/games/breeze-links/index.html',
     'LANDSCAPE', 1, 'kgd', 1, 'PUBLISHED', 'ARCADE', '["sports","physics","arcade"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('beat-dojo', '박자 도장',
     '사부의 북에 맞춰 한 버튼으로 겨루는 수련. 단타·롱노트·연타가 흐르고 판정은 오디오 시계 기준 — 세 곡의 등급을 사범까지 끌어올려라.',
     'Beat Dojo',
     'One-button training to the master\'s drum. Taps, holds and rolls stream in, judged against the audio clock — push all three pieces up to Master rank.',
     '/games/thumbs/art/beat-dojo.svg', NULL, 'HTML5', 'IFRAME', '/games/beat-dojo/index.html',
     'LANDSCAPE', 1, 'kgd', 1, 'PUBLISHED', 'ARCADE', '["rhythm","one-button","arcade"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('dawn-ward', '새벽 결계',
     '새벽까지 10분, 어둠 속 시야는 광원만큼이다. 탄창을 비우고 재장전하는 사이 그림자 짐승이 몰려오고, 결계석 셋을 충전해 두면 한 번의 정화가 판을 뒤집는다.',
     'Dawn Ward',
     'Ten minutes until dawn, and you see only as far as your light. Shadow beasts close in during every reload — charge the three ward stones and one purge can reset the field.',
     '/games/thumbs/art/dawn-ward.svg', NULL, 'HTML5', 'IFRAME', '/games/dawn-ward/index.html',
     'LANDSCAPE', 1, 'kgd', 1, 'PUBLISHED', 'ACTION', '["survivors","action","survival"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('serpent-legion', '뱀 군단전',
     '열여섯 마리가 뒤엉키는 원형 맵의 배틀로얄. 빛 알갱이로 자라고 부스트로 앞지르되, 머리가 남의 몸에 닿는 순간 전부 알갱이가 된다 — 1위를 노려라.',
     'Serpent Legion',
     'Sixteen serpents tangle across a circular arena. Grow on light motes and boost to cut ahead, but the instant your head touches another body you become motes yourself.',
     '/games/thumbs/art/serpent-legion.svg', NULL, 'HTML5', 'IFRAME', '/games/serpent-legion/index.html',
     'LANDSCAPE', 1, 'kgd', 1, 'PUBLISHED', 'ACTION', '["io","action","survival"]',
     NOW(6), NOW(6), NOW(6), NOW(6));

INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, m.tag_slug
FROM game g
         JOIN (SELECT 'block-burst' AS slug, 'puzzle' AS tag_slug
               UNION ALL SELECT 'block-burst', 'casual'
               UNION ALL SELECT 'block-burst', 'leaderboard'
               UNION ALL SELECT 'crate-shift', 'puzzle'
               UNION ALL SELECT 'crate-shift', 'logic'
               UNION ALL SELECT 'crate-shift', 'strategy'
               UNION ALL SELECT 'mine-pioneer', 'puzzle'
               UNION ALL SELECT 'mine-pioneer', 'logic'
               UNION ALL SELECT 'mine-pioneer', 'roguelike'
               UNION ALL SELECT 'stone-sage', 'board'
               UNION ALL SELECT 'stone-sage', 'strategy'
               UNION ALL SELECT 'stone-sage', 'turn-based'
               UNION ALL SELECT 'rope-works', 'physics'
               UNION ALL SELECT 'rope-works', 'puzzle'
               UNION ALL SELECT 'rope-works', 'casual'
               UNION ALL SELECT 'acid-rain', 'typing'
               UNION ALL SELECT 'acid-rain', 'word'
               UNION ALL SELECT 'acid-rain', 'arcade'
               UNION ALL SELECT 'word-chain', 'word'
               UNION ALL SELECT 'word-chain', 'turn-based'
               UNION ALL SELECT 'word-chain', 'education'
               UNION ALL SELECT 'bracket-battle', 'party'
               UNION ALL SELECT 'bracket-battle', 'casual'
               UNION ALL SELECT 'abyss-drill', 'idle'
               UNION ALL SELECT 'abyss-drill', 'casual'
               UNION ALL SELECT 'cog-foundry', 'factory'
               UNION ALL SELECT 'cog-foundry', 'puzzle'
               UNION ALL SELECT 'cog-foundry', 'strategy'
               UNION ALL SELECT 'hero-dispatch', 'idle'
               UNION ALL SELECT 'hero-dispatch', 'rpg'
               UNION ALL SELECT 'hero-dispatch', 'casual'
               UNION ALL SELECT 'starlight-farm', 'idle'
               UNION ALL SELECT 'starlight-farm', 'casual'
               UNION ALL SELECT 'alley-pool', 'physics'
               UNION ALL SELECT 'alley-pool', 'sports'
               UNION ALL SELECT 'alley-pool', 'arcade'
               UNION ALL SELECT 'breeze-links', 'sports'
               UNION ALL SELECT 'breeze-links', 'physics'
               UNION ALL SELECT 'breeze-links', 'arcade'
               UNION ALL SELECT 'beat-dojo', 'rhythm'
               UNION ALL SELECT 'beat-dojo', 'one-button'
               UNION ALL SELECT 'beat-dojo', 'arcade'
               UNION ALL SELECT 'dawn-ward', 'survivors'
               UNION ALL SELECT 'dawn-ward', 'action'
               UNION ALL SELECT 'dawn-ward', 'survival'
               UNION ALL SELECT 'serpent-legion', 'io'
               UNION ALL SELECT 'serpent-legion', 'action'
               UNION ALL SELECT 'serpent-legion', 'survival') m ON m.slug = g.slug;

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0
FROM game
WHERE slug IN ('block-burst', 'crate-shift', 'mine-pioneer', 'stone-sage', 'rope-works', 'acid-rain',
               'word-chain', 'bracket-battle', 'abyss-drill', 'cog-foundry', 'hero-dispatch',
               'starlight-farm', 'alley-pool', 'breeze-links', 'beat-dojo', 'dawn-ward', 'serpent-legion');
