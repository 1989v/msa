-- DLT 레코드를 운영 이슈로 적재한다(type=DLT) — 재발행에 쓸 원 토픽·키·값·헤더를 payload 에 남긴다.
-- 확장만(nullable 컬럼 추가)이라 옛 코드와 공존한다.
ALTER TABLE ops_issue ADD COLUMN payload MEDIUMTEXT NULL AFTER business_date;
