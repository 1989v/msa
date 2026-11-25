CREATE TABLE peer_prompt_tag (
    prompt_id BIGINT NOT NULL,
    tag VARCHAR(16) NOT NULL,
    PRIMARY KEY (prompt_id, tag),
    INDEX idx_peer_prompt_tag_filter (tag, prompt_id),
    CONSTRAINT chk_peer_prompt_tag CHECK (tag IN ('ANALYSIS', 'WRITING', 'REVIEW', 'PLANNING', 'SUMMARY'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
