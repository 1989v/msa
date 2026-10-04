-- 영상 형태(쇼츠/일반) — ADR-0070 개정.
--
-- YouTube API 에 쇼츠 여부 필드가 없어 원천 값 둘로 가른다: 길이(contentDetails.duration)와
-- 플레이어 비율(player.embedWidth/Height, maxWidth 를 줘야 비율이 맞게 온다). 원천 값은 원문대로 두고
-- 판정 결과는 파생 컬럼 video_format 에 둔다(외부 데이터 연동 3규칙 ②).
ALTER TABLE attraction_links
    ADD COLUMN duration VARCHAR(32) NULL COMMENT '영상 길이 원문 ISO-8601 (videos.list contentDetails.duration)' AFTER view_count,
    ADD COLUMN embed_width INT NULL COMMENT '플레이어 폭 (videos.list player.embedWidth, maxWidth=640)' AFTER duration,
    ADD COLUMN embed_height INT NULL COMMENT '플레이어 높이 (videos.list player.embedHeight, maxWidth=640)' AFTER embed_width,
    ADD COLUMN video_format VARCHAR(10) NULL COMMENT '파생: SHORT(세로·3분 이하) / LONG, 모르면 NULL' AFTER embed_height;
