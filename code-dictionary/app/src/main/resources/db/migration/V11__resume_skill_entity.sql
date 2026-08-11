-- ADR-0064 — 기술을 문자열에서 행으로 승격하고 프로젝트와 잇는다.
--
-- 이전에는 프로젝트의 기술이 `resume_project.tags` JSON 문자열 배열이었고,
-- `resume_skill_group.items` 의 기술 목록과 아무 관계가 없었다. 그래서
--   · 오타가 조용히 새 기술이 되고
--   · 칩을 눌러도 모아볼 대상이 없고
--   · 기술 목록과 프로젝트 태그가 서로 다른 두 어휘로 갈라졌다
-- 기술에 식별자를 주고 M:N 으로 연결해 하나의 어휘로 합친다.

CREATE TABLE resume_skill (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    group_id BIGINT NULL COMMENT 'NULL 이면 미분류',
    order_no INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_resume_skill_name (name),
    INDEX idx_resume_skill_group (group_id, order_no),
    CONSTRAINT fk_resume_skill_group FOREIGN KEY (group_id)
        REFERENCES resume_skill_group (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE resume_project_skill (
    project_id BIGINT NOT NULL,
    skill_id BIGINT NOT NULL,
    PRIMARY KEY (project_id, skill_id),
    INDEX idx_resume_project_skill_skill (skill_id),
    CONSTRAINT fk_rps_project FOREIGN KEY (project_id)
        REFERENCES resume_project (id) ON DELETE CASCADE,
    CONSTRAINT fk_rps_skill FOREIGN KEY (skill_id)
        REFERENCES resume_skill (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- JSON_TABLE 이 만드는 컬럼은 커넥션 기본 콜레이션을 쓴다. 테이블은 utf8mb4_unicode_ci 라
-- 그대로 두면 이름 비교에서 "Illegal mix of collations" 로 죽는다. 컬럼 정의에 명시한다.

-- 그룹의 items JSON 을 개별 행으로 푼다. 배열 순서를 order_no 로 보존한다.
-- 같은 이름이 두 그룹에 있으면 먼저 만난 쪽이 이긴다 (이름이 유일 키라 어느 하나여야 한다).
INSERT IGNORE INTO resume_skill (name, group_id, order_no)
SELECT jt.name, g.id, jt.idx
FROM resume_skill_group g,
     JSON_TABLE(
         g.items, '$[*]'
         COLUMNS (
             idx FOR ORDINALITY,
             name VARCHAR(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PATH '$'
         )
     ) AS jt;

-- 프로젝트에 자유 텍스트로 적혀 있던 태그 중 카탈로그에 없는 것은 미분류로 흡수한다.
-- 여기서 버리면 이미 입력한 값이 조용히 사라진다.
INSERT IGNORE INTO resume_skill (name, group_id, order_no)
SELECT DISTINCT jt.name, NULL, 0
FROM resume_project p,
     JSON_TABLE(
         p.tags, '$[*]'
         COLUMNS (name VARCHAR(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PATH '$')
     ) AS jt;

INSERT IGNORE INTO resume_project_skill (project_id, skill_id)
SELECT p.id, s.id
FROM resume_project p
JOIN JSON_TABLE(
         p.tags, '$[*]'
         COLUMNS (name VARCHAR(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PATH '$')
     ) AS jt ON TRUE
JOIN resume_skill s ON s.name = jt.name;

-- 어휘를 하나로 유지하려면 옛 저장소를 남겨두면 안 된다.
ALTER TABLE resume_project DROP COLUMN tags;
ALTER TABLE resume_skill_group DROP COLUMN items;
