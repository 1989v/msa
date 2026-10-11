# apex 홈 프리렌더 — 함수 추출 전후 비교 (TG3.4)

`renderPortalPages` 의 일반 페이지 조립을 `portalPageHtml` 로 꺼내고 홈에 서울 지역 링크를 더했다.
변경 전·후 스크립트를 각각 스크래치패드 사본으로 두고(`renderPortalPages` 를 사본에서만 export) 같은 셸로 돌려 `prerender/_hosts/1989v.com.html` 을 비교했다.

- 변경 전 3,913 바이트 · 변경 후 3,993 바이트 (차이 80 바이트 = 아래 한 줄)
- 같은 실행에서 함께 나온 다른 포털 페이지 파일은 `cmp` 로 바이트 동일
- 태그 단위로 쪼갠 diff:

```
34a35,37
> <p>
> <a href="https://place.1989v.com/regions/11">서울 가볼 만한 곳</a>
> </p>
```
