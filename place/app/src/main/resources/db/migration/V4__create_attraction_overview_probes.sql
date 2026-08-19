-- ADR-0070 — 개요 수집 negative cache.
--
-- 수집 대상 선정 기준이 "attractions.overview 가 비었는가" 하나뿐이라, 원천(TourAPI
-- detailCommon2)이 개요를 빈 값으로 주는 레코드는 영원히 "비어 있음"으로 남아 매 실행마다
-- 큐 앞자리를 다시 차지한다. 하루 예산을 갉아먹는 양이 날마다 늘어난다.
--
-- 이 사실은 attractions 에 컬럼으로 붙이지 않는다 — bulk upsert 가 전체 동기화(syncFrom)라
-- 보존 예외를 하나 더 늘려야 하고, 그 목록이 길어질수록 무엇이 왜 보존되는지 알 수 없게 된다
-- (개요를 300건 잃은 사고가 그 예외에서 나왔다). 원천이 다른 사실은 테이블도 다르게 둔다.
--
-- 429·네트워크 실패는 여기 기록하지 않는다. 넣으면 그 레코드는 영영 재시도되지 않는다.
CREATE TABLE attraction_overview_probes (
    id         BIGINT       NOT NULL AUTO_INCREMENT,
    content_id VARCHAR(32)  NOT NULL,           -- TourAPI contentid
    lang       VARCHAR(8)   NOT NULL,           -- ko / en
    checked_at DATETIME     NOT NULL,           -- 원천이 빈 개요를 준 것을 마지막으로 확인한 시각
    PRIMARY KEY (id),
    UNIQUE KEY uk_attraction_overview_probes_content_lang (content_id, lang)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
