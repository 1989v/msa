-- 묶음 공유 링크 (ADR-0107) — 토큰을 아는 사람은 로그인 없이 묶음을 읽는다.
--
-- 만료·폐기는 행을 지우지 않고 시각으로 남긴다. 살아 있는지는 열람 시점에 판정하므로
-- 만료를 지우는 배치가 필요 없다. 재생성은 이전 행에 revoked_at 을 채우고 새 행을 넣는다.

CREATE TABLE collection_share (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    token         CHAR(10)     NOT NULL,
    collection_id BIGINT       NOT NULL,
    member_id     BIGINT       NOT NULL,
    created_at    DATETIME(6)  NOT NULL,
    expires_at    DATETIME(6)  NULL,      -- NULL = 만료 없음
    revoked_at    DATETIME(6)  NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_collection_share_token UNIQUE (token),
    -- 탈퇴 정리는 member_id 로 지운다 (묶음 행은 남아도 링크는 남기지 않는다)
    INDEX idx_collection_share_member (member_id),
    -- 묶음을 지우면 그 묶음의 링크도 같이 사라진다 — 찜(SET NULL)과 달리 남길 이유가 없다
    CONSTRAINT fk_collection_share_collection FOREIGN KEY (collection_id)
        REFERENCES wishlist_collection (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
