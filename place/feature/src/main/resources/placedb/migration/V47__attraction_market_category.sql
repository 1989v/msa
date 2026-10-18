-- 전통시장을 쇼핑에서 떼어 제 분류(market)로 둔다. 수집기의 분류 규칙(sync_tour.categorize)과 같은 코드로 기존 행을 옮긴다.
-- category 는 원천 코드에서 계산한 파생 컬럼이라 원천 재호출 없이 여기서 다시 계산한다.
UPDATE attractions
SET category = 'market'
WHERE source = 'TOURAPI'
  AND category = 'shopping'
  AND (lcls_systm2 = 'SH06' OR cat3 IN ('A04010100', 'A04010200'));
