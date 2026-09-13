-- chatbot_db 기준선. 운영 스키마는 Flyway 없이 Hibernate 가 만들었고, 이 파일은 그 DDL 을
-- SHOW CREATE TABLE 로 그대로 옮긴 것이다(AUTO_INCREMENT 값만 뺐다).
-- 운영에서는 baseline 으로 표시만 되고 실행되지 않는다. 빈 스키마(테스트·새 환경)에서만 실제로 돈다.

CREATE TABLE `conversation` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `channel_type` enum('API','SLACK','WEB') COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `external_channel_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_active_at` datetime(6) NOT NULL,
  `status` enum('ACTIVE','CLOSED','EXPIRED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_role` enum('EXTERNAL','INTERNAL') COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `message` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `cost_usd` decimal(10,6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `role` enum('ASSISTANT','SYSTEM','USER') COLLATE utf8mb4_unicode_ci NOT NULL,
  `token_count` int NOT NULL,
  `conversation_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FK6yskk3hxw5sklwgi25y6d5u1l` (`conversation_id`),
  CONSTRAINT `FK6yskk3hxw5sklwgi25y6d5u1l` FOREIGN KEY (`conversation_id`) REFERENCES `conversation` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
