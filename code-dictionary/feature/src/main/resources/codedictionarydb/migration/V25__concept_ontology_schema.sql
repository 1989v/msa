-- 개념 온톨로지 스키마 (ADR-0100, 스펙 docs/specs/2026-09-23-concept-ontology).
--   kind       — 노드 유형 7종. NULL = 아직 어느 온톨로지 파일에도 놓이지 않은 개념
--   managed_by — 이 개념을 관리하는 온톨로지 파일의 도메인. 있으면 어드민 수정·삭제가 409
--   둘 다 로더만 쓴다. 데이터 이관은 여기서 하지 않는다 — 로더가 파일에서 한다.
ALTER TABLE concept ADD COLUMN kind VARCHAR(16) NULL AFTER level;
ALTER TABLE concept ADD COLUMN managed_by VARCHAR(40) NULL AFTER kind;
CREATE INDEX idx_concept_managed_by ON concept (managed_by);

-- 간선의 「왜」·적용 조건 한 줄과 기대는 근거 하나
ALTER TABLE concept_edge ADD COLUMN reason VARCHAR(500) NULL;
ALTER TABLE concept_edge ADD COLUMN evidence_ref VARCHAR(300) NULL;

-- 최신 적용 상태 단일 행(id = 1). 이력이 아니다.
--   로더는 이 행을 FOR UPDATE 로 먼저 잠근다 — 최초 부팅·새 도메인·전체 삭제도 같은 행에서 직렬화된다.
--   derived_hash 는 캐시·색인 갱신이 끝난 content_hash, sync_* 는 파드 간 단일 색인 실행 리스.
CREATE TABLE ontology_state (
    id               TINYINT      NOT NULL PRIMARY KEY,
    revision         INT          NOT NULL,
    content_hash     CHAR(64)     NULL,
    applied_at       DATETIME     NULL,
    app_version      VARCHAR(40)  NULL,
    derived_hash     CHAR(64)     NULL,
    derived_at       DATETIME     NULL,
    sync_owner       VARCHAR(64)  NULL,
    sync_lease_until DATETIME     NULL,
    sync_target_hash CHAR(64)     NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO ontology_state (id, revision) VALUES (1, 0);
