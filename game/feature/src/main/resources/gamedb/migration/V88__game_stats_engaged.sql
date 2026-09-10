-- 인기 정렬에 「실제로 논 판」을 더한다.
--
-- weekly_play_count 는 세션 **시작** 때 오르므로 열자마자 끈 것도 1점이다. 종료 신호가
-- 오지 않는 경로(탭을 그냥 닫는 경우)가 있어 이 값을 버릴 수는 없고, 대신 끝난 세션 중
-- 충분히 머문 것을 따로 세어 위에 얹는다. 무게는 GameStats.ENGAGED_WEIGHT 가 갖는다.
--
-- 기존 행은 0 으로 시작한다 — 지난 세션의 길이를 소급해 세지 않는다. 이번 주 리셋
-- (매주 월요일 00:00 KST) 이후부터 두 항이 같은 주를 가리킨다.
ALTER TABLE game_stats
    ADD COLUMN weekly_engaged_count BIGINT NOT NULL DEFAULT 0 AFTER weekly_play_count;
