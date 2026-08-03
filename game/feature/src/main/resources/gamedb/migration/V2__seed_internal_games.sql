-- ADR-0059 — 기존 portal-fe 퀴즈 4종을 INTERNAL_ROUTE 게임으로 등록 (플랫폼 초기 콘텐츠)

INSERT INTO game_tag (slug, name, display_order) VALUES
    ('puzzle', 'Puzzle', 1),
    ('casual', 'Casual', 2),
    ('education', 'Education', 3),
    ('memory', 'Memory', 4),
    ('quiz', 'Quiz', 5),
    ('arcade', 'Arcade', 6);

INSERT INTO game (slug, title, description, thumbnail_url, cover_url, engine_type, load_type, entry_url,
                  orientation, supports_mobile, developer_name, sdk_integrated, status, tags,
                  released_at, content_updated_at, created_at, updated_at)
VALUES
    ('concept-memory', 'Concept Memory',
     'IT 개념 이름과 설명 카드를 뒤집어 짝을 맞추는 기억력 게임. 코드 딕셔너리의 개념 데이터로 플레이합니다.',
     '/games/thumbs/concept-memory.svg', NULL, 'REACT_INTERNAL', 'INTERNAL_ROUTE', 'concept-memory',
     'BOTH', 1, 'kgd', 0, 'PUBLISHED', '["puzzle","memory","education","casual"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('fill-blank-quiz', 'Fill Blank Quiz',
     'IT 개념 설명의 빈칸을 채우는 퀴즈. 보기 중 알맞은 용어를 골라 지식을 점검합니다.',
     '/games/thumbs/fill-blank-quiz.svg', NULL, 'REACT_INTERNAL', 'INTERNAL_ROUTE', 'fill-blank-quiz',
     'BOTH', 1, 'kgd', 0, 'PUBLISHED', '["quiz","education","casual"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('code-magnifier', 'Code Magnifier',
     '돋보기로 코드 조각을 관찰하며 어떤 개념이 쓰였는지 맞히는 탐구형 게임.',
     '/games/thumbs/code-magnifier.svg', NULL, 'REACT_INTERNAL', 'INTERNAL_ROUTE', 'code-magnifier',
     'LANDSCAPE', 1, 'kgd', 0, 'PUBLISHED', '["puzzle","education","quiz"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('concept-cascade', 'Concept Cascade',
     '떨어지는 개념 카드를 올바른 카테고리로 드래그해 분류하는 아케이드 게임.',
     '/games/thumbs/concept-cascade.svg', NULL, 'REACT_INTERNAL', 'INTERNAL_ROUTE', 'concept-cascade',
     'BOTH', 1, 'kgd', 0, 'PUBLISHED', '["arcade","education","casual"]',
     NOW(6), NOW(6), NOW(6), NOW(6));

INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, t.tag_slug
FROM game g
         JOIN (SELECT 'concept-memory' AS slug, 'puzzle' AS tag_slug
               UNION ALL SELECT 'concept-memory', 'memory'
               UNION ALL SELECT 'concept-memory', 'education'
               UNION ALL SELECT 'concept-memory', 'casual'
               UNION ALL SELECT 'fill-blank-quiz', 'quiz'
               UNION ALL SELECT 'fill-blank-quiz', 'education'
               UNION ALL SELECT 'fill-blank-quiz', 'casual'
               UNION ALL SELECT 'code-magnifier', 'puzzle'
               UNION ALL SELECT 'code-magnifier', 'education'
               UNION ALL SELECT 'code-magnifier', 'quiz'
               UNION ALL SELECT 'concept-cascade', 'arcade'
               UNION ALL SELECT 'concept-cascade', 'education'
               UNION ALL SELECT 'concept-cascade', 'casual') t ON t.slug = g.slug;

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game;

INSERT INTO game_collection (slug, title, type, tag_slug, display_order, active, game_ids)
VALUES ('editors-pick', 'Editor''s Pick', 'MANUAL', NULL, 1, 1,
        (SELECT JSON_ARRAYAGG(id) FROM (SELECT id FROM game ORDER BY id) g)),
       ('trending', '지금 인기', 'TRENDING', NULL, 2, 1, JSON_ARRAY()),
       ('new-games', '새로 나온 게임', 'NEW', NULL, 3, 1, JSON_ARRAY()),
       ('education-picks', '학습 게임', 'TAG_BASED', 'education', 4, 1, JSON_ARRAY());
