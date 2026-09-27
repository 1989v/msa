-- 주로 즐기는 곳 (indoor · outdoor · mixed) — 원천에 없는 파생 값.
--
-- 분류 코드(lcls_systm3)로 정해지는 것은 규칙으로, 애매한 분류는 개요를 읽은 로컬 LLM 판정으로 채운다.
-- 채우는 쪽은 scripts/attraction-setting/ 이고, 목록 동기화는 이 컬럼을 건드리지 않는다(syncFrom 이 보존).
-- 검색은 「실내」·「비 오는 날」 질의를 이 값의 필터로 바꾼다.
ALTER TABLE attractions
    ADD COLUMN setting VARCHAR(16) NULL COMMENT 'indoor|outdoor|mixed — 분류 규칙 + 로컬 LLM 판정 (파생)' AFTER pet_synced_at;
