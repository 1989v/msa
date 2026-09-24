-- 운영자 변경 기록 — 심사·광고주 정지/해제·지면·문맥 매핑·HOUSE 의 모든 변경에 행위자(운영자 회원 id)와 시각을 남긴다.
-- 대상 행에도 마지막 변경자가 있는 곳(심사자·정지자·매핑 수정자)이 있지만, 해제처럼 흔적이 지워지는 변경과
-- 변경자 컬럼이 없는 표(지면·캠페인)까지 한 곳에서 이어 보려면 이 표가 필요하다.
CREATE TABLE ad_admin_action (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    actor_member_id BIGINT NOT NULL,
    action VARCHAR(48) NOT NULL,
    target_type VARCHAR(32) NOT NULL,
    target_id VARCHAR(128) NOT NULL,
    detail VARCHAR(512) NULL,
    created_at DATETIME(6) NOT NULL,
    KEY idx_ad_admin_action_target (target_type, target_id, created_at),
    KEY idx_ad_admin_action_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
