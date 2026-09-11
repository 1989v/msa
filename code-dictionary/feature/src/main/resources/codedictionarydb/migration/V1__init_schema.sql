CREATE TABLE concept (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    concept_id VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL,
    level VARCHAR(20) NOT NULL,
    description TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_concept_category (category),
    INDEX idx_concept_level (level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE concept_synonym (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    concept_id BIGINT NOT NULL,
    synonym VARCHAR(200) NOT NULL,
    FOREIGN KEY (concept_id) REFERENCES concept(id) ON DELETE CASCADE,
    INDEX idx_synonym_concept (concept_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE concept_relation (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    source_concept_id BIGINT NOT NULL,
    target_concept_id BIGINT NOT NULL,
    FOREIGN KEY (source_concept_id) REFERENCES concept(id) ON DELETE CASCADE,
    FOREIGN KEY (target_concept_id) REFERENCES concept(id) ON DELETE CASCADE,
    UNIQUE KEY uk_relation (source_concept_id, target_concept_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE concept_index (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    concept_id BIGINT NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    line_start INT NOT NULL,
    line_end INT NOT NULL,
    code_snippet TEXT,
    git_url VARCHAR(1000),
    description TEXT,
    git_commit_hash VARCHAR(40),
    indexed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (concept_id) REFERENCES concept(id) ON DELETE CASCADE,
    INDEX idx_concept_index_concept (concept_id),
    INDEX idx_concept_index_file (file_path)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
