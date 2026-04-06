-- Git Submodule 개념 추가
INSERT INTO concept (concept_id, name, category, level, description) VALUES
('git-submodule', 'Git 서브모듈', 'INFRASTRUCTURE', 'INTERMEDIATE',
 '하나의 Git 저장소 안에 다른 Git 저장소를 독립적으로 포함시키는 메커니즘. 부모 repo는 서브모듈의 파일 내용을 직접 추적하지 않고 특정 커밋 SHA만 포인터로 기록한다.');

INSERT INTO concept_synonym (concept_id, synonym) VALUES
((SELECT id FROM concept WHERE concept_id = 'git-submodule'), 'submodule'),
((SELECT id FROM concept WHERE concept_id = 'git-submodule'), 'git submodule'),
((SELECT id FROM concept WHERE concept_id = 'git-submodule'), '서브모듈');
