-- 비밀 게임 허용 명단.
--
-- 게임 파일은 nginx 가 정적으로 내주므로, 카탈로그에서 빼는 것만으로는 주소를 아는 사람에게
-- 그대로 열린다. 이 표를 ingress 의 관문(auth-url)이 요청마다 봐서 파일 자체를 막는다.
--
-- game 테이블과 외래키로 잇지 않는다 — 비밀 게임은 카탈로그에 행이 없는 것이 정상이고,
-- 나중에 공개로 돌릴 때 명단이 함께 사라지면 안 된다.

CREATE TABLE game_private_access
(
    id         BIGINT       NOT NULL AUTO_INCREMENT,
    game_slug  VARCHAR(64)  NOT NULL COMMENT '게임 슬러그 — /games/{slug}/ 경로와 같다',
    member_id  BIGINT       NOT NULL COMMENT '허용할 회원 번호',
    note       VARCHAR(200) NULL COMMENT '누구인지 사람이 알아보는 메모. 판정에는 안 쓴다',
    created_at DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_game_private_access (game_slug, member_id),
    KEY idx_game_private_access_slug (game_slug)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT '비밀 게임에 들어갈 수 있는 회원';
