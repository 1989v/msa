-- 게임별 개선 제안 + 답글.
--
-- 전 게임이 한 표를 쓴다 — 게임마다 표를 나누면 화면이 게임마다 달라지고, 어드민이
-- 「오늘 들어온 제안」을 한 번에 볼 수 없다 (game_release_note 와 같은 판단).
--
-- 닉네임을 행에 적어 둔다. 랭킹(game_score)이 쓰는 것과 같은 값이고, 목록을 그릴 때
-- 회원 서비스를 부르지 않기 위해서다. 소유권은 member_id 가 갖는다.
CREATE TABLE game_suggestion (
    id         BIGINT       NOT NULL AUTO_INCREMENT,
    game_id    BIGINT       NOT NULL,
    member_id  BIGINT       NOT NULL,
    nickname   VARCHAR(24)  NOT NULL,
    body       VARCHAR(500) NOT NULL,
    -- OPEN / REVIEWING / APPLIED / DECLINED
    status     VARCHAR(16)  NOT NULL DEFAULT 'OPEN',
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    -- 게임 상세의 목록 조회(최신순)
    KEY idx_game_suggestion_game (game_id, created_at),
    -- 어드민의 처리 대기 목록(전 게임 횡단)
    KEY idx_game_suggestion_status (status, created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 제안자와 운영자가 주고받는 한 줄기. 답글에 다시 답글을 달지 않으므로 parent 가 없다.
--
-- author_type 은 요청이 아니라 서버가 정한다 — 닉네임은 사용자가 「운영자」로 지을 수
-- 있어서, 이름만으로는 진짜 답변과 사칭을 가를 수 없다. 화면의 배지는 이 값이 그린다.
CREATE TABLE game_suggestion_reply (
    id            BIGINT        NOT NULL AUTO_INCREMENT,
    suggestion_id BIGINT        NOT NULL,
    member_id     BIGINT        NOT NULL,
    -- OPERATOR / AUTHOR
    author_type   VARCHAR(16)   NOT NULL,
    author_name   VARCHAR(24)   NOT NULL,
    body          VARCHAR(1000) NOT NULL,
    created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_game_suggestion_reply (suggestion_id, created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
