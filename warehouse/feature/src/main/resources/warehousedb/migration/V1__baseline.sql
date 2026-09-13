-- warehouse_db 기준선. 운영 스키마는 Flyway 없이 Hibernate 가 만들었고, 이 파일은 그 DDL 을
-- SHOW CREATE TABLE 로 그대로 옮긴 것이다(AUTO_INCREMENT 값만 뺐다).
-- 운영에서는 baseline 으로 표시만 되고 실행되지 않는다. 빈 스키마(테스트·새 환경)에서만 실제로 돈다.

CREATE TABLE `warehouse` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `active` bit(1) NOT NULL,
  `address` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `latitude` double NOT NULL,
  `longitude` double NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
