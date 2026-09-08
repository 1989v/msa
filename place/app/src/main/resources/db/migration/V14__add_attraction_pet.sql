-- 반려동물 동반 정보 (TourAPI `/detailPetTour2`).
--
-- `detailIntro2` 의 `chkpet` 은 국문 44,924건 중 3건만 채워져 있다 — 원천이 이 축을
-- **별도 오퍼레이션으로 옮겼기** 때문이다. 그쪽은 contentId 없이 목록으로 9,691건을 준다.
--
-- 원문은 통째로 남기고(`pet_raw`) 필터용은 파생 컬럼으로 둔다 — data-sources.md §0 ②.
ALTER TABLE attractions
    ADD COLUMN pet_acmpy_type VARCHAR(80) NULL COMMENT 'acmpyTypeCd — 「전구역 동반가능」 등, 필터 축' AFTER intro_synced_at,
    ADD COLUMN pet_raw        TEXT        NULL COMMENT 'detailPetTour2 응답 원문 (JSON)' AFTER pet_acmpy_type,
    ADD COLUMN pet_synced_at  DATETIME    NULL COMMENT '마지막 수집 시각 — 재수집 대상 판정' AFTER pet_raw,
    ADD KEY idx_attractions_pet (pet_acmpy_type);
