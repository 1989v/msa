-- 찜 묶음(컬렉션) — 관광지를 여행 단위로 모은다 (ADR-0080).
--
-- 회원마다 '기본' 컬렉션을 만들지 않는다. collection_id IS NULL 이 곧 미분류다.
-- 자동 생성을 택하면 찜을 한 번도 안 한 회원에게도 빈 행이 생기고, 그 행을 지울지
-- 말지가 다시 문제가 된다. NULL 은 부트스트랩도 정리도 필요 없다.

CREATE TABLE wishlist_collection (
    id         BIGINT       NOT NULL AUTO_INCREMENT,
    member_id  BIGINT       NOT NULL,
    name       VARCHAR(40)  NOT NULL,
    created_at DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    -- 같은 회원이 같은 이름의 묶음을 둘 만들면 목록에서 구분할 수 없다
    CONSTRAINT uk_collection_member_name UNIQUE (member_id, name),
    INDEX idx_collection_member (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 한 항목은 한 컬렉션에만 속한다 — uk_member_target 은 그대로 둔다 (ADR-0080 §3).
-- 넓히면 하트의 '찜됨/아님' 이진 의미가 "어느 컬렉션에서 찜됨?" 으로 무너진다.
ALTER TABLE wishlist_items
    ADD COLUMN collection_id BIGINT NULL AFTER member_id,
    ADD INDEX idx_items_collection (collection_id),
    -- 묶음을 없애는 것과 장소를 버리는 것은 다른 일이다 — 컬렉션을 지워도 찜은 남는다
    ADD CONSTRAINT fk_items_collection FOREIGN KEY (collection_id)
        REFERENCES wishlist_collection (id) ON DELETE SET NULL;
