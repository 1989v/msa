-- ADR-0064 — 이력서 사이트 (resume.1989v.com)
-- 콘텐츠 본문은 이 파일에 시드하지 않는다. msa 는 PUBLIC 레포라 마이그레이션에 이력서 원문을
-- 넣으면 토큰 게이트를 걸어도 GitHub 에서 그대로 읽힌다. 본문은 어드민에서 적재한다.

CREATE TABLE resume_document (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(80) NOT NULL,
    title VARCHAR(200) NOT NULL,
    body_markdown MEDIUMTEXT NOT NULL,
    kind VARCHAR(16) NOT NULL DEFAULT 'DETAIL',
    order_no INT NOT NULL DEFAULT 0,
    published TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_resume_document_slug (slug),
    INDEX idx_resume_document_order (kind, order_no),
    CONSTRAINT chk_resume_document_kind CHECK (kind IN ('MAIN', 'DETAIL'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 제출처별 공유 토큰. label = 어디에 낸 링크인지 (예: "OO사 백엔드").
CREATE TABLE resume_share_link (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    token VARCHAR(64) NOT NULL,
    label VARCHAR(120) NOT NULL,
    note VARCHAR(500),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at DATETIME NULL,
    UNIQUE KEY uk_resume_share_link_token (token),
    INDEX idx_resume_share_link_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 열람 기록. 수집 범위를 토큰·경로·시각으로 한정한다 (ADR-0064) — referer/UA/쿠키 미수집.
-- share_link_id 가 NULL 이면 전체공개 상태의 익명 열람.
CREATE TABLE resume_access_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    share_link_id BIGINT NULL,
    slug VARCHAR(80) NOT NULL,
    visited_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_resume_access_link (share_link_id, visited_at),
    INDEX idx_resume_access_visited (visited_at),
    CONSTRAINT fk_resume_access_link FOREIGN KEY (share_link_id)
        REFERENCES resume_share_link (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 공개 상태 단일 행. id=1 고정.
CREATE TABLE resume_setting (
    id BIGINT PRIMARY KEY,
    visibility VARCHAR(16) NOT NULL DEFAULT 'TOKEN_ONLY',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_resume_setting_visibility CHECK (visibility IN ('PUBLIC', 'TOKEN_ONLY'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 기본값은 닫힘. 구인중으로 바꾸기 전까지 토큰 없이는 열리지 않는다.
INSERT INTO resume_setting (id, visibility) VALUES (1, 'TOKEN_ONLY');
