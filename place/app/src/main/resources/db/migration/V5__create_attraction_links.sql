-- ADR-0070 — 관광지 외부 콘텐츠 링크(수집형) + 수집 상태.
--
-- 딥링크(인스타·투어 상품)는 여기에 없다. 관광지명으로 조립되는 함수라 행으로 만들면
-- 6만 × 제공자 수만큼 같은 규칙의 복제본이 쌓이고 템플릿을 바꿀 때마다 전량 재적재해야 한다.
--
-- attractions 에 컬럼으로 붙이지 않는 이유: bulk upsert 가 전체 동기화(syncFrom)라 보존 예외를
-- 늘려야 하고, 원천도 갱신 주기도 다르다 (TourAPI 는 덮어쓰고 링크는 만료된다).
CREATE TABLE attraction_links (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    attraction_id BIGINT       NOT NULL,           -- FK-as-ID (jpa-persistence §1)
    source        VARCHAR(20)  NOT NULL,           -- YOUTUBE / NAVER_BLOG
    external_id   VARCHAR(100) NOT NULL,           -- videoId 등 원천 식별자
    title         VARCHAR(300) NOT NULL,
    url           VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500) NULL,
    author        VARCHAR(100) NULL,               -- 채널명 / 블로그명
    published_at  DATETIME     NULL,
    sort_order    INT          NOT NULL DEFAULT 0, -- 소스 내 표시 순서
    collected_at  DATETIME     NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_attraction_links_natural (attraction_id, source, external_id),
    KEY idx_attraction_links_lookup (attraction_id, source, sort_order)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 수집 상태 겸 우선순위 큐.
--
-- **행을 지우지 않는다.** next_attempt_at 하나로 신선도(성공 후 90일)·재시도(빈 결과 30일,
-- 실패 1일)를 모두 표현하고, last_attempt_at 으로 그날 쓴 API 호출 수를 센다. 성공 행을
-- 지우면 그날 몇 번 불렀는지 알 수 없어져 일일 예산(YouTube search.list 는 하루 100건)을
-- 지킬 수 없다. 별도 카운터 테이블을 두지 않는 이유이기도 하다.
--
-- 실패를 영구 제외로 바꾸지 않는다 — 429 는 한도이지 그 레코드의 결함이 아니다.
CREATE TABLE attraction_link_requests (
    id              BIGINT      NOT NULL AUTO_INCREMENT,
    attraction_id   BIGINT      NOT NULL,
    source          VARCHAR(20) NOT NULL,
    view_count      INT         NOT NULL DEFAULT 1,  -- 우선순위 — 실제로 열어본 곳부터 채운다
    requested_at    DATETIME    NOT NULL,
    last_attempt_at DATETIME    NULL,                -- 그날 소진량 집계 기준
    next_attempt_at DATETIME    NULL,                -- NULL = 즉시 대상
    PRIMARY KEY (id),
    UNIQUE KEY uk_attraction_link_requests_natural (attraction_id, source),
    KEY idx_attraction_link_requests_queue (source, next_attempt_at, view_count)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
