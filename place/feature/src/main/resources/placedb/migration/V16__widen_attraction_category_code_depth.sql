-- attraction_category_codes.depth 를 TINYINT → INT 로 넓힌다.
--
-- V13 은 depth 를 TINYINT 로 만들었는데 엔티티(AttractionCategoryCodeJpaEntity)의 필드는
-- Kotlin `Int` 다. Hibernate 는 TINYINT 를 Types#TINYINT, Int 를 Types#INTEGER 로 보므로
-- `ddl-auto=validate` 면 "wrong column type encountered in column [depth]" 로 기동이 깨진다.
--
-- 운영에서 안 터진 이유는 **검증을 안 했기 때문**이다 — place Deployment 가
-- SPRING_JPA_HIBERNATE_DDL_AUTO=none 으로 뜬다. ADR-0093 content 폴드의
-- 컨텍스트 로드 검사(validate)가 처음으로 이 어긋남을 잡았다.
--
-- 값 범위(1/2/3)만 보면 TINYINT 가 맞지만, Hibernate 가 Kotlin Int 를 TINYINT 로 보게 할
-- 방법이 columnDefinition 우회뿐이라 컬럼을 넓힌다. 확장이라 기존 행은 그대로다.
ALTER TABLE attraction_category_codes
    MODIFY COLUMN depth INT NOT NULL COMMENT '1(대)/2(중)/3(소)';
