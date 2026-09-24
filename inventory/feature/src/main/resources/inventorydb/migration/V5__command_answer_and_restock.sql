-- 사가 명령 처리 — 확장만 한다(새 테이블 · 기본값 있는 컬럼). 옛 코드와 공존한다.

-- 확정 수량 중 가용으로 되돌린 합(클레임 재입고 · 결제 뒤 보류 만료). 상태는 CONFIRMED 그대로다.
ALTER TABLE reservation
    ADD COLUMN restocked_qty INT NOT NULL DEFAULT 0;

-- 명령에 낸 답의 원장. 같은 명령이 다시 오면 여기 있는 답을 그대로 다시 낸다.
-- (order_id, command_key) 유니크가 같은 명령 동시 처리 둘 중 하나를 효과째 롤백시킨다.
CREATE TABLE IF NOT EXISTS inventory_command_answer (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    order_id     BIGINT       NOT NULL,
    command_key  VARCHAR(100) NOT NULL,
    event_type   VARCHAR(100) NOT NULL,
    payload      JSON         NOT NULL,
    created_at   DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_inventory_command_answer (order_id, command_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 한 번만 도는 데이터 전환의 표식(옛 ACTIVE 예약 확정). 이벤트가 필요해 Flyway SQL 이 아니라 기동 작업이 한다.
CREATE TABLE IF NOT EXISTS inventory_migration_marker (
    name        VARCHAR(100) NOT NULL,
    applied_at  DATETIME(6)  NOT NULL,
    PRIMARY KEY (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
