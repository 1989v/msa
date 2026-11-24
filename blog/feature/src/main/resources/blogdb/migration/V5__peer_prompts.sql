-- Member-authenticated prompt sharing. Immutable content keeps reviews tied to the exact prompt tested.
CREATE TABLE peer_prompt (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    author_profile_id BIGINT NOT NULL,
    domain VARCHAR(40) NOT NULL,
    title VARCHAR(160) NOT NULL,
    purpose VARCHAR(1000) NOT NULL,
    model_context VARCHAR(2000) NOT NULL,
    prompt_text MEDIUMTEXT NOT NULL,
    removed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_peer_prompt_domain (domain, removed, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE peer_prompt_review (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    prompt_id BIGINT NOT NULL,
    profile_id BIGINT NOT NULL,
    reviewer_domain VARCHAR(80) NOT NULL,
    reviewer_role VARCHAR(80) NOT NULL,
    score INT NOT NULL,
    worked VARCHAR(2000) NOT NULL,
    limitations VARCHAR(2000) NOT NULL,
    context VARCHAR(2000) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_peer_review_member (prompt_id, profile_id),
    CONSTRAINT chk_peer_review_score CHECK (score BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
