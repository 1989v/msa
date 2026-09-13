-- experiment_db 기준선. 운영 스키마는 Flyway 없이 Hibernate 가 만들었고, 이 파일은 그 DDL 을
-- SHOW CREATE TABLE 로 그대로 옮긴 것이다(AUTO_INCREMENT 값만 뺐다).
-- 운영에서는 baseline 으로 표시만 되고 실행되지 않는다. 빈 스키마(테스트·새 환경)에서만 실제로 돈다.

CREATE TABLE `experiments` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `end_date` datetime(6) DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `start_date` datetime(6) DEFAULT NULL,
  `status` enum('COMPLETED','DRAFT','PAUSED','RUNNING') COLLATE utf8mb4_unicode_ci NOT NULL,
  `traffic_percentage` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `variants` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `config_json` text COLLATE utf8mb4_unicode_ci,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `weight` int NOT NULL,
  `experiment_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKh8ppgjlsr1o091jf2y58msh5d` (`experiment_id`),
  CONSTRAINT `FKh8ppgjlsr1o091jf2y58msh5d` FOREIGN KEY (`experiment_id`) REFERENCES `experiments` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
