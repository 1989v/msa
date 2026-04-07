#!/bin/bash
set -e

mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" << EOF
CREATE USER IF NOT EXISTS 'replicator'@'%' IDENTIFIED BY '${REPLICATION_PASSWORD}';
GRANT REPLICATION SLAVE ON *.* TO 'replicator'@'%';
FLUSH PRIVILEGES;
ALTER DATABASE order_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE order_db;

CREATE TABLE IF NOT EXISTS processed_event (
    event_id VARCHAR(36) PRIMARY KEY,
    topic VARCHAR(100) NOT NULL,
    processed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_processed_at (processed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
EOF
