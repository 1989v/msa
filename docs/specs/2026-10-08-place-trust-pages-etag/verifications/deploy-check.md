# 배포 뒤 확인 (SR-5.5 · SR-4.4) — 2026-10-08

배포: portal-fe·search `ecf54be`(롤아웃 1/1), CSS 후속 `e113e2d`.

## 최신성
- 상세 SSR 본문에 `href="https://1989v.com/data-sources"` 1건 — 새 렌더러.
- `/data-sources` 응답에 `<!--seo:prerendered-->` 와 `GeoNames` 행 — 새 프리렌더.

## 초기 HTML·페이지
| 항목 | 결과 |
|---|---|
| 상세 SSR 바닥글 | privacy·about·contact·data-sources 각 1건 |
| `/data-sources` | 200, 표 30행, 4조합(기기×사이트 테마) 테마 전환 정상, 바닥글 신뢰 링크 4 |
| 모바일 390 | 처음 측정에서 문서 폭 469 로 넘침 — 방침 페이지도 운영에서 463 으로 같은 증상(공용 `.privacy-inner` 가 세로 flex 안 auto 여백으로 표 최소 폭에 맞춰짐). `width: 100%` 로 수정(e113e2d), 수정 전 운영 페이지에 CSS 주입으로 390 확인. 배포 뒤 재측정은 아래 |

## ETag / 304 (SR-4.4, Q1)
| 경로 | 요청 | 결과 |
|---|---|---|
| search 직결 `:8083/internal/render/attractions/1` | `If-None-Match: "d69ef7d660f8c35b"` | 304 |
| portal-fe nginx (Host place) 비압축 | 같은 강한 값 | 304 (응답 ETag 강한 값) |
| portal-fe nginx gzip | `If-None-Match: W/"d69ef7d660f8c35b"` | 304 (응답 ETag `W/`, `Content-Encoding: gzip`) |
| portal-fe nginx | 다른 값 | 200 |
| 공개 `https://place.1989v.com/attractions/1` 비압축·압축 | — | 200, **ETag 헤더 없음**, `cf-cache-status: DYNAMIC` |

판정: origin 304 확인으로 S2-8 완료. 공개 주소에서는 Cloudflare 를 지나며 ETag 가 사라진다 — HTML 을 바꾸는 Cloudflare 기능(이메일 주소 난독화 등)이 켜져 있으면 ETag 를 지운다. 설정 확인은 사용자 몫이고, 크롤 통계 304 비율은 배포 후 관찰 항목.

측정 메모: 처음 origin 측정에서 200 이 나온 것은 셸이 ETag 의 따옴표를 떼어 보낸 측정 실수였다. 따옴표를 그대로 보내 다시 쟀다.

## 모바일 재측정 (portal-fe `e113e2d` 롤아웃 1/1 뒤, 390×844 모바일 에뮬레이션)
| 페이지 | `.privacy-inner` 계산 폭 | 문서 폭 / 뷰포트 |
|---|---|---|
| `/data-sources` | 342px | 390 / 390 |
| `/privacy` | 342px | 390 / 390 (표 안 링크 하나가 화면 밖이지만 표 스크롤 영역 안) |
| `/about` | 342px | 390 / 390 |
| `/contact` | 342px | 390 / 390 |
