-- 프로젝트에 붙는 실제 코드 스니펫.
--
-- 공개면(`/portfolio`)은 상단 일부만 보여주고 로그인·광고 시청으로 전체를 열며,
-- 게이트 뒤 이력서는 항상 전체를 싣는다 — 무엇을 얼마나 보여줄지는 응답 조립이 정하고,
-- 저장소는 항상 전문을 갖는다. 잘라서 저장하면 이력서 쪽이 같이 잘린다.
--
-- git_url 은 FK 없는 참조다 — 저장소가 옮겨지거나 지워져도 스니펫은 남아야 한다.
-- 내용은 어드민에서 입력한다 (이력서 나머지와 같은 방식) — 시드 없음.
CREATE TABLE resume_project_code_snippet (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT NOT NULL,
    title VARCHAR(120) NULL,
    language VARCHAR(30) NOT NULL,
    file_path VARCHAR(300) NULL,
    line_start INT NULL,
    line_end INT NULL,
    git_url VARCHAR(400) NULL,
    code MEDIUMTEXT NOT NULL,
    order_no INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_rpcs_project (project_id, order_no),
    CONSTRAINT fk_rpcs_project FOREIGN KEY (project_id)
        REFERENCES resume_project (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
