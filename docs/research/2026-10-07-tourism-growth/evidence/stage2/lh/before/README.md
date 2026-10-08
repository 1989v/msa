# Lighthouse before — 2단계 허브 모바일·성능 배포 전 (2026-10-09 00:36~00:46 KST)

운영 3페이지 × 5회, 순차 실행(`scratchpad/lh-stage2.sh before`). 값은 5회 중앙값이다. 회차 기록은 `batch.log`.

| 페이지 | 회 | 성능 점수 | FCP ms | LCP ms | TBT ms | CLS | SI ms |
|---|---|---|---|---|---|---|---|
| hub | 5 | 56 | 5113 | 14934 | 7 | 0.047 | 12485 |
|  | 회별 점수 | 56 · 33 · 52 · 56 · 56 | LCP 14934 · 14901 · 14381 · 14980 · 22341 | | CLS 0.047 · 0.736 · 0.122 · 0.047 · 0.000 | |
| detail | 5 | 55 | 8232 | 12618 | 4 | 0.000 | 15424 |
|  | 회별 점수 | 45 · 55 · 55 · 55 · 55 | LCP 8878 · 9932 · 12713 · 12839 · 12618 | | CLS 0.220 · 0.000 · 0.000 · 0.000 · 0.000 | |
| region | 5 | 56 | 7675 | 18313 | 2 | 0.000 | 9099 |
|  | 회별 점수 | 46 · 56 · 56 · 76 · 56 | LCP 8555 · 19021 · 18313 · 3442 · 19483 | | CLS 0.344 · 0.000 · 0.000 · 0.168 · 0.000 | |

URL: https://place.1989v.com/, https://place.1989v.com/attractions/1, https://place.1989v.com/regions/11
form factor: mobile · throttling: simulate · Lighthouse 13.5.0

hub run1 layout-shifts 노드:
- body > div#root > div.place-page > div.place-body 0.0474
- div.place-toolbar > div.place-attr-group > div.place-attr-chips > button.place-chip 0.0014
- div > div > div > div 0.0006
- div > div > div > div 0.0006
- div > div > div > div 0.0006

- 원시 JSON 15개(9.9MB)는 레포에 두지 않는다 — 1단계와 같은 방식으로 세션 스크래치패드 `lh-raw/stage2/before/` 에 보관했다.
- 허브 1~4회는 회당 57~60초 걸렸다(5회째 17초). 지도 타일 요청이 끝나기를 기다린 것으로 보이며 점수에는 반영되지 않는다.
- CLS 는 회마다 0~0.736 으로 흔들린다. 허브 1회째 가장 큰 이동 노드는 `.place-body`(0.047)다.
