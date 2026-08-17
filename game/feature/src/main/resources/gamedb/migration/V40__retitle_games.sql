-- 게임 이름 전면 재작명.
--
-- 문제: 대부분의 이름이 영문 원제를 사전적으로 옮긴 2어절 한자어 조합이었다
-- ('잿불 원정대', '황천 회귀', '족보 연성소', '심연 시추장', '뱀 군단전'…).
-- 뜻은 맞지만 한국어 게임 이름으로는 읽히지 않는다 — 상품명이 아니라 번역문이다.
-- 8종은 아예 영문명뿐이라 한국어 카탈로그에서 튀었다.
--
-- 기준:
--  1) 입에 붙는 길이 (2~5음절). '~소/~장/~단/~전' 접미사 남발을 걷어낸다
--  2) 장르 어감에 맞는 축 — 액션/로그라이크는 음차, 캐주얼·퍼즐은 직관어, 한국 소재는 한국어
--  3) 장르 통칭이 곧 최고의 이름인 것들은 그렇게 둔다 (스도쿠·네모로직·오목)
--  4) 상용 게임과 겹치지 않게. 이미 좋은 이름은 건드리지 않는다
--
-- 슬러그는 바꾸지 않는다. 61종의 URL·색인·서버 세이브를 한꺼번에 갈아엎을 이유가 없다
-- (데드라인만 예외였고, 그건 등록 당일이라 비용이 0이었다).

UPDATE game SET title = '잿불',            title_en = 'Ashen'            WHERE slug = 'ashen-warband';
UPDATE game SET title = '어비스 크라운',    title_en = 'Abyssal Crown'    WHERE slug = 'abyssal-crown';
UPDATE game SET title = '황천길',          title_en = 'Nether Bound'     WHERE slug = 'nether-return';
UPDATE game SET title = '통금',            title_en = 'Curfew'           WHERE slug = 'curfew-siren';
UPDATE game SET title = '레이징 피스트',    title_en = 'Raging Fist'      WHERE slug = 'raging-fist-saga';
UPDATE game SET title = '표류자',          title_en = 'Castaway'         WHERE slug = 'drift-continent';

-- 온라인/대전
UPDATE game SET title = '그려봐',          title_en = 'Draw It'          WHERE slug = 'sketch-sleuth';
UPDATE game SET title = '에코 듀얼',       title_en = 'Echo Duel'        WHERE slug = 'echo-duel';
UPDATE game SET title = '급식 월드컵',     title_en = 'Lunch Cup'        WHERE slug = 'bracket-battle';

-- 디펜스
UPDATE game SET title = '라스트 게이트',   title_en = 'Last Gate'        WHERE slug = 'gate-holdout';
UPDATE game SET title = '기어 배스천',     title_en = 'Gear Bastion'     WHERE slug = 'gear-bastion';
UPDATE game SET title = '아이언 뱅가드',   title_en = 'Iron Vanguard'    WHERE slug = 'iron-vanguard';
UPDATE game SET title = '혹한 기지',       title_en = 'Frost Outpost'    WHERE slug = 'frost-outpost';
UPDATE game SET title = '엠버 템플',       title_en = 'Ember Temple'     WHERE slug = 'ember-temple';
UPDATE game SET title = '새벽까지',        title_en = 'Hold Till Dawn'   WHERE slug = 'dawn-ward';
UPDATE game SET title = '리프트',          title_en = 'Rift'             WHERE slug = 'rift-front';
UPDATE game SET title = '주사위 디펜스',   title_en = 'Dice Defense'     WHERE slug = 'dice-citadel';
UPDATE game SET title = '스톰 러너',       title_en = 'Storm Runner'     WHERE slug = 'storm-corridor';
UPDATE game SET title = '뱀 군단',         title_en = 'Serpent Legion'   WHERE slug = 'serpent-legion';

-- 액션/서바이버
UPDATE game SET title = '심야의 파도',     title_en = 'Midnight Tide'    WHERE slug = 'midnight-tide';
UPDATE game SET title = '감자 배틀',       title_en = 'Spud Battle'      WHERE slug = 'spud-arena';
UPDATE game SET title = '절벽 등반',       title_en = 'Cliff Climb'      WHERE slug = 'cliff-climber';
UPDATE game SET title = '달빛 낚시',       title_en = 'Moon Fishing'     WHERE slug = 'moon-angler';

-- 카드/로그라이크
UPDATE game SET title = '핸드 알케미',     title_en = 'Hand Alchemy'     WHERE slug = 'hand-alchemy';
UPDATE game SET title = '원소 순례',       title_en = 'Element Pilgrim'  WHERE slug = 'element-pilgrim';
UPDATE game SET title = '렐릭',            title_en = 'Relic'            WHERE slug = 'relic-heir';
UPDATE game SET title = '던전 탐사',       title_en = 'Depth Delver'     WHERE slug = 'depth-delver';
UPDATE game SET title = '몬스터 테이머',   title_en = 'Monster Tamer'    WHERE slug = 'monster-tamer';
UPDATE game SET title = '오버월드',        title_en = 'Overworld'        WHERE slug = 'overworld-quest';

-- 방치형/제작
UPDATE game SET title = '태엽 공장',       title_en = 'Cog Factory'      WHERE slug = 'cog-foundry';
UPDATE game SET title = '심해 시추',       title_en = 'Deep Drill'       WHERE slug = 'abyss-drill';
UPDATE game SET title = '용사 파견',       title_en = 'Hero Dispatch'    WHERE slug = 'hero-dispatch';
UPDATE game SET title = '별빛 농장',       title_en = 'Starlight Farm'   WHERE slug = 'starlight-farm';
UPDATE game SET title = '룬 머지',         title_en = 'Rune Merge'       WHERE slug = 'rune-merge';

-- 캐주얼/물리/스포츠
UPDATE game SET title = '블록 버스트',     title_en = 'Block Burst'      WHERE slug = 'block-burst';
UPDATE game SET title = '박스 밀기',       title_en = 'Crate Shift'      WHERE slug = 'crate-shift';
UPDATE game SET title = '지뢰밭',          title_en = 'Minefield'        WHERE slug = 'mine-pioneer';
UPDATE game SET title = '로프 퍼즐',       title_en = 'Rope Puzzle'      WHERE slug = 'rope-works';
UPDATE game SET title = '월 브레이커',     title_en = 'Wall Breaker'     WHERE slug = 'wall-breaker';
UPDATE game SET title = '동굴 비행',       title_en = 'Cave Glide'       WHERE slug = 'cave-glide';
UPDATE game SET title = '골목 당구',       title_en = 'Alley Pool'       WHERE slug = 'alley-pool';
UPDATE game SET title = '바람 골프',       title_en = 'Breeze Golf'      WHERE slug = 'breeze-links';
UPDATE game SET title = '비트 도장',       title_en = 'Beat Dojo'        WHERE slug = 'beat-dojo';
UPDATE game SET title = '스네이크',        title_en = 'Snake'            WHERE slug = 'snake';

-- 보드/퍼즐 — 장르 통칭이 가장 좋은 이름인 것들
UPDATE game SET title = '오목 한 판',      title_en = 'Gomoku'           WHERE slug = 'stone-sage';
UPDATE game SET title = '스도쿠',          title_en = 'Sudoku'           WHERE slug = 'number-garden';
UPDATE game SET title = '네모로직',        title_en = 'Nonogram'         WHERE slug = 'pixel-mine';
UPDATE game SET title = '낱말 다섯',       title_en = 'Five Letters'     WHERE slug = 'word-warden';
UPDATE game SET title = '넉 줄 잇기',      title_en = 'Quad Link'        WHERE slug = 'quad-weave';

-- 학습 게임 — 영문명만 있던 것들에 한국어 이름을 준다
UPDATE game SET title = '개념 낙하',       title_en = 'Concept Drop'     WHERE slug = 'concept-cascade';
UPDATE game SET title = '코드 돋보기',     title_en = 'Code Magnifier'   WHERE slug = 'code-magnifier';
UPDATE game SET title = '빈칸 채우기',     title_en = 'Fill the Blank'   WHERE slug = 'fill-blank-quiz';
UPDATE game SET title = '개념 짝맞추기',   title_en = 'Concept Match'    WHERE slug = 'concept-memory';

-- 이미 좋은 이름은 그대로 둔다:
--   deadline(데드라인) · nova-strike(노바 스트라이크) · outlaw-frontier(황야의 무법자)
--   word-chain(말꼬리 잡기) · acid-rain(산성비) · golden-forge(황금 대장간)
--   crimson-ravine(핏빛 협곡) · royal-grid(하루 한 판)

UPDATE game SET content_updated_at = NOW(6)
WHERE slug IN ('ashen-warband','abyssal-crown','nether-return','curfew-siren','raging-fist-saga',
               'drift-continent','sketch-sleuth','echo-duel','bracket-battle','gate-holdout',
               'gear-bastion','iron-vanguard','frost-outpost','ember-temple','dawn-ward','rift-front',
               'dice-citadel','storm-corridor','serpent-legion','midnight-tide','spud-arena',
               'cliff-climber','moon-angler','hand-alchemy','element-pilgrim','relic-heir',
               'depth-delver','monster-tamer','overworld-quest','cog-foundry','abyss-drill',
               'hero-dispatch','starlight-farm','rune-merge','block-burst','crate-shift',
               'mine-pioneer','rope-works','wall-breaker','cave-glide','alley-pool','breeze-links',
               'beat-dojo','snake','stone-sage','number-garden','pixel-mine','word-warden',
               'quad-weave','concept-cascade','code-magnifier','fill-blank-quiz','concept-memory');
