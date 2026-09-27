-- 광고 형태 — 지면은 형태(카드·띠배너)마다 허용 비율과 최저가(형태 규격)를 갖고, 캠페인은 만들 때 형태 하나를 고른다.
--
-- 옛 지면 컬럼(ad_placement.format·aspect_ratios·floor_micros)은 다음 마이그레이션까지 남긴다.
-- 그동안 코드는 대표 규격(카드가 있으면 카드, 없으면 첫 규격)을 옛 컬럼에 계속 쓰고 읽지는 않는다 —
-- 롤링 배포 중의 옛 파드와 이미지 되돌리기가 옛 컬럼을 읽는다.
CREATE TABLE ad_placement_format (
    placement_key VARCHAR(64) NOT NULL,
    format VARCHAR(16) NOT NULL,
    aspect_ratios VARCHAR(64) NOT NULL,
    floor_micros BIGINT NOT NULL,
    PRIMARY KEY (placement_key, format),
    CONSTRAINT chk_ad_placement_format_format CHECK (format IN ('CARD', 'BANNER')),
    -- CPM 1회 과금액 = floor(입찰 / 1000) 이 1 마이크로 이상이 되도록 (ad_placement 와 같은 하한)
    CONSTRAINT chk_ad_placement_format_floor CHECK (floor_micros >= 1000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 모든 지면의 지금 값을 그 지면 형식의 규격으로 옮긴다(운영자가 만든 지면 포함).
INSERT INTO ad_placement_format (placement_key, format, aspect_ratios, floor_micros)
SELECT placement_key, format, aspect_ratios, floor_micros FROM ad_placement;

-- 게임 목록 위는 띠배너(6.4:1, 0.05) 전용. 유료는 끈 채로 둔다 — 화면 배포를 확인한 뒤 어드민에서 켠다.
-- 옛 컬럼도 같은 값으로 맞춰 롤링 배포 중의 옛 파드가 1.91:1 이미지를 받지 않게 한다.
UPDATE ad_placement_format SET aspect_ratios = '6.4:1', floor_micros = 50000
WHERE placement_key = 'game-list-banner' AND format = 'BANNER';
UPDATE ad_placement SET aspect_ratios = '6.4:1', floor_micros = 50000
WHERE placement_key = 'game-list-banner' AND format = 'BANNER';

-- 블로그 글 끝·관광지 상세 끝은 카드에 더해 띠배너도 받는다.
INSERT INTO ad_placement_format (placement_key, format, aspect_ratios, floor_micros)
SELECT placement_key, 'BANNER', '6.4:1', 50000 FROM ad_placement
WHERE placement_key IN ('blog-post-end', 'attraction-end') AND format = 'CARD';

-- 캠페인 형태 — 기존 캠페인은 카드. HOUSE 에는 의미가 없어 기본값을 가질 뿐이다.
ALTER TABLE ad_campaign
    ADD COLUMN creative_format VARCHAR(16) NOT NULL DEFAULT 'CARD' AFTER name,
    ADD CONSTRAINT chk_ad_campaign_creative_format CHECK (creative_format IN ('CARD', 'BANNER'));
