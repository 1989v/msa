-- 공개면(`/portfolio`)과 게이트 뒤(이력서)는 같은 프로젝트를 **다른 수위로** 서술한다.
-- 기존 body_markdown 에는 장애 대응의 구체적 경위가 들어가 공개면에 둘 수 없고, 그렇다고
-- 지우면 이력서에서도 사라진다. 그래서 공개용 서술을 별도 컬럼으로 둔다.
--
-- 한 컬럼에 수위 플래그를 두는 방식은 쓰지 않았다 — 두 독자가 읽어야 할 글이 애초에 다르다.
ALTER TABLE resume_project
    ADD COLUMN public_body_markdown TEXT NULL COMMENT '공개면 전용 서술 — 설계 판단만' AFTER body_markdown;
