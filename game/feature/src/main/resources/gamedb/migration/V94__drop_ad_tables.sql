-- 광고는 ads 서비스(ADR-0098)로 옮겨 갔다. 게임 목록 배너 소재는 ads 시드가 갖고 있고,
-- game 은 더 이상 광고 표를 읽지도 쓰지도 않는다. 세 표 사이에 외래 키는 없다.
DROP TABLE IF EXISTS reward_grant;
DROP TABLE IF EXISTS ad_policy;
DROP TABLE IF EXISTS ad_placement;
