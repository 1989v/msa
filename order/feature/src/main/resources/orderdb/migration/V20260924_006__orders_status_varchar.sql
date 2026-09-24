-- 운영 orders.status 는 예전에 Hibernate 가 만든 MySQL ENUM('CANCELLED','COMPLETED','PENDING') 이다.
-- Flyway V1 은 VARCHAR(20) 이라 새 스키마에서는 안 드러나고, 운영에서만 새 상태(PAYMENT_PENDING 등) INSERT 가
-- "Data truncated" 로 실패한다. 어느 쪽이어도 결과가 같도록 VARCHAR(20) 로 맞춘다.
ALTER TABLE orders MODIFY COLUMN status VARCHAR(20) NOT NULL;
