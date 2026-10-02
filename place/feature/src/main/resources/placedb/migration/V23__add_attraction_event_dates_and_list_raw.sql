-- 행사·숙박·여행코스 목록 (ADR-0104).
--
-- 행사 시작일·종료일은 searchFestival2 의 eventstartdate·eventenddate 를 원천 값 그대로 둔다(수집기가 yyyyMMdd → DATE).
-- 비거나 앞뒤가 바뀐 값도 고치지 않는다 — 유효 기간 정규화는 색인 쪽 규칙이 한다.
-- 목록 행 원문은 searchFestival2 · searchStay2 · areaBasedList2(코스) 행 전체다. 컬럼으로 펴지 않은 키까지 남긴다.
-- 세 컬럼 모두 목록 동기화만 채우므로 다른 수집 경로의 왕복이 지우지 않게 syncFrom 이 보존한다.
ALTER TABLE attractions
    ADD COLUMN event_start_date DATE NULL COMMENT '행사 시작일 (searchFestival2 eventstartdate, 원천 값)' AFTER extra_synced_at,
    ADD COLUMN event_end_date DATE NULL COMMENT '행사 종료일 (searchFestival2 eventenddate, 원천 값)' AFTER event_start_date,
    ADD COLUMN list_raw TEXT NULL COMMENT '목록 행 원문 (행사·숙박·코스 목록)' AFTER event_end_date;
