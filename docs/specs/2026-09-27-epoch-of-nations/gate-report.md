# gate-report — PASS

- 시각: 2026-09-29T13:15:11.923Z  seed: 20260915  sourceHash: 951307c44747

| 축 | 판정 | 근거 | 측정 | 문턱 | 비고 |
|---|---|---|---|---|---|
| BOOT | PASS | measured | {"forge":true} | {} |  |
| CONTROLS_KEY | PASS | measured | {"keys":18,"dead":[]} | {"dead":0,"keys":">=1"} |  |
| CONTENT_STAGES | PASS | measured | {"stages":8,"minPairDiff":28.5,"minPair":["E1","E2"],"unreachable":[],"blank":[]} | {"stages":">=8","minPairDiff":">=10"} |  |
| CONTENT_ENEMIES | PASS | measured | {"enemyTypes":42,"cannotSpawn":[]} | {"enemyTypes":">=30"} |  |
| CONTENT_BOSS | PASS | measured+self-reported(phases) | {"bosses":2,"absent":[],"phases":[2,2]} | {"bosses":">=2","phases":">=2"} |  |
| CONTENT_SKILLS | PASS | self-reported | {"skills":84,"items":109,"secrets":6} | {"skills":">=80"} |  |
| HIT | PASS | measured | {"key":"KeyX","enemy":"barb_warrior","hpBefore":100,"hpAfter":76} | {"hpAfter":"< hpBefore (type 합)"} |  |
| DIFF_IDLE | PASS | measured | {"firstHitSec":null,"deadSec":null} | {"firstHitSec":"<=0","deadSec":"<=0"} |  |
| DIFF_MASH | PASS | measured | {"simSec":90,"deaths":0,"cleared":false,"clearedAtSec":null} | {"cleared":false} |  |
| FPS_DESKTOP | PASS | measured | {"frames":360,"avgFps":59.3,"low1Fps":59.5,"maxFrameMs":50} | {"avgFps":">=55","low1Fps":">=30"} | 헤드리스 소프트웨어 렌더 기준 — 실기기는 더 빠르다 |
| AUDIO | PASS | measured(starts)+self-reported(lists) | {"soundStartsIn6s":37,"sfxDeclared":38,"musicDeclared":6,"audioContexts":1} | {"soundStartsIn6s":">0","sfx":">=20","music":">=4"} |  |
| FEEL | PASS | self-reported | {"hitstopMs":80,"shakePx":6,"telegraphMs":450} | {"hitstopMs":">=40","shakePx":">=2","telegraphMs":">=200"} | 자기 보고 — hit-*.png 로 사람이 확인 |
| MOBILE_PORTRAIT | PASS | measured | {"viewport":"390x844","playerCssPx":46,"canvasCss":"390x844","overflow":{"sw":390,"sh":844,"iw":390,"ih":844},"touchZones":12,"hasMove":true,"offscreen":[]} | {"playerCssPx":">=40","overflow":"none","touch":"stick|dpad + buttons>=1, 화면 안"} |  |
| MOBILE_TOUCH | PASS | measured | {"zones":["end_turn","fortify","attack","found_city","skip","next_unit","move_ne","move_e","move_se","move_sw","move_w","move_nw"],"dead":[]} | {"dead":0} |  |
| MOBILE_LANDSCAPE | PASS | measured | {"viewport":"844x390","playerCssPx":46,"canvasCss":"844x390","overflow":{"sw":844,"sh":390,"iw":844,"ih":390},"touchZones":12,"hasMove":true,"offscreen":[]} | {"playerCssPx":">=40","overflow":"none","touch":"stick|dpad + buttons>=1, 화면 안"} |  |
| MOBILE_FPS | PASS | measured | {"frames":193,"avgFps":38.8,"low1Fps":29.9,"maxFrameMs":33.5,"dpr":2} | {"avgFps":">=30"} | 헤드리스 소프트웨어 렌더 · DPR 2 기준 |
| CONSOLE | PASS | measured | {"errors":0,"first":[]} | {"errors":"<=0"} |  |

## 스크린샷 (전부 눈으로 보고 verifications/visual-review.md 에 한 줄씩)
- boot-desktop.png
- stage-E1.png
- stage-E2.png
- stage-E3.png
- stage-E4.png
- stage-E5.png
- stage-E6.png
- stage-E7.png
- stage-E8.png
- enemy-barb_warrior.png
- enemy-barb_archer.png
- enemy-barb_raider.png
- enemy-warrior.png
- enemy-slinger.png
- enemy-chariot.png
- enemy-ram.png
- enemy-galley.png
- enemy-archer.png
- enemy-swordsman.png
- enemy-horseman.png
- enemy-catapult.png
- enemy-trireme.png
- enemy-pikeman.png
- enemy-crossbow.png
- enemy-knight.png
- enemy-trebuchet.png
- enemy-caravel.png
- enemy-musketman.png
- enemy-fieldgun.png
- enemy-cuirassier.png
- enemy-cannon.png
- enemy-frigate.png
- enemy-lineinf.png
- enemy-gatling.png
- enemy-cavalry.png
- enemy-howitzer.png
- enemy-ironclad.png
- enemy-rifleman.png
- enemy-machinegun.png
- enemy-tank.png
- enemy-spg.png
- enemy-battleship.png
- enemy-mechinf.png
- enemy-rocketart.png
- enemy-moderntank.png
- enemy-missile.png
- enemy-submarine.png
- enemy-exo.png
- enemy-laser.png
- enemy-hovertank.png
- enemy-orbital.png
- boss-warlord.png
- boss-capital_siege.png
- hit-0.png
- hit-1.png
- hit-2.png
- idle-end.png
- mash-end.png
- play-desktop.png
- mobile-portrait.png
- mobile-landscape.png
- play-mobile-landscape.png
