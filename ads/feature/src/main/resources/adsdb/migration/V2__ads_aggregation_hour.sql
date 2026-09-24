-- 집계를 닫은 시각(KST 시각의 시작). 카운터가 하나도 없던 시각도 행을 갖는다.
--
-- 닫힌 시각은 다시 집계하지 않고, 미등록 지면 요청 수는 닫을 때 한 번만 더한다(이 행과 같은 트랜잭션).
-- 광고주별 「정산 완료 시각」은 이 표에서 빈틈없이 닫힌 마지막 시각을 넘지 않는다 —
-- 행이 없는 시각이 있으면 그 시각의 지출이 아직 집계되지 않았을 수 있다.
CREATE TABLE ad_aggregation_hour (
    hour_kst DATETIME NOT NULL PRIMARY KEY,
    closed_at DATETIME(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
