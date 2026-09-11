-- TourAPI detailIntro2 — 이용시간·휴무일·요금·주차·문의처.
--
-- **원천이 준 것은 통째로 남긴다** (data-sources.md §0 ①). 이 오퍼레이션은 관광 타입마다
-- 필드 집합이 다르고, 같은 개념의 키 이름도 다르다:
--     관광지(12)   usetime        restdate        infocenter        (요금 필드 없음)
--     문화시설(14)  usetimeculture restdateculture infocenterculture usefee / parkingfee
--     레포츠(28)   usetimeleports restdateleports infocenterleports
-- 이 합집합을 정규 컬럼으로 펴면 nullable 30개가 되고, 원천이 필드를 늘릴 때마다 마이그레이션이
-- 따라붙는다. 그래서 응답 전체를 JSON 으로 두고, 화면이 쓰는 것만 파생 컬럼으로 내린다.
--
-- 파생 컬럼은 유형별 키를 하나로 모은 값이다 — 규칙이 바뀌면 intro_raw 로 다시 계산할 수 있어
-- 원천 재호출이 필요 없다 (§0 ②).
ALTER TABLE attractions
    ADD COLUMN intro_raw       JSON         NULL COMMENT 'detailIntro2 응답 원문 (유형별 키 그대로)' AFTER overview,
    ADD COLUMN use_time        TEXT         NULL COMMENT '이용시간 — usetime/usetimeculture/usetimeleports…' AFTER intro_raw,
    ADD COLUMN rest_date       TEXT         NULL COMMENT '쉬는날 — restdate*' AFTER use_time,
    ADD COLUMN use_fee         TEXT         NULL COMMENT '이용요금 — usefee (유형에 따라 없음)' AFTER rest_date,
    ADD COLUMN parking         TEXT         NULL COMMENT '주차 가능 여부·규모 — parking*' AFTER use_fee,
    ADD COLUMN parking_fee     TEXT         NULL COMMENT '주차요금 — parkingfee (유형에 따라 없음)' AFTER parking,
    ADD COLUMN info_center     VARCHAR(255) NULL COMMENT '문의·안내처 — infocenter*' AFTER parking_fee,
    -- 수집 여부를 값으로 판정하면 "원천이 빈 값을 준 것" 과 "아직 안 받은 것" 이 구분되지 않아
    -- 매일 같은 레코드를 다시 부르게 된다. 시각을 따로 남긴다.
    ADD COLUMN intro_synced_at DATETIME     NULL COMMENT 'detailIntro2 를 마지막으로 받은 시각' AFTER info_center,
    ADD KEY idx_attractions_intro_sync (intro_synced_at);
