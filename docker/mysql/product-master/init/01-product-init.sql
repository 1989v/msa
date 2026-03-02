-- product_db는 MYSQL_DATABASE 환경변수로 이미 생성됨

-- Replication 사용자 생성 (Master에서만)
CREATE USER IF NOT EXISTS 'replicator'@'%' IDENTIFIED BY 'replication_pw_2024';
GRANT REPLICATION SLAVE ON *.* TO 'replicator'@'%';
FLUSH PRIVILEGES;

-- 기본 charset 확인
ALTER DATABASE product_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
