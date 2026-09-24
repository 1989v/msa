-- 운영 fulfillment_order.status 는 Hibernate 가 만든 MySQL ENUM 이다(Flyway 기준선은 VARCHAR).
-- 상태를 늘리면 운영에서만 INSERT 가 잘리므로 VARCHAR(20) 로 맞춘다.
ALTER TABLE fulfillment_order MODIFY COLUMN status VARCHAR(20) NOT NULL;
