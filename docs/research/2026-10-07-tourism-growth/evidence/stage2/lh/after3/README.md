# Lighthouse after3 — 길찾기 place_id · 전환 버튼 수정판 (ac95a67, 2026-10-09 13:55~14:01 KST)

포털 `ac95a67` · search `8cf3177`. 15회 모두 `network-requests` 의 번들이 `index-UuNZOCeH.js`(운영 index.html 과 같음)인 것을 확인했다. 3페이지 × 5회 순차, 15/15 rc=0. 값은 중앙값.

| 페이지 | 회 | 성능 점수 | FCP ms | LCP ms | TBT ms | CLS | SI ms |
|---|---|---|---|---|---|---|---|
| hub | 5 | 59 | 5499 | 12841 | 4 | 0.022 | 7173 |
|  | 회별 점수 | 63 · 57 · 62 · 59 · 58 | LCP 12277 · 12841 · 12445 · 16872 · 16609 | | CLS 0.029 · 0.022 · 0.029 · 0.000 · 0.000 | |
| detail | 5 | 55 | 8297 | 10406 | 12 | 0.000 | 14692 |
|  | 회별 점수 | 55 · 55 · 55 · 55 · 56 | LCP 10406 · 10433 · 26186 · 10316 · 9359 | | CLS 0.000 · 0.000 · 0.000 · 0.000 · 0.000 | |
| region | 5 | 56 | 7901 | 19377 | 8 | 0.000 | 9113 |
|  | 회별 점수 | 56 · 56 · 63 · 56 · 56 | LCP 19377 · 17706 · 8749 · 19821 · 20212 | | CLS 0.000 · 0.000 · 0.013 · 0.000 · 0.000 | |

layout-shifts 상위(15회 합): [('body > div#root > div.place-page > footer.site-footer', 0.067), ('div.place-toolbar > div.place-filter-bar > div.place-filter-row > button.place-chip', 0.014), ('div.place-page > main.place-body > article.place-detail > a.place-btn', 0.013)]

- 상세 5회 모두 CLS 0.000 — after2 에서 5회 중 2회 남던 바닥글 0.22 가 이번에는 나오지 않았다.
- 지역 LCP 는 5회 중 4회가 17.7~20.2초, 1회가 8.7초로 갈린다. after2 는 반대로 1회만 19.4초였다. 관측 LCP(스로틀 없음)는 1.4~2.5초라 시뮬레이션 쪽 갈림이다. 원인은 확인하지 않았고, 판정은 보류한다.
- 원시 JSON 은 `scratchpad/lh-raw/stage2/after3/`.
