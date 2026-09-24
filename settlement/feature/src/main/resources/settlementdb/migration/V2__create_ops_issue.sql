-- 운영 이슈 — 사람이 봐야 하는 건(지금은 DLT 로 떨어진 레코드). payment·order 의 ops_issue 와 같은 모양이라
-- 운영 큐 화면이 도메인 목록을 그대로 합친다. payload 는 DLT 레코드(원 토픽·키·값·헤더) — 재발행에 쓴다.
-- 상태는 VARCHAR(OPEN · RETRIED · CLOSED) — ENUM 으로 두면 값을 늘릴 때 운영에서만 INSERT 가 잘린다.
CREATE TABLE IF NOT EXISTS ops_issue (
    id             BIGINT        NOT NULL AUTO_INCREMENT,
    type           VARCHAR(30)   NOT NULL,
    target_id      VARCHAR(100)  NOT NULL,
    detail         VARCHAR(1000) NOT NULL,
    business_date  DATE          NULL,
    payload        MEDIUMTEXT    NULL,
    status         VARCHAR(20)   NOT NULL,
    actor_id       VARCHAR(64)   NULL,
    reason         VARCHAR(500)  NULL,
    created_at     DATETIME(6)   NOT NULL,
    updated_at     DATETIME(6)   NOT NULL,
    PRIMARY KEY (id),
    KEY idx_ops_issue_status (status, id),
    KEY idx_ops_issue_target (type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
