-- 같은 가게의 온누리·상가정보 행 짝(공개 투영과 같은 규칙, 적재가 시장마다 다시 계산해 적는 파생 열).
-- 검색이 짝을 상관 서브쿼리로 찾으면 가게 3.6만 행에서 2천만 행을 훑어 36초가 걸렸다.
ALTER TABLE market_store ADD COLUMN paired_store_id BIGINT NULL;
