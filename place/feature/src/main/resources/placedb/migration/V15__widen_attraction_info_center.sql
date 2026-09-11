-- `info_center` 만 VARCHAR(255) 였다 — 형제 필드는 전부 TEXT 다.
--
-- TourAPI `infocenter` 는 안내소가 여럿이면 줄바꿈으로 이어 붙여 온다. 255자를 넘는 값 하나가
-- `Data too long for column 'info_center'` 로 **2,000건 배치를 통째로** 죽였고,
-- 그날 이용정보 적재가 999건에서 멈췄다(2026-09-08).
--
-- 잘라 담지 않고 넓힌다 — 원천 값을 가공 없이 그대로 저장한다는 규칙 그대로다
-- (data-sources.md §0 ②). 잘라 담으면 다음 배치가 매번 「달라졌다」고 판정해 계속 다시 쓴다.
ALTER TABLE attractions
    MODIFY COLUMN info_center TEXT NULL COMMENT 'TourAPI infocenter — 안내소가 여럿이면 줄바꿈으로 이어진다';
