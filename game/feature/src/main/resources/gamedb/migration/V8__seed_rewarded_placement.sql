-- rewarded 슬롯 — 게임 내 '이어하기/보너스' 보상 플로우용 (HOUSE 인터스티셜)
INSERT INTO ad_placement (placement_key, ad_type, provider, provider_slot_id, creatives, active)
VALUES ('game-rewarded-continue', 'REWARDED', 'HOUSE', NULL, JSON_ARRAY(
    JSON_OBJECT('title', '플랫폼 구경하고 이어하기', 'body', '5초 후 보상이 지급됩니다', 'href', '/portfolio', 'emoji', '🎁')
), 1);
