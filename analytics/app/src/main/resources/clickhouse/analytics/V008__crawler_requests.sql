-- 검색엔진·AI 수집 로봇의 portal-fe 요청 시간 집계. 쓰는 쪽은 place-ingest 이미지의 `crawl-stats` 잡이고
-- (실행 장소일 뿐 place 도메인 데이터가 아니다) 스키마 주인은 analytics 다.
--
-- 개인정보 없음 — IP·UA 원문·전체 경로는 잡 밖으로 나가지 않고, 로봇·호스트·경로 유형·상태 칸별 건수만 남는다.
-- 보존 400일: 전년 같은 달과 비교할 수 있게.
--
-- 키에 pod 가 있는 이유: portal-fe 는 파드 하나라 교체 시간대에는 옛·새 파드가 한 시간을 나눠 갖는다.
-- pod 없이 ReplacingMergeTree(requests) 로 접으면 두 파드의 합이 아니라 한쪽 최댓값만 남는다.
-- 버전 열이 requests 인 이유: 같은 (시간, 파드) 를 다시 돌렸을 때 로그가 줄어 더 적게 읽어도 값이 줄지 않게.
-- 읽을 때는 FINAL 로 읽고 pod 를 더한다.
CREATE TABLE IF NOT EXISTS analytics.crawler_requests_hourly
(
    hour         DateTime('UTC'),
    pod          LowCardinality(String),
    host         LowCardinality(String),
    bot          LowCardinality(String),
    path_type    LowCardinality(String),
    status_class LowCardinality(String),
    requests     UInt32
)
ENGINE = ReplacingMergeTree(requests)
ORDER BY (hour, host, bot, path_type, status_class, pod)
TTL hour + INTERVAL 400 DAY;

-- 읽은 범위. (시간, 파드)당 한 행. 봇 수치를 읽을 때 같이 본다 — 하루 고유 hour 가 24 미만이거나
-- partial 시간이 있으면 그날 봇 수치는 하한이다.
-- partial = 그 파드의 첫 줄 시각이나 컨테이너 시작 시각이 시간 시작보다 늦음.
-- 로그 회전으로 앞부분을 잃은 경우는 컨테이너 시작 시각으로는 안 드러나고 첫 줄 시각으로만 드러난다.
CREATE TABLE IF NOT EXISTS analytics.crawler_log_coverage_hourly
(
    hour                 DateTime('UTC'),
    pod                  LowCardinality(String),
    lines                UInt32,
    first_line_at        DateTime('UTC'),
    container_started_at DateTime('UTC'),
    partial              UInt8,
    collected_at         DateTime('UTC')
)
ENGINE = ReplacingMergeTree(lines)
ORDER BY (hour, pod)
TTL hour + INTERVAL 400 DAY;
