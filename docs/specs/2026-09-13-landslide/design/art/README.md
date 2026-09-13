# 사태 — 아트 (클로드 디자인 산출물, 1~3차)

출처: 디자인 시스템 프로젝트 `사태 — 아트 시안` (`826d355a-fc16-42a7-b3a9-76301e8e0d28`) — 2026-09-13 1차(병과 5) · 2차(시대 스킨 4) · 3차(세계·HUD).
이 폴더는 **받은 그대로**다. 고치려면 클로드 디자인에서 고쳐 다시 받는다 — 여기서 손대지 않는다.

| 파일 | 무엇 |
|---|---|
| `artboards/characters.js` | **캐릭터 도형 라이브러리 v2** `window.Sata` — `render(unit, {h, team, expr, skin})` 가 SVG 문자열을 낸다. 병과 `archer·gunner·sword·spear·shield`, 팀 `red·blue`, 표정 `idle·hit·buried·win`, **스킨 `joseon(기본)·goguryeo·silla·goryeo`**(투구·갑옷만 갈아 끼움). 상자 200×300, viewBox `-80 -170 320 480`. 게임은 이걸 그대로 쓴다 |
| `artboards/characters.v1.js` | 1차 원본(스킨 없음). v2 가 기본 외형도 바꿨기에 대조용으로 남긴다 — 아래 「2차에서 바뀐 것」 |
| `artboards/05-era-skins.html` | 궁수 × 스킨 4 · 300px + 36px 줄 |
| `artboards/world.js` | **세계 도형 라이브러리** `Sata.World` — `scene(biome)` 가 1280×720 SVG 를, `groundY(biome, x)` 가 지표면 y 를 낸다. 바이옴 `volcano·dune·snow`, `airflow`(유선)·`liquid`(용암·물 물결)·`pine`·`cloud`·`rockChunk`. 재질 색은 `C` 에 hex 고정 |
| `artboards/hud.css` | **HUD 토큰** — `.pan .lbl .num .btn(.go) .bar .seats .seat .chip(.on) .pips`. 판 `#1D1D1F` 92% · 먹선 3px · 모서리 8px · 44px |
| `artboards/06-battle-screen.html` | **전투 화면** 1280×720 화산 4v4 — 산사태·절단선·터널·매몰·상승 기류·방패 `?`·뭉친 기·궤적 1/3·HUD 전부. 유닛은 `Sata.render()` 36px |
| `artboards/07-biomes.html` | 화산·사구·설원 370×260 + 재질 스와치 11 |
| `artboards/08-phone.html` | 폰 가로 844×390 — HUD 전부, 44px |
| `artboards/09-hud-parts.html` | 조준 드래그 · 방패 각도(내/상대) · 던지기 · 무기 바텀시트 · 결과 순위 · 로비 · 토큰 요약 |
| `artboards/01-character-sheet.html` | 병과 5 · 300px · 조선 갑사 · 홍팀 |
| `artboards/02-team-colors.html` | 궁수 홍/청 — 깃발·허리띠만 다르다 |
| `artboards/03-scale-check.html` | **축소 검증** 36px·72px × 화산재·한지 |
| `artboards/04-expressions.html` | 궁수 대기·피격·매몰·승리 |
| `screenshots/01.jpg` | 클로드 디자인이 남긴 01 캡처 |
| `screenshots/03-scale-check.jpg` · `03-scale-36px-x3.png` | 03 을 헤드리스 크롬으로 직접 렌더한 것(v1) + 36px 화산재 줄 3배 크롭 |
| `screenshots/01-v2.jpg` · `03-scale-check-v2.jpg` · `05-era-skins.jpg` · `05-skins-36px-x3.png` | v2 렌더 — 기본 시트·축소 검증·스킨 4·스킨 36px 3배 크롭 |
| `screenshots/06-battle-screen.jpg` · `07-biomes.jpg` · `08-phone.jpg` · `09-hud-parts.jpg` | 3차 렌더(헤드리스 크롬) |

## 검증 (2026-09-13)

- **36px 실루엣**: 궁수(활 C 곡선) · 포수(무릎 높이 굵은 사선) · 검사(머리 위 사선) · 창병(수직선) · 방패병(원) — 다섯이 갈린다. 팀은 등깃발·허리띠 색면으로 읽힌다. `screenshots/03-scale-36px-x3.png`.
- **IP 금지표(브리프 §5)**: 동물·벌레형 소대 없음 · 전차형 유닛 없음 · 사람 무장(전립+두정갑) · 이모지/광택/그림자 없음 — 통과.
- 팔레트: hex 가 브리프 §3 그대로(`characters.js` 의 `C`).

## 2차 검증 (2026-09-13)

- **스킨 36px**: 넷 모두 활 C 곡선으로 궁수로 읽히고, 머리 윤곽으로 서로 갈린다 — 고구려 높은 봉우리+깃 · 신라 깃 둘 · 고려 반구+상모 · 조선 넓은 갓 챙. 창병·방패병에 씌워도 병과가 유지된다. `screenshots/05-skins-36px-x3.png`.
- **2차에서 요청 없이 바뀐 것** ("무기·포즈·깃발·표정은 건드리지 마"를 넘어섰다): ① 궁수 머리 전립 → **갓(흑립)** ② 검사 머리 전립 → **투구(드림 달린)** ③ 방패병 원방패 → **장방패(네모)** ④ 포수·창병·방패병 전립에 공작 깃. 36px 판정은 여전히 통과한다(네모 방패도 한 덩어리로 읽힌다). **채택(2026-09-13)** — 장방패는 사용자가 클로드 디자인에서 직접 고친 것. 브리프 §4·03 캡션을 맞췄다. v2 가 확정본.

## 3차 검증 (2026-09-13)

- 네 장 모두 JS 오류 0, `.btn/.chip/.wrow` 중 44px 미만 0. 06 에 유닛 8 이 `characters.js` 로 서고 발이 `groundY` 에 닿는다.
- 결: 굵은 먹선·평면 색·둥근 지형·파스텔 하늘 — 캐릭터와 같은 결이고 밝다. 재질 hex 는 브리프 §8.1 그대로(`world.js` 의 `C`).
- **목업이 PRD 와 다른 곳(코드는 PRD 를 따른다)**: 무기 이름·비용이 창작(「일반 사격 기 0 · 불화살 4 · 편전 삼연 8 · 사태 유발 14」) — PRD 는 편전 1 · 불화살 2 · 신기전 3, 에너지 상한 6. 체력 `72/90` — PRD 는 100. 09 던지기 컷의 주체가 검사 — PRD 는 방패병. 06 에서 매몰 창병(x 832)과 방패병(x 838)이 겹쳐 있다.
- `characters.js` 는 2차 사본이다 — 3차에서 바뀌었는지 대조하지 않았다. 슬라이스 착수 전에 프로젝트 파일과 한 번 대조한다.

## 남은 것

- 원화는 이것으로 끝. 다음은 클린룸 슬라이스(궁수 노템전 1v1 vs 봇) — `characters.js` · `world.js` · `hud.css` 를 그대로 가져간다.
