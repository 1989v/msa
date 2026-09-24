-- 개념 온톨로지 증거층 (ADR-0100, 스펙 SR-5). 둘 다 온톨로지 파일이 소유하고 로더가 개념 단위로 전체 교체한다.
--   concept_id 는 값으로 든다(FK 없음) — concept_edge·tech_domain_concept 와 같다.
CREATE TABLE concept_evidence (
    id         BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    concept_id VARCHAR(100) NOT NULL,
    kind       VARCHAR(16)  NOT NULL,   -- ADR · POST · RECORD · MEASUREMENT
    ref        VARCHAR(300) NOT NULL,   -- ADR 파일명 · 블로그 slug · 볼트 raw 페이지명 · 측정 한 줄
    note       VARCHAR(500) NULL,
    ordinal    INT          NOT NULL DEFAULT 0,
    KEY idx_concept_evidence_concept (concept_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE concept_question (
    id         BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    concept_id VARCHAR(100) NOT NULL,
    ordinal    INT          NOT NULL DEFAULT 0,
    question   VARCHAR(300) NOT NULL,
    KEY idx_concept_question_concept (concept_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
