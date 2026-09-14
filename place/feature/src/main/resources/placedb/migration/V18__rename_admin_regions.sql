-- `admin_regions` → `administrative_regions`.
--
-- 이름이 문제였다: `admin` 이 **관리자(admin page)** 로 읽힌다. 실제 내용은 행정구역
-- (시도·시군구, 법정동 코드 기준)이고 어드민 화면과 아무 관계가 없다. API 경로
-- `/api/places/admin-regions` 를 보고 "어드민 페이지도 안 들어갔는데 왜 계속 불리지?" 라는
-- 오해가 실제로 생겼다.
--
-- 컬럼·인덱스·데이터는 그대로다. `RENAME TABLE` 은 메타데이터만 바꿔 즉시 끝난다.
RENAME TABLE admin_regions TO administrative_regions;
