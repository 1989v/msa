-- ADR-0064 — 이력서의 구조화 영역.
-- 서술(마크다운)은 resume_document 가 계속 담당하고, 여기서는 반복·계산되는 것만 다룬다:
-- 재직 기간(연차 자동 계산), 프로젝트, 카테고리, 기술 스택.
-- 기간은 월 단위라 DATE 의 일자는 항상 01 로 둔다.

CREATE TABLE resume_category (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(40) NOT NULL,
    label VARCHAR(80) NOT NULL,
    description VARCHAR(300),
    order_no INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_resume_category_code (code),
    INDEX idx_resume_category_order (order_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE resume_company (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    start_month DATE NOT NULL,
    end_month DATE NULL COMMENT 'NULL 이면 재직 중',
    position VARCHAR(120),
    team VARCHAR(120),
    note VARCHAR(500),
    order_no INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_resume_company_order (order_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- company_id 가 NULL 이면 개인 프로젝트.
-- detail_slug 는 resume_document 의 상세 화면으로 잇는 연결고리 — FK 로 묶지 않는다.
-- 문서를 지워도 프로젝트 자체는 남아야 하고, 링크만 비면 되기 때문.
CREATE TABLE resume_project (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    company_id BIGINT NULL,
    category_id BIGINT NULL,
    start_month DATE NULL,
    end_month DATE NULL,
    summary VARCHAR(500),
    body_markdown MEDIUMTEXT,
    metrics JSON COMMENT '성과 지표 문자열 배열',
    tags JSON,
    detail_slug VARCHAR(80) NULL,
    order_no INT NOT NULL DEFAULT 0,
    published TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_resume_project_order (order_no),
    INDEX idx_resume_project_category (category_id, order_no),
    CONSTRAINT fk_resume_project_company FOREIGN KEY (company_id)
        REFERENCES resume_company (id) ON DELETE SET NULL,
    CONSTRAINT fk_resume_project_category FOREIGN KEY (category_id)
        REFERENCES resume_category (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 기술 스택은 "그룹 + 항목 나열"이 전부라 항목을 별도 테이블로 쪼개지 않는다.
CREATE TABLE resume_skill_group (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    label VARCHAR(80) NOT NULL,
    items JSON NOT NULL,
    note VARCHAR(300),
    order_no INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_resume_skill_group_order (order_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
