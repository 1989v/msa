#!/bin/bash
set -e

mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" << EOF
CREATE DATABASE IF NOT EXISTS chatbot_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON chatbot_db.* TO '${MYSQL_USER}'@'%';
FLUSH PRIVILEGES;

USE chatbot_db;

CREATE TABLE IF NOT EXISTS conversation (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    channel_type    VARCHAR(20) NOT NULL,
    external_channel_id VARCHAR(255) NOT NULL,
    user_id         VARCHAR(255) NOT NULL,
    user_role       VARCHAR(20) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at      TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    last_active_at  TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    INDEX idx_external_channel (channel_type, external_channel_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status_last_active (status, last_active_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS message (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    conversation_id BIGINT NOT NULL,
    role            VARCHAR(20) NOT NULL,
    content         TEXT NOT NULL,
    token_count     INT NOT NULL DEFAULT 0,
    cost_usd        DECIMAL(10, 6),
    created_at      TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (conversation_id) REFERENCES conversation(id),
    INDEX idx_conversation_created (conversation_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
EOF
