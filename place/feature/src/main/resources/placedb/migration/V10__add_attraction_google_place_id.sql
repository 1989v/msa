-- 구글맵 딥링크용 Google Places place_id (파생/보강 컬럼 — data-sources.md §0 ② · §7).
--
-- 좌표 링크(`query={lat},{lng}`)는 장소 카드가 아니라 맨 핀에 떨어진다. place_id 를 실으면
-- Maps URLs API(`query_place_id=`)가 리뷰·사진·영업시간이 붙은 장소 카드를 연다 — 키·쿼터 불요.
--
-- **id 문자열 외에는 저장하지 않는다.** Google Places 정책이 무기한 저장을 허용하는 유일한
-- 필드가 place_id 다. 이름·주소·평점은 TourAPI 원천이 이미 있으므로 섞지 않는다.
--
-- 채움은 place-ingest 가 Places Text Search(New, fieldMask=places.id) 로 점진 수집한다.
-- 개요(overview)와 같은 보강 필드라 목록 전체 동기화(`Attraction.syncFrom`)가 덮지 않는다.
-- 가산적(additive-only) 변경 — surge 오버랩 중 구 파드는 이 컬럼을 모른 채 동작한다 (ADR-0075).
ALTER TABLE attractions
    ADD COLUMN google_place_id VARCHAR(128) NULL COMMENT 'Google Places place_id — 구글맵 딥링크용, id 외 저장 금지' AFTER overview;
