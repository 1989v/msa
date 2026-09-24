-- 개념 → 이 레포 코드. 온톨로지 파일이 소유하고 로더가 개념 단위로 교체한다.
--   줄 번호가 아니라 심볼로 가리킨다 — 코드가 움직여도 썩지 않게. 화면이 GitHub 원본에서 symbol 의 첫 줄부터 보여 준다.
--   concept_index(재색인 소유)와 별개다.
CREATE TABLE concept_code_ref (
    id         BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    concept_id VARCHAR(100) NOT NULL,
    ordinal    INT          NOT NULL DEFAULT 0,
    path       VARCHAR(300) NOT NULL,
    symbol     VARCHAR(200) NOT NULL,
    note       VARCHAR(300) NULL,
    KEY idx_concept_code_ref_concept (concept_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
