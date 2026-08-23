-- 오늘의 기록 — 날짜로 나눈 랭킹 보드.
--
-- 왜 game_score 에서 파생할 수 없는가
--   game_score 는 (game_id, track, nickname) 당 한 행 = **그 사람의 역대 최고**다(V28).
--   자기 최고를 넘지 못한 런은 애초에 저장되지 않으므로, updated_at 이 오늘인 행을 세면
--   "오늘 자기 기록을 깬 사람"만 세어진다. 오늘 처음 논 사람도, 오늘 잘 쳤지만 지난달의
--   자기 기록에 못 미친 사람도 빠진다 — 그건 오늘의 기록이 아니라 오늘의 자기 갱신이다.
--   그래서 날짜를 키에 가진 별도 원장을 둔다.
--
-- 날짜 경계는 KST(Asia/Seoul)다
--   플레이어가 "오늘"이라고 말할 때 뜻하는 건 자기 나라의 자정이고, 이 사이트의 플레이어는
--   한국인이다. UTC 로 자르면 한국 시간 오전 9시에 보드가 갈려서 "어젯밤에 세운 기록이
--   아직 오늘에 남아 있다"가 된다. 같은 이유로 데일리 퍼즐(lib/daily.js)도 이미 KST
--   자정 롤오버를 쓴다 — 한 사이트 안에서 "오늘"의 뜻이 둘이면 안 된다.
--   (아케이드 챌린지의 LocalDate.now(ZoneOffset.UTC)는 Redis 키 네임스페이스라 별개 축이다.)
--   경계 계산은 애플리케이션이 GameDay.ZONE 으로 하고, 여기에는 그 결과인 날짜만 DATE 로
--   저장한다. DATETIME 으로 두면 경계가 컬럼에 안 보이고 서버 JVM 타임존에 끌려간다.
--
-- 유니크 키에 play_date 를 넣는 이유
--   역대 보드가 "닉네임당 최고 1행"인 것과 같은 규칙을 하루 단위로 유지한다. 하루에 열 판
--   한 사람이 보드 열 줄을 먹으면 오늘의 순위표가 한 사람의 연습 기록이 된다.
--
-- 보존: 지우지 않는다 (지금은)
--   하루에 쌓이는 행은 (게임 × 트랙 × 오늘 논 사람) 수다. 지금 규모에서 하루 수십 행이고
--   행 하나가 인덱스 포함 200바이트 남짓이라 1년을 모아도 수 MB다. 이걸 지우려고 CronJob 을
--   하나 더 세우면 무료 티어에서 파드 슬롯과 지켜봐야 할 부품이 하나 늘어난다 — 얻는 것보다
--   비싸다. 게다가 이 원장은 나중에 "지난 기록"·주간 보드의 원재료다.
--   다시 볼 조건: 이 표가 100만 행을 넘거나 보드 조회가 idx_score_daily_board 를 놓칠 때.
--   그때의 정리는 한 줄이다 — DELETE FROM game_score_daily WHERE play_date < CURDATE() - INTERVAL 180 DAY;
CREATE TABLE game_score_daily (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    game_id    BIGINT       NOT NULL,
    track      VARCHAR(8)   NOT NULL,
    play_date  DATE         NOT NULL,
    nickname   VARCHAR(24)  NOT NULL,
    score      BIGINT       NOT NULL,
    detail     VARCHAR(64)  NULL,
    created_at DATETIME(6)  NOT NULL,
    updated_at DATETIME(6)  NOT NULL,
    UNIQUE KEY uk_score_daily_game_track_date_nick (game_id, track, play_date, nickname),
    KEY idx_score_daily_board (game_id, track, play_date, score DESC)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
