# Lighthouse after2 — CLS 수정판 (9f65c3a, 2026-10-09 12:51~12:58 KST)

번들 `index-CHqeEIQl.js` 확인 후 3페이지 × 5회 순차. 값은 중앙값.

| 페이지 | 회 | 성능 점수 | FCP ms | LCP ms | TBT ms | CLS | SI ms |
|---|---|---|---|---|---|---|---|
| hub | 5 | 58 | 5837 | 16840 | 14 | 0.000 | 7673 |
|  | 회별 점수 | 57 · 58 · 58 · 57 · 62 | LCP 16840 · 17170 · 17222 · 16536 · 12538 | | CLS 0.000 · 0.000 · 0.000 · 0.000 · 0.029 | |
| detail | 5 | 55 | 4880 | 9637 | 28 | 0.000 | 13165 |
|  | 회별 점수 | 55 · 46 · 46 · 67 · 55 | LCP 27043 · 9419 · 9637 · 4528 · 26333 | | CLS 0.000 · 0.220 · 0.220 · 0.000 · 0.000 | |
| region | 5 | 63 | 4836 | 8219 | 12 | 0.055 | 4836 |
|  | 회별 점수 | 55 · 56 · 63 · 63 · 63 | LCP 8082 · 19399 · 8273 · 8219 · 8116 | | CLS 0.179 · 0.000 · 0.013 · 0.055 · 0.055 | |

layout-shifts 상위: [('body > div#root > div.place-page > footer.site-footer', 0.462), ('div.place-page > main.place-body > article.place-detail > a.place-btn', 0.164), ('div#root > div.place-page > main.place-body > section.place-list', 0.138), ('div.place-toolbar > div.place-filter-bar > div.place-filter-row > button.place-chip', 0.007)]

- 원시 JSON 은 `scratchpad/lh-raw/stage2/after2/`.
