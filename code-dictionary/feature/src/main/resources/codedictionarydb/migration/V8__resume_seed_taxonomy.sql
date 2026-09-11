-- ADR-0064 — 이력서 분류 체계 시드 (카테고리 · 기술 스택 그룹).
--
-- 이력서 본문(경력 서술)은 여기 두지 않는다. msa 가 PUBLIC 레포라 게이트가 무의미해지기 때문.
-- 다만 카테고리명과 기술 스택은 개인을 식별하지도, 사내 정보를 담지도 않는 일반 기술 용어라
-- 시드해 둔다. 손으로 넣는 것보다 재현 가능하다.
--
-- code 가 이미 있으면 건드리지 않는다 — 어드민에서 손본 값을 배포가 되돌리면 안 된다.

INSERT IGNORE INTO resume_category (code, label, description, order_no) VALUES
    ('search',         '검색',          '쿼리 이해, 매칭 조건과 필드 구성, 자동완성, 재정렬, 색인·벡터 검색', 1),
    ('display',        '전시',          '카테고리 체계, 노출 순서 개인화, Server-Driven UI',                  2),
    ('commerce',       '커머스',        '상품 파이프라인, 파트너 연동, 재고·가격 동기화, 판매 피크 대응',      3),
    ('platform',       '인프라·플랫폼', '배포 구조, 캐시·부하 대응, 장애 대응, 운영 도구',                     4),
    ('ai-engineering', 'AI 엔지니어링', '에이전트·하네스 설계, 임베딩 서빙, LLM 기반 분류·OCR 적용',           5);

-- 기술 스택. label 은 이력서의 그룹명을 그대로 쓴다.
-- note 는 그룹 옆에 괄호로 붙는 보충 설명이다 (검색처럼 "무엇을 했는지"가 목록만으로 안 드러날 때).
INSERT INTO resume_skill_group (label, items, note, order_no) VALUES
    ('Language',
     '["Java (8~25)", "Kotlin", "TypeScript"]',
     NULL, 1),
    ('Framework',
     '["Spring Boot", "Spring MVC", "Spring Security", "Spring Batch", "Spring Cloud Config"]',
     NULL, 2),
    ('Search',
     '["Elasticsearch", "OpenSearch"]',
     '색인 설계, 매칭·스코어 조정, 쿼리 이해, 자동완성, kNN·벡터 검색', 3),
    ('Persistence',
     '["JPA · QueryDSL", "MyBatis", "MySQL", "MsSQL", "Redis"]',
     NULL, 4),
    ('Messaging',
     '["Kafka", "Kafka Streams"]',
     NULL, 5),
    ('AI',
     '["임베딩 서빙 파이프라인", "LLM 기반 분류·OCR 적용", "에이전트·하네스 설계"]',
     NULL, 6),
    ('Infra',
     '["Docker", "Kubernetes", "Jenkins", "GitHub Actions", "Marathon/Mesos"]',
     NULL, 7),
    ('Architecture',
     '["Clean Architecture", "DDD", "MSA", "Server-Driven UI"]',
     NULL, 8),
    ('Test · 관측',
     '["JUnit", "Kotest", "JMeter", "nGrinder", "Scouter"]',
     NULL, 9);
