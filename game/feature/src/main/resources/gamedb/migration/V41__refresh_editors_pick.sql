-- Editor's Pick 을 최근 대표작으로 다시 짠다.
--
-- 현재 상태의 유래: V2 가 `SELECT id FROM game ORDER BY id` 로 **그 시점의 전 게임**을 통째로 담았고,
-- V3·V7 이 신규 게임을 뒤에 덧붙였다. 그래서 지금 이 행은 '엄선' 이 아니라
-- **가장 오래된 8종의 목록**이다 (개념 짝맞추기 · 빈칸 채우기 · 코드 돋보기 …).
-- 큐레이션 행이 가장 오래된 것부터 보여 주면 첫인상이 정확히 거꾸로 간다.
--
-- 앞으로도 '전체 담기' 를 반복하지 않도록 슬러그를 명시해 6종만 고른다.
-- 신작이 나오면 이 행을 갱신하는 것이 운영 작업이다 (어드민에서도 편집 가능).

UPDATE game_collection
SET game_ids = (SELECT JSON_ARRAYAGG(id)
                FROM (SELECT g.id
                      FROM game g
                               JOIN (SELECT 'deadline' AS slug, 1 AS ord
                                     UNION ALL SELECT 'curfew-siren', 2
                                     UNION ALL SELECT 'ashen-warband', 3
                                     UNION ALL SELECT 'nova-strike', 4
                                     UNION ALL SELECT 'abyssal-crown', 5
                                     UNION ALL SELECT 'raging-fist-saga', 6) p ON p.slug = g.slug
                      ORDER BY p.ord) x),
    title    = 'MD 추천'
WHERE slug = 'editors-pick';
