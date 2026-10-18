-- 시장 응답(`GET /api/v1/place/markets/{contentId}`)이 운영에서 시장과 무관하게 **약 6초**였다.
-- 그중 5.3초가 시장 안 TourAPI 음식점을 찾는 `MarketTourMenuRepositoryAdapter.restaurants` 였다:
--   WHERE content_type_id='39' AND lang='ko' AND source='TOURAPI'
--     AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?
-- 위경도 인덱스가 없어 옵티마이저가 `uk_attractions_source_content_lang` 의 source='TOURAPI' 만으로
-- 2.4만 행(EXPLAIN rows 23,669, filtered 0.06%)을 넓은 행째 읽고 좌표를 뒤에서 걸렀다.
--
-- 등호 셋을 앞에, 범위인 위도를 그 뒤에 둔다. 경도는 인덱스 조건 푸시다운으로 걸러지므로
-- 위도 띠 안의 몇 행만 테이블로 간다.
--
-- **이 파일을 고치지 마라** — 커밋된 마이그레이션은 이미 적용됐을 수 있고, 고치면
-- 체크섬 불일치로 폴드 호스트가 통째로 기동하지 못한다.

CREATE INDEX idx_attractions_type_geo
    ON attractions (content_type_id, lang, source, latitude, longitude);
