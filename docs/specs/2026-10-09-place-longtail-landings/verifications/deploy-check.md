# 배포 뒤 확인 — 속성 랜딩 · 편집 페이지 (SR-5.4)

- 배포: 커밋 `0d7377f93`, 이미지 `portal-fe:0d7377f`, 2026-10-09 12:31 KST 롤아웃. 스위치 `PLACE_LANDINGS_INDEXABLE = false`
- 방법: curl·python 만(브라우저 없음), GET 만
- 측정 대상 최신 여부: place.1989v.com 번들 `index-Cm9QxGrC.js`, 운영 portal-fe 파드 이미지 `0d7377f`(기동 03:23:19Z). 랜딩 20곳 모두 `<!--seo:prerendered-->` 가 있음 → 이번 빌드의 프리렌더 → 유효
- 측정 시각: 2026-10-09 12:42:50 ~ 12:43:13 KST

## 판정 요약

| 항목 | 결과 | 판정 |
|---|---|---|
| 목록 20건 200 | 20/20 200(국 15 · 영 5) | 통과 |
| 프리렌더 표식 | 20/20 `seo:prerendered` | 통과 |
| `<meta name="robots" content="noindex, follow"` | 20/20 | 통과 |
| `X-Robots-Tag` 헤더 | 20/20 **없음** | 요청 기준 불충족 · 설계상 정상(아래) |
| sitemap 에 랜딩 0건 | 6개 sitemap 63,531 URL 중 `/regions/{code}/{attr}` 0 | 통과 |
| llms.txt 에 랜딩·`/guides` | 0줄 | 통과 |
| `/regions/29110/parking` 301 | 301 → `https://place.1989v.com/regions/12` | 통과 |
| `/en/regions/46230/free` 301 | 301 → `https://place.1989v.com/en/regions/12` | 통과 |
| `/regions/29110`(기존) 301 | 301 → `/regions/12` | 통과 |
| 목록 밖 조합 404 | `/regions/11110/foo`·`/en/regions/11110/pet`·`/regions/99999/parking`·`/regions/11110/pet`·`/en/regions/11110/free` 모두 404 | 통과 |
| `/guides`(published 0) | `/guides`·`/guides/` 404(nginx 기본 본문) | 통과 |
| 편집 초안 3장 | 200 · `noindex, follow` · 「검수 전 초안」 띠 | 통과 |
| `/guides/none` | 404 | 통과 |
| sitemap 에 `/guides` | 0건 | 통과 |

### X-Robots-Tag 가 없는 이유

랜딩 location 은 `add_header X-Robots-Tag $host_robots_tag always;` 를 단다(SR-1.6). `$host_robots_tag` 맵은 resume·ads 호스트만 값이 있고 `default ""` 다(`portal-fe/nginx.conf:8-12`). nginx 는 값이 빈 헤더를 내지 않는다.
그래서 place 호스트 랜딩의 noindex 는 **메타 태그 하나**가 진다. 스펙대로의 동작이고, 헤더로도 noindex 를 내는 것은 스펙에 없다. 대조: `resume.1989v.com/` 은 `x-robots-tag: noindex, nofollow` 가 나간다.
헤더 noindex 가 필요하다는 판단이면 랜딩 location 에 고정값 헤더를 더하는 별건이다.

## 명령과 결과 줄

```bash
jq -r '.[]|"\(.lang) \(.code) \(.attr) \(.retired//false)"' portal-fe/src/content/place-landings.json | while read lang code attr ret; do
  p=$([ "$lang" = en ] && echo "/en")/regions/$code/$attr
  curl -s -m 20 -D hdr.txt -o land.html "https://place.1989v.com$p"
  echo "$p $(head -1 hdr.txt|awk '{print $2}') xr=[$(grep -i '^x-robots-tag' hdr.txt)] meta=[$(grep -o '<meta name="robots" content="[^"]*"' land.html)] prerendered=$(grep -c 'seo:prerendered' land.html) retired=$ret"
done
```

```text
2026-10-09 12:42:50 KST
/regions/11110/barrier-free 200 xr=[] meta=[<meta name="robots" content="noindex, follow";] prerendered=1 retired=false
/regions/11110/free 200 xr=[] meta=[<meta name="robots" content="noindex, follow";] prerendered=1 retired=false
/regions/11140/barrier-free 200 xr=[] meta=[<meta name="robots" content="noindex, follow";] prerendered=1 retired=false
/regions/11140/free 200 xr=[] meta=[<meta name="robots" content="noindex, follow";] prerendered=1 retired=false
/regions/11170/free 200 xr=[] meta=[<meta name="robots" content="noindex, follow";] prerendered=1 retired=false
/regions/11680/free 200 xr=[] meta=[<meta name="robots" content="noindex, follow";] prerendered=1 retired=false
/regions/27110/free 200 xr=[] meta=[<meta name="robots" content="noindex, follow";] prerendered=1 retired=false
/regions/31710/pet 200 xr=[] meta=[<meta name="robots" content="noindex, follow";] prerendered=1 retired=false
/regions/47130/parking 200 xr=[] meta=[<meta name="robots" content="noindex, follow";] prerendered=1 retired=false
/regions/48310/parking 200 xr=[] meta=[<meta name="robots" content="noindex, follow";] prerendered=1 retired=false
/regions/50110/parking 200 xr=[] meta=[<meta name="robots" content="noindex, follow";] prerendered=1 retired=false
/regions/50110/barrier-free 200 xr=[] meta=[<meta name="robots" content="noindex, follow";] prerendered=1 retired=false
/regions/50130/parking 200 xr=[] meta=[<meta name="robots" content="noindex, follow";] prerendered=1 retired=false
/regions/50130/barrier-free 200 xr=[] meta=[<meta name="robots" content="noindex, follow";] prerendered=1 retired=false
/regions/51150/parking 200 xr=[] meta=[<meta name="robots" content="noindex, follow";] prerendered=1 retired=false
/en/regions/11110/parking 200 xr=[] meta=[<meta name="robots" content="noindex, follow";] prerendered=1 retired=false
/en/regions/47130/parking 200 xr=[] meta=[<meta name="robots" content="noindex, follow";] prerendered=1 retired=false
/en/regions/50110/parking 200 xr=[] meta=[<meta name="robots" content="noindex, follow";] prerendered=1 retired=false
/en/regions/50130/parking 200 xr=[] meta=[<meta name="robots" content="noindex, follow";] prerendered=1 retired=false
/en/regions/51150/parking 200 xr=[] meta=[<meta name="robots" content="noindex, follow";] prerendered=1 retired=false
```

```bash
for p in /regions/29110/parking /en/regions/46230/free /regions/29110 /regions/11110/foo /en/regions/11110/pet \
         /regions/99999/parking /regions/11110/pet /en/regions/11110/free /guides /guides/ /guides/none \
         /guides/seoul-palaces-half-day /guides/seoul-free-indoor /guides/jeju-pet-friendly; do
  curl -s -m 20 -o g.html -D h.txt "https://place.1989v.com$p"   # 상태·Location·robots 메타·「검수 전 초안」·title
done
```

```text
2026-10-09 12:43:13 KST
/regions/29110/parking             301 loc=https://place.1989v.com/regions/12
/en/regions/46230/free             301 loc=https://place.1989v.com/en/regions/12
/regions/29110                     301 loc=https://place.1989v.com/regions/12
/regions/11110/foo                 404 title=404 Not Found
/en/regions/11110/pet              404 title=404 Not Found
/regions/99999/parking             404 title=404 Not Found
/regions/11110/pet                 404 title=404 Not Found
/en/regions/11110/free             404 title=404 Not Found
/guides                            404 title=404 Not Found
/guides/                           404 title=404 Not Found
/guides/none                       404 title=404 Not Found
/guides/seoul-palaces-half-day     200 meta="noindex, follow" draftband=1 title=서울 고궁 반나절 — 경복궁·창덕궁·창경궁·덕수궁·경희궁·운현궁 | K-관광
/guides/seoul-free-indoor          200 meta="noindex, follow" draftband=1 title=서울 무료 실내 관광지 — 종로·중구 박물관과 전시관 6곳 | K-관광
/guides/jeju-pet-friendly          200 meta="noindex, follow" draftband=1 title=제주 반려동물 동반 관광지 6곳 — 숲·폭포·정원·민속마을·해안길 | K-관광
```

```bash
curl -s https://place.1989v.com/sitemap.xml   # 하위 6개: hub · places-1..4 · places-events
for n in hub 1 2 3 4 events; do curl -s https://place.1989v.com/sitemap-places-$n.xml -o sm/$n.xml; done
# <url> 별 <loc> 가 /regions/{code}/{attr} 인 수, /guides 문자열 수
curl -s https://place.1989v.com/llms.txt | grep -c -E '/regions/[0-9]+/[a-z-]+|/guides'
```

```text
hub urls=541    landing 0   /guides 0
1   urls=20000  landing 0
2   urls=20000  landing 0
3   urls=20000  landing 0
4   urls=2984   landing 0
events urls=547 landing 0
llms.txt 0
```
