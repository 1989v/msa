# 스펙 G1(place-longtail-landings) TG6 6.3 — nginx 계약 수동 실행(SR-5.2)

- 실행: 2026-10-09 05:49 KST. 임시 사본 `scratchpad/wt-inject-g1`(detached `c7c6f8c0cc30674a5d3c3370c1114236f0837234`)을 주입 없이 썼다. `git status --porcelain` 은 비어 있었다.
- 이미지 `nginx:1.27-alpine`(`sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10`), 도커 있음. exit 2(도커 없음)가 아니다.
- 결과: `check-nginx-place-landings.sh` **exit 0 · PASSED**(25 ok / 0 FAIL), `check-nginx-legacy-regions.sh` **exit 0 · PASSED**(24 ok / 0 FAIL).
- 계약이 실제로 물리는지는 회귀 주입으로 확인했다(`g1-regression-injection.md` 10·11·12번). 랜딩 location 을 지우면 ①·② 가 빨강이다. 랜딩 location 을 옛 301 앞으로 옮기거나 301 정규식의 꼬리를 지우면 ④ 가 404 로 빨강이다.

## `bash portal-fe/scripts/check-nginx-place-landings.sh` (exit 0)

```text
nginx place 속성 랜딩·편집 페이지 계약 — nginx.conf
① 목록에 있는 랜딩
  ok   /regions/11110/parking 200
  ok   /regions/11110/parking 은 프리렌더 파일
  ok   /regions/11110/parking Cache-Control
  ok   /en/regions/11110/parking 200
  ok   /en/regions/11110/parking 은 프리렌더 파일
② 파일 없는 조합은 404
  ok   /regions/11110/foo 404
  ok   /regions/11110/foo 은 SPA 셸이 아니다
  ok   /en/regions/11110/pet 404
  ok   /en/regions/11110/pet 은 SPA 셸이 아니다
  ok   /regions/99999/parking 404
  ok   /regions/99999/parking 은 SPA 셸이 아니다
③ 지역 페이지는 그대로
  ok   /regions/11110 200
  ok   /regions/11110 은 프리렌더 파일
  ok   /regions/29110 → 301
  ok   /regions/29110 → Location
④ 옛 코드 랜딩은 시도 허브로
  ok   /regions/29110/parking → 301
  ok   /regions/29110/parking → Location
  ok   /en/regions/46230/free → 301
  ok   /en/regions/46230/free → Location
⑤ 편집 페이지
  ok   /guides/x 200
  ok   /guides/x 은 프리렌더 파일
  ok   /guides/none 404
  ok   /guides/none 은 SPA 셸이 아니다
  ok   /guides 404
  ok   /guides 은 SPA 셸이 아니다
PASSED
```

## `bash portal-fe/scripts/check-nginx-legacy-regions.sh` (exit 0)

```text
nginx 옛 광주·전남 지역 주소 계약 — nginx.conf
① 시도
  ok   /regions/29 → 301
  ok   /regions/29 → Location
  ok   /regions/46 → 301
  ok   /regions/46 → Location
② 시군구는 시도 허브로
  ok   /regions/29110 → 301
  ok   /regions/29110 → Location
  ok   /regions/46230 → 301
  ok   /regions/46230 → Location
③ 영문
  ok   /en/regions/29 → 301
  ok   /en/regions/29 → Location
  ok   /en/regions/46890 → 301
  ok   /en/regions/46890 → Location
대조: 통합시와 다른 지역은 리다이렉트하지 않는다
  ok   /regions/12 200
  ok   /regions/12 는 프리렌더 파일
  ok   /regions/12110 200(셸)
  ok   /regions/12110 은 SPA 셸
  ok   /regions/11 200(셸)
  ok   /regions/11 은 SPA 셸
  ok   /en/regions/12330 200(셸)
  ok   /en/regions/12330 은 SPA 셸
  ok   /regions/2911 200(셸)
  ok   /regions/2911 은 SPA 셸
  ok   /regions/290001 200(셸)
  ok   /regions/290001 은 SPA 셸
PASSED
```
