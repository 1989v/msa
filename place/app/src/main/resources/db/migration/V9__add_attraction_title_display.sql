-- 제목 파생 표기 (data-sources.md §0 ②) — 원천 title 은 그대로 두고 표시명/로컬명을 따로 든다.
--
-- 원천 제목은 꼬리 괄호에 다른 표기를 얹어 온다: 영문 행은 국문명(`Dosan Park(도산공원)`),
-- 국문 행은 지역 구분자(`청룡사(서울)`). 이 문자열이 그대로 외부 검색어·해시태그에 실려
-- `dosanpark도산공원` 같은 어디에도 없는 질의가 되고 있었다.
--
-- 분리 규칙(place:domain AttractionTitle.parse 와 동일해야 한다):
--   * 꼬리 괄호(반각/전각) 안에 **한글이 있을 때만** 가른다.
--   * `(Sunrise Peak)` 영문 병기·`(城山日出峰)` 한자 병기는 가르지 않는다 — 이름의 일부다.
--   * 괄호 앞 본문이 비면 가르지 않는다.
--
-- 이 백필은 기존 행 1회 채움이다. 이후 저장은 upsert 경로가 도메인 파서로 매번 다시
-- 계산하므로 전체 동기화가 돌아도 파생 컬럼이 지워질 수 없다 (§0 ③).
ALTER TABLE attractions
    ADD COLUMN title_display VARCHAR(300) NULL COMMENT '표시명 — title 에서 꼬리 한글 괄호를 뗀 파생 값' AFTER title,
    ADD COLUMN title_local   VARCHAR(300) NULL COMMENT '꼬리 괄호의 다른 표기 (영문 행: 국문명, 국문 행: 지역 구분자)' AFTER title_display;

-- 꼬리 괄호 구간(한글 포함, 괄호 중첩 없음)을 REGEXP_SUBSTR 로 통째로 뽑아,
-- 표시명은 길이 산술(LEFT)로, 로컬명은 양끝 괄호 제거로 얻는다 — $N 캡처 참조에 기대지
-- 않는 이유는 MySQL/MariaDB 간 이식성이 아니라 검증 가능성이다: 아래 두 식은 2026-08-22
-- 운영 MySQL 8 에서 파서 테스트 케이스 11종 전부와 일치함을 확인했다.
UPDATE attractions
SET title_local   = TRIM(REGEXP_REPLACE(
        REGEXP_SUBSTR(title, '[(（][^()（）]*[가-힣][^()（）]*[)）][[:space:]]*$'),
        '^[(（]|[)）][[:space:]]*$', '')),
    title_display = TRIM(LEFT(title, CHAR_LENGTH(title) - CHAR_LENGTH(
        REGEXP_SUBSTR(title, '[(（][^()（）]*[가-힣][^()（）]*[)）][[:space:]]*$'))))
WHERE title REGEXP '[^[:space:]][[:space:]]*[(（][^()（）]*[가-힣][^()（）]*[)）][[:space:]]*$';

-- 가르지 않는 행 — 표시명 = 원문(trim), 로컬명 없음
UPDATE attractions SET title_display = TRIM(title) WHERE title_display IS NULL;

ALTER TABLE attractions
    MODIFY COLUMN title_display VARCHAR(300) NOT NULL COMMENT '표시명 — title 에서 꼬리 한글 괄호를 뗀 파생 값';
