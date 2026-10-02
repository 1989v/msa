-- 옛 지면 컬럼(ad_placement.format·aspect_ratios·floor_micros) 걷어내기 2단계 — 지운다.
--
-- V5 가 운영에 나가 이 세 컬럼을 매핑하는 코드가 더 없다. 형태별 비율·최저가는 ad_placement_format 이 원본이다.
-- V5 와 다른 릴리스로 내는 이유: 같은 릴리스면 롤링 배포 동안 옛 파드가 없는 컬럼을 읽고 쓴다.
ALTER TABLE ad_placement
    DROP COLUMN format,
    DROP COLUMN aspect_ratios,
    DROP COLUMN floor_micros;
