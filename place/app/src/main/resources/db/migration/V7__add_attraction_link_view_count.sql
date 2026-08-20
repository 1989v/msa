-- ADR-0070 후속 — 영상 인기도(조회수).
--
-- `search.list` 는 관련성 순이라 "인기 영상"이 아니다. `videos.list` 로 조회수를 받아 정렬한다 —
-- 50개를 묶어 1 unit 이라 건당 100 units 인 search 옆에서는 사실상 공짜다.
--
-- 저장 기간 주의: YouTube API 서비스 약관은 API 데이터를 **30일 넘게 보관하려면 갱신**하도록
-- 요구한다. 그래서 YOUTUBE 소스의 신선도를 90일에서 30일로 줄였다 (AttractionLinkService).
ALTER TABLE attraction_links
    ADD COLUMN view_count BIGINT NULL COMMENT '영상 조회수 (YouTube videos.list)' AFTER published_at;
