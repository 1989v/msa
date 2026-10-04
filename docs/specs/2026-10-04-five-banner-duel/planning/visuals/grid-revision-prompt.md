# 전투 화면 5×5 수정 기록

도구: 내장 `image_gen`. 편집 참조: `02-gameplay.png`. 결과: `02-gameplay-v2.png`.

## 최종 프롬프트

```text
Use case: ui-mockup. Edit target: supplied gameplay proposal for Korean 1v1 tower defense. Create a revised high resolution production-quality screen proposal for "대전 디펜스". Request native 3840x2160 or highest native landscape output supported; fine crisp material detail and thin sharp contours. Do not merely enlarge or interpolate old pixels. Repaint at finer detail with a MUCH more zoomed-out battlefield view. Preserve existing Korean ink outlined illustrated art language, Joseon cloth studded armor, Korean tiled separate fortress gates, stone courtyard, pine surroundings, blue circle player and red diamond opponent, five-slot combo ledger and lower troop purchasing UI.

CRITICAL GEOMETRY: both deployment boards must be EXACTLY FIVE COLUMNS BY FIVE ROWS, 25 square cells per player. Four evenly spaced internal vertical lines and four evenly spaced internal horizontal lines bounded by one rectangular border. Count columns and rows explicitly. Grid is axis-aligned under near-overhead orthographic camera, not diamond isometric. The old image incorrectly looks three by three: replace that entirely. Show all 25 cells on BOTH boards unobstructed, most empty, do not crop rows. Left main battlefield about 58% of available battlefield area and right opponent observation area 42%, both boards fully visible.

CRITICAL SCALE: seven tiny stationary defenders on the left, five on right, one per cell, with at least 18 and 20 empty cells respectively. A HUMAN SOLDIER BODY from helmet to foot should occupy ONLY 45 to 55 percent of ONE CELL HEIGHT, about 40 percent of its width. Even long weapons and flags should not spill across several cells. Siege carts fit comfortably within 70% of one cell width. All moving road attackers equally small, army miniatures rather than large character portraits. Pull camera back, substantial empty floor around soldiers, expansive tactical RTS tower-defense feel like individual custom-map defense. Unit studies in combo/toolbar can remain larger for readability, but all units ON BATTLEFIELD must be substantially smaller than reference. Crisp sprite-like silhouettes at a distance, retain recognizable bows spears bronze cannon hwacha rather than blurry miniature blobs.

Two INDEPENDENT gates at top, each player's road starts at an outer lower corner, passes around its own square deployment board, turns toward its own upper gate and ENDS at the gate, visibly separate from opposing road. Open paths with clear neutral arrows toward gates, not infinite closed loop. No connected common gate or cross-board shooting. Native stone grid lines simple, countable, flat tiles not decorative subdivision.

Screen top compact roof-tile panel: small title "대전 디펜스", left "나 16/20", center "5 스테이지 · 준비 12초", right "상대 12/20". Battlefield uses at least 68% of full image height. Below battlefield one compact five-position formation ledger "대장군 진군", slots exactly "척후", "방패", "중갑", "군악", "돌격": four stamped "완료", fifth current pending. Small general portrait only at ledger right with "완성 시 대장군 출진". Bottom restrained compact controls: "군량 180", "수비 60 · 공격 120", "수비 배치", "공격 편성", troop counters "중갑병 2", "방패병 2", ONE prominent button "출진 확정". Ledger and bottom UI together no more than 25% of canvas. Avoid large portraits eating gameplay space. All Korean text accurate and legible.
Preserve muted ink, roof charcoal, hanji light text, ocher trim, blue and vermilion identity colors derived from reference palette. No neon no gold excess no photorealism no 3D glossy toys no western medieval or samurai armor no watermark. Main requirements: higher native detail, more distant camera and smaller soldiers, EXACTLY 5 by 5 grids. This is a revised concept screen only.
```

## 출력 확인

- 양측 격자는 눈으로 5열×5행(25칸)을 확인했다. 왼쪽 수비 유닛 7, 오른쪽 5, 빈 칸 18/20.
- 전장 캐릭터와 병기 크기가 이전 시안보다 작아졌고, 전체 전장 높이 비중이 커졌다.
- 파일 실측은 1672×940이다. 3840×2160 또는 최대 native 출력을 요청했으나 해당 고해상도로 생성되지 않았다. 기존 1672×941보다 픽셀 해상도가 높아졌다고 주장하지 않는다. CLI/API 폴백이나 보간 확대는 수행하지 않았다.
- 결과의 두 전장 크기는 거의 같다. 약 60/40 내 전장 우선 화면 비율과 길의 성문 연결은 문서 목표로 남는다. UI 안의 준비 단계·공격 효과 혼합, 글자·배치 크기·공정한 실제 전투는 이미지로 검증하지 않는다.
