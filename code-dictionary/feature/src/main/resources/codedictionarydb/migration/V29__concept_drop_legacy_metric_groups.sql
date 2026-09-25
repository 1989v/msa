-- V22 시드의 옛 지표 묶음 둘. 온톨로지 파일(ADR-0100)이 오프라인 지표 · 운영 지표를 다른 개념으로 놓은 뒤
-- 관리 밖(managed_by NULL)으로 남아 어떤 간선 · 근거 · 매핑도 가리키지 않는다(2026-09-26 운영에서 참조 0 확인).
-- 관리 대상이 아닌 행만 지운다 — 파일이 같은 id 를 다시 쓰면 로더가 새로 만든다.
DELETE s FROM concept_synonym s JOIN concept c ON c.id = s.concept_id
 WHERE c.concept_id IN ('search-ops-metrics', 'offline-metrics') AND c.managed_by IS NULL;
DELETE r FROM concept_relation r JOIN concept c ON c.id = r.source_concept_id OR c.id = r.target_concept_id
 WHERE c.concept_id IN ('search-ops-metrics', 'offline-metrics') AND c.managed_by IS NULL;
DELETE FROM concept WHERE concept_id IN ('search-ops-metrics', 'offline-metrics') AND managed_by IS NULL;
