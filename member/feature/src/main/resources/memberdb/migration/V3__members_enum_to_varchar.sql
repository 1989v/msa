-- 운영 스키마의 이 컬럼은 예전에 Hibernate 가 만든 MySQL ENUM 이다(Flyway 기준선과 다를 수 있다).
-- 상태 값을 늘리면 ENUM 인 곳에서만 INSERT 가 "Data truncated" 로 잘리므로 VARCHAR 로 맞춘다.
-- ENUM·VARCHAR 어느 쪽에서 돌아도 결과가 같고, 기존 값은 그대로 문자열로 남는다.
ALTER TABLE members MODIFY COLUMN sso_provider VARCHAR(20) NOT NULL;
ALTER TABLE members MODIFY COLUMN status VARCHAR(20) NOT NULL;
