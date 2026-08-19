-- 클린룸 게임 6종을 모바일 지원으로 전환한다.
--
-- 왜 꺼져 있었나: 클린룸 하드 룰이 `lib/` 열람을 금지해서, 이 게임들을 만든 세션은 공용
-- 가상패드(lib/touch.js)의 존재 자체를 몰랐다. 그래서 PC 전용으로 만들어졌고 시드도
-- supports_mobile=0 으로 박혔다. 이후 배선은 채워졌는데 플래그만 남아 있었다.
--
-- 검증 (터치 기기 에뮬레이션 390x844 · pointer:coarse · maxTouchPoints 5):
--   · 6종 전부 #vt-root 생성, 선언한 액션 버튼 개수만큼 렌더
--   · 조이스틱 드래그 -> 방향키 합성 -> window 수신 확인 (게임들은 window keydown 을 듣는다)
--   · Dungeon Crew 는 끝까지 확인 — 플레이어 x 996 -> 2026 실제 이동
--   · Raging Fist 의 KeyC -> KeyJ 는 lib/keys.js 의 GameKeys.remap 이 정상 동작한 것
--   · deadline 만 헤드리스에서 타이틀을 넘기지 못해 플레이 중 확인은 못 했다.
--     구조상으로는 정상이다 — .screen.panel 7종이 전부 메뉴이고 플레이는 그 밖의 캔버스라,
--     플레이 중에는 열린 패널이 없어 패드가 뜬다. 실기 확인 후 문제가 있으면 되돌린다.

UPDATE game
SET supports_mobile    = 1,
    content_updated_at = NOW(6)
WHERE slug IN ('abyssal-crown', 'ashen-warband', 'nova-strike',
               'raging-fist-saga', 'curfew-siren', 'deadline');
