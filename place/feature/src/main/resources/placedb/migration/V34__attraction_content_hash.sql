-- 관광지 본문 해시 · 본문 변경 시각.
--
-- 수집은 전량 upsert 라 updated_at 은 전화·이미지만 바뀌어도 오른다. 「본문이 실제로 바뀐 관광지」는
-- 병합이 끝난 행의 정규화 해시(AttractionContentHash, "v1:" + SHA-256 hex)가 정하고, 해시가 달라질 때
-- content_updated_at 이 오른다. RSS·IndexNow 가 이 시각으로 고른다. 원천 수정일(source_modified_at)과 다른 값이다.
--
-- 두 열은 도메인이 계산한다 — 적재 요청에서 받지 않는다. 백필은 없다: 다음 동기화가 첫 채움 규칙
-- (해시 계산, 시각 = 원천 수정일)으로 채운다. 목록 동기화가 닿지 않는 행은 null 로 남을 수 있다.
ALTER TABLE attractions
    ADD COLUMN content_hash VARCHAR(80) NULL,
    ADD COLUMN content_updated_at DATETIME(6) NULL;

-- 변경 목록 조회(since ≤ content_updated_at < until, id 키셋)용
CREATE INDEX idx_attractions_content_updated ON attractions (content_updated_at, id);
