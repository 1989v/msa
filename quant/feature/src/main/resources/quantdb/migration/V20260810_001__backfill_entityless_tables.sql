-- Flyway 배선에 맞춰 **엔티티가 없어 만들어지지 않은** 테이블 3종을 보강한다.
--
-- 그동안 quant 스키마는 Hibernate ddl-auto=update 가 만들어 왔다(Boot 4 에서 Flyway 자동설정
-- 모듈이 분리된 걸 놓쳐 마이그레이션이 실행된 적이 없다). ddl-auto 는 @Entity 가 있는 것만
-- 만들기 때문에, V001 주석이 "Entity/Adapter 추가 전까지 스키마만 사전 마련"이라고 적어 둔
-- 테이블들은 운영에 존재하지 않았다 — 마이그레이션 정의 20개 중 3개.
--
-- 이제 baseline 을 현재 상태로 잡고 Flyway 를 켜므로, 이 3개는 이후 버전으로 다시 만들어야
-- 정의와 실제가 일치한다. 기존 환경/신규 환경 모두에서 안전하도록 IF NOT EXISTS 를 쓴다.
--   audit_log           : 감사 로그 (quant.audit.enabled=false 라 아직 미사용)
--   signal_strategy_run : 시그널 전략 실행 이력
--   indicator_revision  : 지표 CMS 개정 이력

CREATE TABLE IF NOT EXISTS audit_log (
    id BIGINT AUTO_INCREMENT NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    action VARCHAR(64) NOT NULL,
    target VARCHAR(128) NOT NULL,
    detail JSON NOT NULL,
    at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_audit_tenant_time (tenant_id, at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS signal_strategy_run (
    run_id BINARY(16) NOT NULL,
    strategy_id BINARY(16) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    period_start DATETIME(6) NOT NULL,
    period_end DATETIME(6) NOT NULL,
    status VARCHAR(16) NOT NULL,                  -- RUNNING / COMPLETED / FAILED
    summary_json JSON NULL,                       -- realized_pnl, fill_count, ...
    started_at DATETIME(6) NOT NULL,
    ended_at DATETIME(6) NULL,
    PRIMARY KEY (run_id),
    KEY idx_signal_run_tenant_strategy (tenant_id, strategy_id, started_at),
    KEY idx_signal_run_period (tenant_id, period_start, period_end),
    CONSTRAINT fk_signal_run_strategy
        FOREIGN KEY (strategy_id) REFERENCES signal_strategy(strategy_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS indicator_revision (
    revision_id BINARY(16) NOT NULL,
    content_id BINARY(16) NOT NULL,
    body_md MEDIUMTEXT NOT NULL,
    editor_id VARCHAR(64) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (revision_id),
    KEY idx_revision_content (content_id, created_at),
    CONSTRAINT fk_revision_content
        FOREIGN KEY (content_id) REFERENCES indicator_content(content_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
