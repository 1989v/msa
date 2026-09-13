# 사태 — 캐릭터 아트 (클로드 디자인 산출물, 1차)

출처: 디자인 시스템 프로젝트 `사태 — 아트 시안` (`826d355a-fc16-42a7-b3a9-76301e8e0d28`) — 2026-09-13 1차.
이 폴더는 **받은 그대로**다. 고치려면 클로드 디자인에서 고쳐 다시 받는다 — 여기서 손대지 않는다.

| 파일 | 무엇 |
|---|---|
| `artboards/characters.js` | **캐릭터 도형 라이브러리** `window.Sata` — `render(unit, {h, team, expr})` 가 SVG 문자열을 낸다. 병과 `archer·gunner·sword·spear·shield`, 팀 `red·blue`, 표정 `idle·hit·buried·win`. 상자 200×300, viewBox `-80 -170 320 480`. 게임은 이걸 그대로 쓴다 |
| `artboards/01-character-sheet.html` | 병과 5 · 300px · 조선 갑사 · 홍팀 |
| `artboards/02-team-colors.html` | 궁수 홍/청 — 깃발·허리띠만 다르다 |
| `artboards/03-scale-check.html` | **축소 검증** 36px·72px × 화산재·한지 |
| `artboards/04-expressions.html` | 궁수 대기·피격·매몰·승리 |
| `screenshots/01.jpg` | 클로드 디자인이 남긴 01 캡처 |
| `screenshots/03-scale-check.jpg` · `03-scale-36px-x3.png` | 03 을 헤드리스 크롬으로 직접 렌더한 것 + 36px 화산재 줄 3배 크롭 |

## 검증 (2026-09-13)

- **36px 실루엣**: 궁수(활 C 곡선) · 포수(무릎 높이 굵은 사선) · 검사(머리 위 사선) · 창병(수직선) · 방패병(원) — 다섯이 갈린다. 팀은 등깃발·허리띠 색면으로 읽힌다. `screenshots/03-scale-36px-x3.png`.
- **IP 금지표(브리프 §5)**: 동물·벌레형 소대 없음 · 전차형 유닛 없음 · 사람 무장(전립+두정갑) · 이모지/광택/그림자 없음 — 통과.
- 팔레트: hex 가 브리프 §3 그대로(`characters.js` 의 `C`).

## 남은 것

- 2차: 시대 스킨 4 (`artboards/05-era-skins.html`).
- 배경·HUD 를 같은 결(귀엽고 밝게)로 — 브리프 §8 의 수묵담채 reference 교체.
