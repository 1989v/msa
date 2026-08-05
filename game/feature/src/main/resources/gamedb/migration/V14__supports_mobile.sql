-- 모바일 지원 플래그 — 가상 터치패드(games/lib/touch.js) + 반응형 캔버스 적용 완료 게임들
UPDATE game SET supports_mobile = 1, updated_at = NOW(6)
WHERE slug IN ('monster-tamer', 'depth-delver', 'outlaw-frontier', 'ember-temple', 'overworld-quest',
               'gate-holdout', 'gear-bastion', 'iron-vanguard', 'frost-outpost', 'echo-duel');
