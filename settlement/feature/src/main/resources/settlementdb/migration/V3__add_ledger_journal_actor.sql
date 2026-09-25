-- 사람이 만든 원장 거래(어드민 역분개)의 행위자·사유. 이벤트가 만든 거래는 둘 다 NULL.
-- 확장만(nullable 컬럼 추가) — 옛 코드와 공존한다. 역분개는 원천 키 `reversal:journal:{원 거래 id}` 유니크라 거래당 하나.
ALTER TABLE ledger_journal
    ADD COLUMN actor_id VARCHAR(64)  NULL AFTER reversal_of,
    ADD COLUMN reason   VARCHAR(500) NULL AFTER actor_id;
