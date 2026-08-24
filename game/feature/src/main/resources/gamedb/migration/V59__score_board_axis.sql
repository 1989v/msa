-- 랭킹 보드에 세 번째 축을 넣는다 — 게임이 나눈 모드(board).
--
-- 왜 필요한가
--   지금 보드의 축은 둘이다: 트랙(무강화/강화, V28)과 기간(전체/오늘, V49). 둘 다 **플랫폼이**
--   정한 축이라 값이 고정이다. 그런데 한 게임 안에 재는 자가 아예 다른 모드가 생겼다 —
--   「그어서 막기」는 같은 방어선을 그어도 물 1009 / 돌 798 / 벌 383 으로 갈리고,
--   「인피니티 타워」의 방어전(14분)과 타워 등반(층당 60~90초)은 한 판의 길이 자체가 다르며,
--   「랜덤 카드 디펜스」는 혼자·협동·대전이 같은 웨이브 수를 서로 다른 난이도로 센다.
--   한 보드에 합치면 순위표가 실력이 아니라 **점수가 잘 나오는 모드를 고른 사람** 순위가 된다.
--
-- 왜 track 을 재활용하지 않는가
--   track 은 '영구 강화를 썼는가'라는 플랫폼의 물음이고 화면에도 「무강화 / 강화」로 나간다.
--   여기에 모드 이름을 밀어 넣으면 그 탭 이름이 거짓이 되고, 강화가 있는 게임에서 두 축을
--   동시에 쓸 수 없게 된다. 축이 다르면 컬럼도 달라야 한다.
--
-- 기존 행은 옮기지 않는다
--   기본값이 빈 문자열이고, 보드를 안 보내는 게임(60여 종)은 계속 그 한 보드를 쓴다.
--   그래서 이 마이그레이션에는 UPDATE 가 없다 — 지금까지의 모든 기록이 있던 자리에 그대로 남는다.
--   NULL 이 아니라 '' 인 이유는 유니크 키에 들어가기 때문이다(MySQL 에서 NULL 은 서로 같지 않아
--   같은 사람이 같은 보드에 여러 행을 만들 수 있다).
ALTER TABLE game_score
    ADD COLUMN board VARCHAR(24) NOT NULL DEFAULT '' AFTER track,
    DROP INDEX uk_score_game_track_nick,
    ADD UNIQUE KEY uk_score_game_track_board_nick (game_id, track, board, nickname),
    DROP INDEX idx_score_game_track_score,
    ADD KEY idx_score_game_track_board_score (game_id, track, board, score DESC);

-- 오늘 보드도 같은 축을 갖는다. 축이 한쪽에만 있으면 "오늘의 1위"가 모드를 섞어 버려
-- 역대 보드와 다른 사람을 가리킨다.
ALTER TABLE game_score_daily
    ADD COLUMN board VARCHAR(24) NOT NULL DEFAULT '' AFTER track,
    DROP INDEX uk_score_daily_game_track_date_nick,
    ADD UNIQUE KEY uk_score_daily_game_track_board_date_nick (game_id, track, board, play_date, nickname),
    DROP INDEX idx_score_daily_board,
    ADD KEY idx_score_daily_board (game_id, track, board, play_date, score DESC);

-- 보드의 표시 이름 — 카탈로그가 든다.
--
--   보드를 나눈 주체는 게임이고 키의 뜻도 게임만 안다. 그런데 게임 **밖** 상세 페이지가
--   보드 탭을 그려야 하는데, 게임 안 선언은 샌드박스 iframe 안 스크립트라 바깥에서 못 읽는다.
--   그래서 이름만 카탈로그에 둔다 — 게임 안 위젯(lib/rank.js)은 여전히 게임의 선언을 직접 쓰고
--   서버를 거치지 않는다.
--
--   별도 표가 아니라 JSON 컬럼인 이유: 이 값은 조회 조건이 된 적이 없고 항상 게임 행과 함께
--   읽힌다. tags 가 이미 같은 방식이다. 표를 만들면 조인과 리포지토리가 하나씩 늘 뿐이다.
ALTER TABLE game
    ADD COLUMN score_boards JSON NULL AFTER tags;

-- 세 게임의 보드 선언. 게임 코드가 실제로 보내는 키와 **글자 그대로** 같아야 한다 —
-- 어긋나면 기록은 쌓이는데 사이트 탭에는 안 보인다(게임 안에서는 보인다).
UPDATE game
SET score_boards = JSON_ARRAY(
        JSON_OBJECT('key', 'leak', 'name', '물 막기', 'nameEn', 'Water'),
        JSON_OBJECT('key', 'rockfall', 'name', '돌 막기', 'nameEn', 'Rocks'),
        JSON_OBJECT('key', 'bee', 'name', '벌 막기', 'nameEn', 'Bees')
    )
WHERE slug = 'bee-guard';

UPDATE game
SET score_boards = JSON_ARRAY(
        JSON_OBJECT('key', 'defense', 'name', '첨탑 방어', 'nameEn', 'Spire Defense'),
        JSON_OBJECT('key', 'climb', 'name', '타워 등반', 'nameEn', 'Tower Climb')
    )
WHERE slug = 'infinity-tower';

UPDATE game
SET score_boards = JSON_ARRAY(
        JSON_OBJECT('key', 'solo', 'name', '혼자', 'nameEn', 'Solo'),
        JSON_OBJECT('key', 'coop', 'name', '협동', 'nameEn', 'Co-op'),
        JSON_OBJECT('key', 'versus', 'name', '대전', 'nameEn', 'Versus')
    )
WHERE slug = 'random-card-defense';
