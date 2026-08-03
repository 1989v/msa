-- 로컬 경량 인프라 — product 파이프라인 검증용 최소 DB/계정 (k8s/infra/local/mysql/configmap-init.yaml 발췌).
CREATE DATABASE IF NOT EXISTS product_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'product_user'@'%' IDENTIFIED BY 'product_password';
GRANT ALL PRIVILEGES ON product_db.* TO 'product_user'@'%';
FLUSH PRIVILEGES;
