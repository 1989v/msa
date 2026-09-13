-- 부가 사진·반복정보 (TourAPI `/detailImage2`, `/detailInfo2`).
--
-- 대표사진(`image_url`)은 목록이 주는 1장뿐인데 원천은 더 갖고 있다 — 오대호 아트팩토리는
-- 17장이다. 반복정보는 관광지의 「내국인예약안내」·레포츠의 「코스안내」처럼 유형마다
-- 다른 것이 같은 자리에 온다(문화시설·쇼핑·음식점은 0건이라 편차가 크다).
--
-- **원문을 그대로 남긴다.** 둘 다 레코드당 여러 건이고 키가 유형마다 달라, 정규 컬럼으로
-- 펴면 유형이 늘 때마다 마이그레이션이 따라붙는다. 화면이 무엇을 쓸지 정해지면 그때
-- 파생 컬럼을 늘린다 — 원천 재호출 없이 다시 계산할 수 있다 (data-sources.md §0 ②).
--
-- 수집 여부는 값이 아니라 **받은 시각**으로 판정한다. 값으로 재면 「원천이 빈 응답을 준 것」과
-- 「아직 안 받은 것」이 구분되지 않아 매일 같은 레코드를 다시 부른다 (V11 과 같은 이유).
-- 두 오퍼레이션이 시각을 공유하는 이유는 한 레코드를 한 번에 훑기 때문이다.
ALTER TABLE attractions
    ADD COLUMN images_raw      JSON     NULL COMMENT 'detailImage2 응답 원문 (부가 사진 목록)' AFTER pet_synced_at,
    ADD COLUMN info_raw        JSON     NULL COMMENT 'detailInfo2 응답 원문 (반복정보 목록)' AFTER images_raw,
    ADD COLUMN extra_synced_at DATETIME NULL COMMENT 'detailImage2·detailInfo2 를 마지막으로 받은 시각' AFTER info_raw,
    ADD KEY idx_attractions_extra_sync (extra_synced_at);
