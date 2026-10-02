-- 행사 문의처는 번호 여럿을 이어 붙여 온다(searchFestival2 최대 123자, 2026-10-02).
-- 100자를 넘는 값 하나에 bulk 묶음 전체가 Data too long 으로 실패했다 — 형제 문자열 컬럼(주소·제목)과 같은 너비로 둔다.
ALTER TABLE attractions MODIFY COLUMN tel VARCHAR(300) NULL;
