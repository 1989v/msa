-- Phase 3.5 — 더 큰 mock seed (의미 있는 embedding 학습용)
-- 100 사용자 × 300 상품 × 평균 100 행동 ≈ 30,000 events
-- 사용자별로 선호 카테고리 1개 (clustering) → 학습 시 user/item embedding 이 자연스럽게 분리
--
-- 적용 전 기존 mock 데이터 제거 권장:
--   TRUNCATE analytics.recommendation_events;

INSERT INTO analytics.recommendation_events (user_id, item_id, action_type, city_id, category_id, timestamp)
WITH
    user_prefs AS (
        -- 100 명의 사용자별 선호 (city, category) 선정 — clustering 효과
        SELECT
            (number + 1) AS user_id,
            (number % 3) + 1 AS pref_city,
            (intDiv(number, 33) % 3) + 1 AS pref_category
        FROM numbers(100)
    ),
    raw_events AS (
        -- 사용자당 평균 300 events
        SELECT
            up.user_id,
            up.pref_city,
            up.pref_category,
            rand(number) AS r1,
            rand(number + 1000) AS r2,
            rand(number + 2000) AS r3,
            rand(number + 3000) AS r4
        FROM user_prefs AS up
        CROSS JOIN numbers(300) AS n
    )
SELECT
    user_id,
    -- 70% 사용자의 선호 city, 60% 선호 category
    if((r1 % 10) < 7, pref_city, (r1 % 3) + 1) * 1000
        + if((r2 % 10) < 6, pref_category - 1, (r2 % 3)) * 100
        + (r3 % 100) AS item_id,
    -- 행동 분포: pageview 60% / click 25% / addwish 10% / reservation 5%
    multiIf(
        (r4 % 100) < 60, 'pageview',
        (r4 % 100) < 85, 'click',
        (r4 % 100) < 95, 'addwish',
        'reservation'
    ) AS action_type,
    intDiv(item_id, 1000) AS city_id,
    intDiv(item_id % 1000, 100) + 1 AS category_id,
    now() - INTERVAL ((r4 + r3) % 30) DAY AS timestamp
FROM raw_events;
