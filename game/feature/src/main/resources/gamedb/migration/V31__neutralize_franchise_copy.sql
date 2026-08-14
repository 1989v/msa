-- 카탈로그 소개문에서 타사 게임 명칭 제거 (IP 전수 점검, 2026-08-15).
-- 장르 서술은 유지하되 특정 상표를 부르지 않는다. 원문 시드(V29·V30)는 적용된
-- 마이그레이션이라 손대지 않고(체크섬) 소개문 전체를 새 문장으로 덮어쓴다.

UPDATE game
SET description        = '저승에 떨어졌다 — 베어서 올라가라. 무적 질주로 예고된 공격을 빠져나가고, 방마다 문 위의 문양으로 다음 보상을 고르고, 염라·바리·강림·마고 네 신격의 문장으로 빌드를 쌓는 로그라이크 액션. 3계층 끝의 재의 군주를 꺾으면 이승이다. 쓰러져도 명전과 영구 강화, 뱃사공의 예언은 남는다.',
    content_updated_at = NOW(6)
WHERE slug = 'nether-return';

UPDATE game
SET description        = '가라앉은 왕국의 마지막 창기사가 되어 심연의 세 지역을 돌파하는 로그라이크 액션. 무적 대시로 예고된 공격을 흘리고, 26종 축복으로 빌드를 쌓고, 페이즈 3단 보스를 꺾어라. 죽어도 심연 결정과 영묘의 영구 강화는 남는다. 그래픽·사운드 전부 절차 생성(2560×1440).',
    description_en     = 'A roguelike action game — the last lancer of a sunken kingdom cutting through three abyssal regions. Dash through telegraphed attacks, stack 26 blessings into a build, and break three multi-phase bosses. Death keeps your crystals and permanent upgrades. All art and audio are procedurally generated at 2560x1440.',
    content_updated_at = NOW(6)
WHERE slug = 'abyssal-crown';

UPDATE game
SET description        = '벨트스크롤 난투에 대전격투식 모션 커맨드를 얹었다 — ↓↘→ 파열탄, 승천각, 반원 폭쇄장, 기 게이지 초필까지 캔슬로 잇는 정통 커맨드 액션. 비 내리는 항만·제련소·설산 사원 3+1 스테이지, 비밀 통로와 봉인 두루마리, 히든 스테이지 분기. 스프라이트·배경·BGM 전부 코드 생성.',
    description_en     = 'Belt-scroll brawling meets fighting-game motion commands — quarter-circle fireballs, invincible uppercuts, half-circle busters and meter supers, all chained through cancels. Four themed stages (rainy harbor, foundry, snow temple, hidden void), secret rooms, sealed scrolls and a true-ending branch. Every sprite, backdrop and BGM is generated in code.',
    content_updated_at = NOW(6)
WHERE slug = 'raging-fist-saga';
