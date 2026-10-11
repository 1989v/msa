# nginx 계약 — place 랜딩·편집 noindex 헤더 (TG3)

2026-10-11, 실제 `nginx:1.27-alpine` (도커 데몬 있음).

```
$ cd portal-fe && bash scripts/check-nginx-place-landings.sh
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
⑥ 색인 안 하는 랜딩·초안은 헤더로도 noindex
  ok   /regions/11110/parking 200
  ok   /regions/11110/parking 은 프리렌더 파일
  ok   /regions/11110/parking X-Robots-Tag 없음
  ok   /en/regions/11110/parking 200
  ok   /en/regions/11110/parking 은 프리렌더 파일
  ok   /en/regions/11110/parking X-Robots-Tag 없음
  ok   /guides/x 200
  ok   /guides/x 은 프리렌더 파일
  ok   /guides/x X-Robots-Tag 없음
  ok   /regions/11110/free 200
  ok   /regions/11110/free 은 프리렌더 파일
  ok   /regions/11110/free X-Robots-Tag
  ok   /regions/11110/free Cache-Control
  ok   /en/regions/11110/free 200
  ok   /en/regions/11110/free 은 프리렌더 파일
  ok   /en/regions/11110/free X-Robots-Tag
  ok   /en/regions/11110/free Cache-Control
  ok   /guides/draft-x 200
  ok   /guides/draft-x 은 프리렌더 파일
  ok   /guides/draft-x X-Robots-Tag
  ok   /guides/draft-x Cache-Control
  ok   /prerender/_noindex/regions/11110/free.html 직접 경로 404
  ok   _noindex 파일은 직접 경로로 나가지 않는다
  ok   /prerender/_noindex/guides/draft-x.html 직접 경로 404
⑦ 같은 URL — 파일 위치만 바꾸면 헤더가 따라 바뀐다
  ok   /regions/11140/swap 200
  ok   /regions/11140/swap 은 프리렌더 파일
  ok   /regions/11140/swap X-Robots-Tag 없음
  ok   /regions/11140/swap 200
  ok   /regions/11140/swap 은 프리렌더 파일
  ok   /regions/11140/swap X-Robots-Tag
  ok   /regions/11140/swap Cache-Control
  ok   /regions/11140/swap 200
  ok   /regions/11140/swap 은 프리렌더 파일
  ok   /regions/11140/swap X-Robots-Tag 없음
  ok   /regions/11140/swap 404
  ok   /regions/11140/swap 은 SPA 셸이 아니다
⑧ 핵심 sitemap
  ok   /sitemap-places-core.xml 200
PASSED
exit=0
```

같은 nginx.conf 로 기존 계약 스크립트도 돌렸다: `check-nginx-events-sitemap.sh` · `check-nginx-legacy-regions.sh` · `check-nginx-place-feed.sh` · `check-nginx-indexnow.sh` 모두 exit 0 · PASSED.
