-- 이어하기 코드 — 브라우저 저장소가 사라져도 코드만 있으면 세이브를 복구한다.
-- 게스트도 서버에 저장할 수 있도록 member_id 를 nullable 로 완화하고, 신원은 save_code 가 담당한다.
-- (uk_save_game_member 는 MySQL 에서 NULL 중복을 허용하므로 게스트 행이 서로 충돌하지 않는다)

ALTER TABLE game_save_data
    MODIFY COLUMN member_id BIGINT NULL,
    ADD COLUMN save_code VARCHAR(16) NULL AFTER member_id,
    ADD UNIQUE KEY uk_save_code (save_code);
