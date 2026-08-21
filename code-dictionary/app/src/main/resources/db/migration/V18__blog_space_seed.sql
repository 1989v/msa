-- ADR-0072 — 블로그 공간 시드: AI 하네스.
--
-- depth-1 카테고리는 화면에서 "공간"으로 승격된다 — 성격이 다른 발행물(기술 / 일상 /
-- 도메인별 CLAUDE.md·에이전트 하네스 공유)이 커뮤니티 게시판처럼 각자의 진입점을 갖는다.
-- path 는 도메인이 조립하는 값과 같은 규칙이어야 한다 (`/{root}`). V14 시드와 같은 형식.
INSERT INTO blog_category (parent_id, slug, name, description, depth, path, order_no) VALUES
    (NULL, 'harness', 'AI 하네스', '도메인별 베스트 CLAUDE.md · 에이전트 하네스 공유', 1, '/harness', 30);
