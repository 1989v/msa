-- ADR-0064 — 회사 정렬은 재직 시작월이 결정한다.
--
-- order_no 는 start_month 에 이미 들어 있는 정보를 손으로 다시 적게 만드는 필드였다.
-- 경력 표는 최신순이 관례이고 시작월로 유일하게 정해지므로, 사람이 매길 여지를 없앤다.
-- (프로젝트·카테고리·기술 스택은 자연 순서가 없어 order_no 를 유지한다)

ALTER TABLE resume_company DROP COLUMN order_no;

-- 정렬 키가 바뀌었으니 인덱스도 옮긴다.
CREATE INDEX idx_resume_company_start ON resume_company (start_month DESC);
