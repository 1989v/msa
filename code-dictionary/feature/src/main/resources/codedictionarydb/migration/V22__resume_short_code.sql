-- ADR-0103 — 이력서 제출처 링크의 단축 주소 코드(1989v.com/r/{code}) + 단축 주소 클릭 원장.
--
-- 코드는 10자 base62(약 59비트) 무작위 값이다. id 에서 계산하지 않는다 — 코드가 곧 열람 권한이라
-- 추측할 수 있으면 토큰 게이트가 무력해진다.
--
-- 테이블 기본 콜레이션이 utf8mb4_unicode_ci 라서 코드 컬럼은 ascii_bin 으로 명시한다. 그렇지 않으면
-- 유일 제약과 조회가 대소문자를 무시해 실효 엔트로피가 약 52비트로 준다.
--
-- 롤백 주의: 이 마이그레이션 뒤 옛 이미지로 되돌리면 옛 코드가 short_code 없이 INSERT 해서
-- 링크 생성만 실패한다. 다른 기능은 영향이 없다.

ALTER TABLE resume_share_link
    ADD COLUMN short_code VARCHAR(10) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER token;

-- 기존 행 백필. 글자마다 RANDOM_BYTES(1)(암호학적 난수)를 62 로 나눈 나머지로 고른다.
-- RAND()·UUID() 는 예측 가능하거나 비트가 고르지 않아 쓰지 않는다. 256 이 62 의 배수가 아니라
-- 앞 8글자가 약간 더 자주 나오지만(행당 약 59.3비트), 몇 행뿐인 백필에서 충돌 확률은 무시할 수준이다.
-- 그래도 겹치면 아래 UNIQUE 추가가 실패해 마이그레이션이 멈춘다 — 조용히 넘어가지 않는다.
UPDATE resume_share_link
SET short_code = CONCAT(
    SUBSTRING('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 1 + ORD(RANDOM_BYTES(1)) % 62, 1),
    SUBSTRING('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 1 + ORD(RANDOM_BYTES(1)) % 62, 1),
    SUBSTRING('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 1 + ORD(RANDOM_BYTES(1)) % 62, 1),
    SUBSTRING('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 1 + ORD(RANDOM_BYTES(1)) % 62, 1),
    SUBSTRING('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 1 + ORD(RANDOM_BYTES(1)) % 62, 1),
    SUBSTRING('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 1 + ORD(RANDOM_BYTES(1)) % 62, 1),
    SUBSTRING('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 1 + ORD(RANDOM_BYTES(1)) % 62, 1),
    SUBSTRING('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 1 + ORD(RANDOM_BYTES(1)) % 62, 1),
    SUBSTRING('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 1 + ORD(RANDOM_BYTES(1)) % 62, 1),
    SUBSTRING('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 1 + ORD(RANDOM_BYTES(1)) % 62, 1)
)
WHERE short_code IS NULL;

-- 백필 결과가 비었거나 형식을 어기면 여기서 실패한다.
ALTER TABLE resume_share_link
    MODIFY COLUMN short_code VARCHAR(10) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    ADD UNIQUE KEY uk_resume_share_link_short_code (short_code),
    ADD CONSTRAINT chk_resume_share_link_short_code
        CHECK (REGEXP_LIKE(short_code, '^[0-9A-Za-z]{10}$', 'c'));

-- 단축 주소 클릭 원장. 링크 id 와 시각만 남긴다 — 이력서 열람에서는 리퍼러·UA 를 모으지 않는다(ADR-0064).
-- 보존 365일(resume_access_log 와 같다, ADR-0077). 「단축 주소로 들어온 횟수」이고,
-- 어드민의 visitCount(페이지 열람)와는 다른 숫자다.
CREATE TABLE resume_short_link_click (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    share_link_id BIGINT NOT NULL,
    clicked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_resume_short_link_click_link (share_link_id, clicked_at),
    INDEX idx_resume_short_link_click_clicked (clicked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 링크별 누적 클릭 수. 원장을 보존기간으로 지워도 누적 수는 남는다.
-- 링크 행에 컬럼을 두지 않고 따로 둔다 — INSERT … ON DUPLICATE KEY UPDATE 로 원자적으로 올린다.
CREATE TABLE resume_short_link_stat (
    share_link_id BIGINT PRIMARY KEY,
    click_count BIGINT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
