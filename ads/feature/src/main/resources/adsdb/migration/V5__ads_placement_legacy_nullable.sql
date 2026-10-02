-- 옛 지면 컬럼(ad_placement.format·aspect_ratios·floor_micros) 걷어내기 1단계 — NULL 을 허용만 한다. 데이터는 바꾸지 않는다.
--
-- 새 코드는 이 세 컬럼을 매핑하지 않아 새 지면 행에는 NULL 이 들어간다. 롤링 배포 동안 함께 도는 옛 파드는
-- 여전히 세 컬럼에 값을 써서 넣으므로 그 INSERT 도 그대로 통과한다. 컬럼 삭제는 이 마이그레이션이 운영에
-- 나간 뒤의 다음 마이그레이션이 한다 — 같은 릴리스에서 지우면 옛 파드의 INSERT 가 없는 컬럼에 걸린다.
--
-- 옛 최저가 검사도 여기서 뗀다 — 삭제 단계가 컬럼 삭제만 하면 되게 한다.
-- 형태별 최저가 하한은 ad_placement_format.chk_ad_placement_format_floor 가 지킨다.
ALTER TABLE ad_placement DROP CHECK chk_ad_placement_floor;

ALTER TABLE ad_placement
    MODIFY COLUMN format VARCHAR(32) NULL,
    MODIFY COLUMN aspect_ratios VARCHAR(64) NULL,
    MODIFY COLUMN floor_micros BIGINT NULL;
