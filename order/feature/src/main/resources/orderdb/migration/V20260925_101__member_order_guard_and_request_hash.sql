-- 결제 대기 상한의 잠금 행 — 회원당 하나. 접수 트랜잭션이 SELECT … FOR UPDATE 로 잠가 같은 회원의 동시 접수를 줄 세운다.
CREATE TABLE IF NOT EXISTS member_order_guard (
    user_id     VARCHAR(100)  NOT NULL,
    created_at  DATETIME(6)   NOT NULL,
    PRIMARY KEY (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 같은 Idempotency-Key 에 다른 본문이 오면 422 — 대조할 본문 해시(SHA-256 hex). 기존 행은 NULL 이고 대조하지 않는다(보관 24시간).
ALTER TABLE idempotency_key ADD COLUMN request_hash VARCHAR(64) NULL;
