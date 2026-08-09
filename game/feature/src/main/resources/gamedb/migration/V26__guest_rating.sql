-- 게스트 평점 — 표의 주인을 회원 또는 기기로 넓힌다.
--
-- 지금까지 평점은 로그인 필수였는데 게임 호스트에는 로그인 진입점이 없었다.
-- "평점 등록에는 로그인이 필요합니다"만 뜨고 로그인할 방법이 없으니 기능이 사실상 죽어 있었다.
--
-- MySQL 의 UNIQUE 인덱스는 NULL 중복을 허용한다 — 그래서 회원 표(device_id NULL)와
-- 기기 표(member_id NULL)를 한 테이블에 두고 유니크 키 두 개로 각각 1인 1표를 강제할 수 있다.
-- 합성 키 컬럼을 따로 만들 필요가 없다.
--
-- 한계는 분명하다: 저장소를 비우면 기기 표는 다시 던질 수 있다. 조작을 막는 장치가 아니라
-- 참여를 여는 장치이고, 표 수를 함께 노출해 표본이 작은 평점이 스스로 드러나게 한다.
ALTER TABLE game_rating
    MODIFY COLUMN member_id BIGINT NULL,
    ADD COLUMN device_id VARCHAR(64) NULL AFTER member_id,
    ADD UNIQUE KEY uk_rating_game_device (game_id, device_id);
