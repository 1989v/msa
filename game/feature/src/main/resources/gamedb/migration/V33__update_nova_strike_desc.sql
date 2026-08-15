-- 노바 스트라이크 설명 최신화: 레이븐 차지 개편(회전참 → 전진 차지 검기),
-- 커맨드 기술·출격 강화 3택1 반영, 해상도 표기 960×540 정정.

UPDATE game
SET description       = '32비트 세대 런앤건 액션 플랫포머 — 건슬링거 「더스크」(리볼버 연사+차지 매그넘)와 검객 「레이븐」(3연 콤보+전진 차지 검기) 중 헌터를 골라, 대시·월점프·커맨드 기술로 궤도 도시의 가디언 3기를 격파하고 보스 무기 약점 순환을 완성하라. 상승 용암·빙판·상승기류·낙뢰 기믹의 4개 지역, 페이즈 전환 보스 5전(최종 2형태), 출격 강화 3택1과 숨김 요소·코어 칩 영구 강화 상점. 스프라이트·배경·BGM 전부 코드 생성(960×540).',
    description_en    = 'A 32-bit-era run-and-gun action platformer. Pick your hunter — Dusk the gunslinger (revolver volleys and charged magnum rounds) or Raven the swordfighter (three-hit combos and charged sword waves) — then dash, wall-jump and unleash command moves through four themed zones, defeat three guardians and steal their weapons to complete the weakness cycle before a two-form final boss. Pre-mission perk picks, hidden upgrades and a permanent chip shop. Every sprite, backdrop and BGM is generated in code at 960x540.',
    content_updated_at = NOW(6),
    updated_at         = NOW(6)
WHERE slug = 'nova-strike';
