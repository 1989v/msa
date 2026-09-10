-- Phase 1 launch 시 cold-start 대비 mock seeding.
-- 실제 데이터 (Kafka consumer 로부터) 가 누적되기 전 빈 응답 회피용.
-- DBA / 운영자가 launch 직전 수동 적용. 향후 실데이터 충분히 누적되면 데이터는 자연 만료 (90일 TTL).
--
-- 시뮬레이션:
--   서울 (city_id=1) × 카테고리 호텔/액티비티/패키지 3종 × 상품 100개씩 × 5 사용자 행동

INSERT INTO analytics.recommendation_events (user_id, item_id, action_type, city_id, category_id, timestamp)
SELECT
    -- 5명의 가상 사용자
    1 + (rand() % 5) AS user_id,
    -- city_id 별 item_id 범위:  1000~1099 (city=1, cat=1 호텔), 1100~1199 (city=1, cat=2 액티비티), 1200~1299 (city=1, cat=3 패키지)
    (number % 100) + 1000 + ((number / 100 % 3) * 100) AS item_id,
    -- 행동 비율: pageview 70%, click 15%, addwish 10%, reservation 5%
    multiIf(
        rand() % 100 < 70, 'pageview',
        rand() % 100 < 85, 'click',
        rand() % 100 < 95, 'addwish',
        'reservation'
    ) AS action_type,
    1 AS city_id,
    (number / 100 % 3) + 1 AS category_id,
    now() - INTERVAL (rand() % 30) DAY AS timestamp
FROM numbers(3000);  -- 3,000 mock events (300 상품 × 평균 10 행동)
