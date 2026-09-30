-- 관광지 일 집계에 「그날 클릭한 고유 방문자」 집계 상태를 더한다.
-- search 재색인이 이 표를 직접 읽어(ADR-0095 §6) 최근 14일을 `uniqMerge` 로 합친다 —
-- 한 사람이 여러 날 눌러도 1로 센다. 일별 수를 더하면 「방문자-일」이 되어 뜻이 달라진다.
--
-- 익명(`anonymous`)은 넣지 않는다 — 방문자 헤더가 없는 요청이 전부 한 값으로 모여 있어서다.
-- 노출도 넣지 않는다 — 노출은 순위가 만든 결과라 순위 신호로 되먹이면 안 된다.
--
-- **불변식: (day, attraction_id) 당 한 행.** 집계기(`ClickHouseAttractionPopularityAdapter`)는 그날을
-- 지운 뒤 GROUP BY 결과를 한 번만 넣는다. 표 엔진은 `SummingMergeTree((impressions, clicks))` 라
-- 이 컬럼은 합산 목록 밖이고, 같은 키의 두 행이 병합되면 **한 행의 상태만 남는다**(합쳐지지 않는다).
-- 불변식이 지켜지는 한 병합할 두 행이 없으므로 안전하다. 엔진 인자는 ALTER 로 못 바꾸니
-- 이 컬럼을 합산 목록에 넣으려 하지 말고, 집계기가 같은 날을 두 번 넣지 않게 지킨다.
--
-- 기존 행은 빈 상태(uniqMerge 결과 0)로 남는다. 배포 뒤 최근 14일을 한 번 다시 접어야 창이 찬다 —
-- analytics 의 `/internal/attraction-popularity/reaggregate?days=14`.
-- 기동할 때마다 적용돼도 안전하도록 IF NOT EXISTS 다.
ALTER TABLE analytics.attraction_popularity_daily
    ADD COLUMN IF NOT EXISTS unique_clickers AggregateFunction(uniq, String);
