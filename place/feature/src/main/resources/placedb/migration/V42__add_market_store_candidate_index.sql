-- 검색 후보(소속 IN 이 될 수 있는 가게)를 이 인덱스만 읽어 고른다. 원천 JSON 열이 있어 행이 무거운데,
-- 시장 828곳·가게 42만 행을 다 읽으면 검색 한 번이 30~60초였다(IN 은 6,800행).
ALTER TABLE market_store
    ADD KEY idx_market_store_candidate (membership, judged_membership, paired_store_id);
