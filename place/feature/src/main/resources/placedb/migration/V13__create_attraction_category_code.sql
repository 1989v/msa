-- TourAPI 분류체계 코드표 (`/lclsSystmCode2`).
--
-- `attractions` 는 `lcls_systm1~3` 을 **코드로만** 갖고 있다. 코드로는 필터 UI 를 만들 수 없고,
-- 질의의 「자연」·「온천」이 어느 코드인지도 이을 수 없다. 이름이 그 둘을 잇는다.
--
-- 원천 호출 한 번이면 전량이 들어오고 거의 바뀌지 않는다 — 그런데도 표로 두는 이유는,
-- 코드→이름을 코드에 박으면 원천이 분류를 늘렸을 때 배포를 해야 반영되기 때문이다.
CREATE TABLE attraction_category_codes (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    lang        VARCHAR(8)   NOT NULL COMMENT 'ko/en — 서비스(KorService2/EngService2)별로 이름이 다르다',
    code        VARCHAR(16)  NOT NULL COMMENT 'NA / NA02 / NA020100 — 길이가 곧 depth 다',
    depth       TINYINT      NOT NULL COMMENT '1(대)/2(중)/3(소)',
    -- 3단 코드는 앞자리가 상위 코드라 문자열로 유도할 수 있지만, 원천이 그 규칙을 어길 때가 있어
    -- 받은 그대로 남긴다(파생으로 계산하면 어긋난 행을 조용히 만들어 낸다).
    parent_code VARCHAR(16)  NULL COMMENT 'depth 1 은 NULL',
    name        VARCHAR(160) NOT NULL,
    synced_at   DATETIME     NOT NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_attraction_category_codes (lang, code),
    KEY idx_attraction_category_codes_tree (lang, depth, parent_code)
) COMMENT='TourAPI 분류체계 코드→이름 (ADR-0065) — place-ingest 가 쓰고 search 가 읽는다';
