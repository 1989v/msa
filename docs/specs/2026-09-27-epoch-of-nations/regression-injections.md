# 회귀 주입 기록 — 2차 라운드 판정 도구

각 도구는 규칙 소스의 **임시 사본**(`/tmp/inj*/src`)에 회귀를 넣고 `--src` 로 그 사본을 돌려 빨간불을 확인했다.
워킹트리의 규칙 코드는 건드리지 않았다.

## tools/audit-effects.mjs

| 주입 | 사본에서 바꾼 줄 | 결과 |
|---|---|---|
| 약탈(raid) 효과 끊기 | `sim.killUnit` 의 `S.civs[by].gold += sim.fx(S, by, 'killGold')` 삭제 | `AUDIT EFFECTS: FAIL` · zeroDiff 1 · failed `["raid"]` (gold 665→665) |
| 신도 교리 도시 산출 끊기 | `sim.cityYields` 에서 `+ sim.cityFx(S, c, PER[k])` 삭제 | `AUDIT EFFECTS: FAIL` · exit 1 · zeroDiff 5 · failed `choral_music, feed_world, work_ethic, jesuit_edu, divine_inspiration` |

원본 소스로 되돌린 실행: `AUDIT EFFECTS: PASS` · 106항목(정부 10 · 정책 64 · 판테온 12 · 창시자 8 · 신도 8 · 강화 4) · zeroDiff 0.

## tools/audit-boosts.mjs

| 주입 | 사본에서 바꾼 줄 | 결과 |
|---|---|---|
| 개량 카운터 끊기 | `doAction improve` 의 `sim.note(S, o, 'imp:' + a.imp)` 삭제 | `AUDIT BOOSTS: FAIL` · exit 1 · notFired 14 (`irrigation, masonry, wheel, celestial, currency, horseback, apprenticeship, mass_production, combustion, plastics, nanotech, feudalism, public_works, environmentalism`) |
| 부스트가 비용을 안 채우게 | `sim.boostMul` 이 늘 1 을 돌려주게 | `AUDIT BOOSTS: FAIL` · exit 1 · notFired 148 (사건은 나도 `techCost`·`civicCost` 가 그대로라 전부 실패) |

원본 소스: `AUDIT BOOSTS: PASS` · 148(기술 84 · 제도 64) · notFired 0 · 대상 자신을 요구하는 조건 0 · 판 차리기 실패 0.

이 도구가 1차의 실제 버그를 잡았다 — `sim.canImprove` 가 육지 칸에서 `!!I.water !== undefined` 로 늘 거짓이라 **농장·광산 등 육지 개량과 어선이 한 번도 지어지지 않았다**(개량 부스트 12개가 카운터 0). 고친 뒤 통과.
전투기는 같은 기술의 폭격기 때문에 "뒤진 유닛" 으로 빠져 생산 목록에 나오지 않았다 — 계열 안에서 기술이 다른 후속만 뒤진 것으로 보게 고쳤다.

## tools/audit-fog.mjs

| 주입 | 사본에서 바꾼 줄 | 결과 |
|---|---|---|
| AI 가 다시 맵 전체를 본다 | `ai.js` 의 `fogOf` 가 `null` 을 돌려주게(아는 칸·보이는 칸 검사가 전부 통과) + 정찰 목표를 예전의 무작위 좌표로 | `AUDIT FOG: FAIL` · exit 1 · 결정 7122 중 밖 1298 (경로 목표 693 · 유닛 목표 569 · 소탕 진영 22 · 전쟁 목표 도시 12 · 교역로 목적지 2) |

원본 소스: `AUDIT FOG: PASS` · 표준 맵 120턴 결정 12400 · 밖 0 / 초대형 맵 100턴(37문명) 결정 14083 · 밖 0.

---

# 회귀 주입 기록 — 3차 라운드 (넓힌 칸)

방식은 2차와 같다: 규칙 소스의 임시 사본(`/tmp/r3/inj-<이름>/src`)에 회귀 한 줄을 넣고 `--src` 로 그 사본을 돌린다. 워킹트리는 건드리지 않았다.

## tools/audit-fog.mjs — 남의 상태 읽기(가린 뷰)

| 주입 | 사본에서 바꾼 줄 | 결과 |
|---|---|---|
| 전쟁 판단이 전체 군사력을 다시 읽게 (FIXES 지정) | `ai.js diplomacy` `sim.estPower(S, civ.id, o.id)` → `sim.power(S, o.id)` | `AUDIT FOG: FAIL` · exit 1 · 가려진 값 224,531 (`남의 유닛(안 보임).t` 151,308 · `.hp` 73,223) · 위치 `sim.power ← diplomacy ← ai.playCiv` |
| 불가사의 경쟁이 남의 생산 목록을 다시 읽게 | `chooseProduction` `sim.wonderRace(...)` → `S.cities.some((x) => x.o !== civ.id && x.item && x.item.id === it.id)` | FAIL · 232,756 (`남의 도시(모름).item` 156,904 · `남의 도시(본 적 있음).item` 75,852) |
| 평화 수락 판단(sim.aiAccepts)이 전체 군사력을 읽게 | `sim.js aiAccepts` `sim.estPower(S, ai, from)` → `sim.power(S, from)` | FAIL · 17,971 (`남의 유닛(안 보임).t` 12,057 · `.hp` 5,914) |
| 러시 담당을 남의 탐험 지도·수도로 고르게 | `knownCapital(S, civ.id, x.id)` → `S.cityMap[x.capital]` + `S.explored[x.id][…]` | FAIL · 15,382 (`남의 문명.capital` 7,691 · `남의 탐험 지도.0~7`) |
| 관찰이 안 보이는 유닛까지 기억하게 | `sim.observe` 의 `vis[...]` 조건 삭제 | FAIL · 관찰 대조 303,072건이 보이지 않는 칸(가려진 값 0 — 기억은 자기 것이라 뷰가 못 잡는 칸을 관찰 대조가 잡는다) |
| AI 가 남의 관계를 직접 고치게(비난) | `doAction denounce` → `r.den = S.turn; o.rel[civ.id].op -= 20` | FAIL · `남의 관계 쓰기.op` 6 |

원본 소스: `AUDIT FOG: PASS` · 표준 120턴 결정 12,437 · 밖 0 · 뷰 호출 4,961 · 평화 수락 판단 518 · 가려진 값 0 · 관찰 5,061회 10,541건 모두 보이는 칸 /
초대형 100턴 결정 17,606 · 밖 0 · 가려진 값 0.

## tools/audit-effects.mjs — 불가사의·건물·지구·유닛 능력·문명 능력·도시국가·자연 경관·위인

| 주입 | 사본에서 바꾼 줄 | 결과 |
|---|---|---|
| 병영류 경험을 다시 15 로 고정 (FIXES 지정) | `completeItem` `for (b in c.blds) u.xp += B.xp` → `if (c.blds.barracks \|\| c.blds.stable \|\| c.blds.armory) u.xp += 15` | `AUDIT EFFECTS: FAIL` · exit 1 · `barracks, stable, armory, academy` (병영: 키를 빼도 15→15, 두 배로 해도 15→15) |
| 병원 회복을 안 읽게 | `healRate` 의 병원 줄 삭제 | FAIL · `hospital` |
| 몽골 기병 +5 를 상수로 | `s += F.cavStr \|\| 0` → `s += F.cavStr ? 5 : 0` | FAIL · `civ:mongol` (두 배 판에서 차이 0) |
| 해군 이동을 +1 상수로 | `mv += F.navmv \|\| 0` → `mv += F.navmv ? 1 : 0` | FAIL · `wonder:wind_lighthouse, civ:norse, civ:britain` |
| 철 성채 경험 효과를 다시 빼게 | `fxTable` 불가사의 병합에서 `xpPct` 제외 | FAIL · `wonder:iron_citadel` |
| 오락 단지 쾌적을 안 읽게 | `amenities` 의 오락 단지 줄 삭제 | FAIL · `district:entertainment` |

고치기 전 소스(2차 결과 `5f0144e` 의 src)에 같은 도구: FAIL · 38항목 — 문명 능력 12 전부 · `wind_lighthouse, iron_citadel, armada_yard, space_elevator` ·
`palace, walls1~3, bunker, barracks, stable, armory, academy, caravanserai, hospital` · `entertainment, spaceport` · `settler, trader, warlord` · 위인 6.

원본 소스: `AUDIT EFFECTS: PASS` · 283항목(정부 10 · 정책 64 · 판테온 12 · 창시자 8 · 신도 8 · 강화 4 · 불가사의 44 · 건물 65 · 지구 12 · 유닛 능력 26 · 문명 12 · 도시국가 6 · 자연 경관 6 · 위인 6) · 효과 키 363 · 판 953 · 차이 0 인 키 0.
