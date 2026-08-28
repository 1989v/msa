-- 궁수 키우기 설명문 갱신.
--
-- V61 의 설명은 초판 기준이라 실물과 어긋난다 — 구역이 5곳에서 29곳으로, 지도가 88×88 에서
-- 600×600 으로 늘었고 유물·벙커·특수 사격·난이도·승급이 뒤에 들어왔다.
-- V61 을 고치지 않고 새 버전으로 내는 이유는 이미 적용될 마이그레이션이기 때문이다 —
-- 되고치면 체크섬 불일치로 code-dictionary 가 통째로 기동하지 못한다(폴드 호스트라 7개 도메인이 함께 죽는다).

UPDATE game
SET description = '좀비가 뒤덮은 도시에 궁수 하나가 남았다. 사거리 안의 좀비는 알아서 쏘고, 잡으면 고철이 남는다. 고철은 기지 안에 있을 때만 보급품으로 바뀌고, 그 보급품으로 화살 위력을 끝없이 올린다. 몇 단계부터 한 방인지가 기지 화면에 떠 있어 다음 목표가 늘 분명하다. 지도는 600×600 에 구역 29곳, 곳곳에 좀비 무리가 주둔하고 있어서 다가가면 한꺼번에 일어난다. 언덕 위 주둔지는 계단으로 뚫고 올라가야 하고, 물자 더미는 한 번 캐면 사라져 결국 다음 구역을 열게 된다. 일꾼을 고용하면 알아서 캐 오고 벙커도 지어 주지만, 벙커는 용병이 들어가야 쏜다. 특수 사격 다섯 가지 중 하나만 들고 나가며 기지에서 갈아 끼운다. 유물 여덟 개는 금고를 지키는 군단을 뚫어야 나온다. 난이도 세 단계와 영웅 승급 네 단계가 있고, 진행은 자동 저장된다.',
    description_en = 'One archer is left in a city the dead took. Anything in range gets shot automatically, and every kill drops scrap. Scrap only becomes supply while you stand inside the camp, and supply buys arrow power without a ceiling — the camp screen always shows which upgrade level one-shots which zombie. The map is 600x600 across 29 districts, and packs of zombies hold position in them: walk close and the whole pack wakes at once. Hilltop garrisons have to be broken through by ramp, and supply caches vanish once emptied, so you end up opening the next district. Hire workers and they harvest on their own and raise bunkers, but a bunker only shoots once mercenaries are stationed inside. You carry one of five special shots at a time and swap it at camp. Eight relics sit behind vault garrisons that must be cleared. Three difficulties, four hero promotions, and progress saves itself.',
    content_updated_at = NOW(6)
WHERE slug = 'archer-outbreak';
