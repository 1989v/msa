-- 같은 가게의 온누리·상가정보 행을 짝짓는 파생 키(정규화한 이름+지번의 SHA-256, MarketStoreIdentity).
-- 검색이 행마다 정규식으로 이름·지번을 정규화해 비교하면 가게 2만 행에서 응답이 125초까지 늘었다.
-- 기존 행은 다음 적재 때 채워진다(NFKC 정규화는 SQL 로 못 한다).
ALTER TABLE market_store
    ADD COLUMN identity_key VARCHAR(64) NULL,
    ADD KEY idx_market_store_identity (market_id, identity_key);
