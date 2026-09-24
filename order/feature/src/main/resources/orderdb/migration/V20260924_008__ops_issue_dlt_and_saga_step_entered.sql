-- 운영 큐 — order 의 ops_issue 를 다른 도메인과 같은 모양으로(기준일·DLT 레코드 컬럼).
-- 사가 체류 감지 — 지금 단계에 들어온 시각. 재발행은 시도 수만 올리고 이 값을 바꾸지 않는다.
-- 전부 확장(nullable 컬럼 추가)이라 옛 코드와 공존한다. 이전 행의 step_entered_at 은 NULL 이고 감지는 started_at 으로 대신 본다.
ALTER TABLE ops_issue ADD COLUMN business_date DATE NULL AFTER detail;
ALTER TABLE ops_issue ADD COLUMN payload MEDIUMTEXT NULL AFTER business_date;
ALTER TABLE order_saga ADD COLUMN step_entered_at DATETIME(6) NULL AFTER next_deadline_at;
ALTER TABLE order_saga ADD KEY idx_order_saga_stalled (status, step_entered_at);
