# 배포 뒤 확인 — 짝 스위치 꺼짐 · RSS · IndexNow (SR-5.4 「배포 직후」)

- 배포: 커밋 `0d7377f93`, 이미지 `0d7377f`(content(place)·search·search-batch·portal-fe·place-ingest), 2026-10-09 12:31 KST 롤아웃. 수동 재색인 `attraction-reindex-manual-1009` 12:31:55~12:36:46 KST
- 방법: curl·python 만(브라우저 없음), GET 만. 클러스터는 `ssh msa-oci 'sudo k3s kubectl -n commerce …'` 읽기만
- 측정 대상 최신 여부: place 번들 `index-Cm9QxGrC.js`, portal-fe 파드 `portal-fe:0d7377f`(기동 03:23:19Z), `/feed.xml` 200(이번에 넣은 경로), content 파드 Flyway `place_db` v34 「attraction content hash」 적용(03:28:58Z) → 유효
- 측정 시각: 2026-10-09 12:38 ~ 12:44 KST

## 판정 요약

| 항목 | 결과 | 판정 |
|---|---|---|
| 재색인 로그 `Alternate pairs: N (… enabled=false)` N ≥ 1 | `Alternate pairs: 1997 (edges 2013, dropped by uniqueness 16, dropped by overview 0, enabled=false)` | 통과 |
| 운영 응답 `alternateId` 전부 null | 표본 20(국 15 · 영 5, 오라클 짝·반례 포함) 모두 키 있음·null | 통과 |
| 상세 SSR hreflang 0줄 | 표본 8(국 6 · 영 2, 짝 후보 2180·14206 포함) 모두 0 | 통과 |
| sitemap 상세 hreflang 0줄 | places-1~4·events 63,531 상세 URL 중 hreflang 0 | 통과 |
| `/feed.xml`·`/en/feed.xml` 200 · RSS 2.0 파싱 | 둘 다 200, `rss version="2.0"`, `language` ko·en, XML 파서 통과 | 통과 |
| item ≤ 50 | **0건**(국·영 모두) | 조건부 — 항목이 없어 상한·정렬을 재지 못함 |
| contentUpdatedAt 내림차순 | 항목 0 → 판정 불가 | **재확인 대기** |
| Cache-Control 한 벌 | `cache-control: public, max-age=600` 1줄 | 통과 |
| apex·blog `/feed.xml` 404 | `1989v.com/feed.xml`·`blog.1989v.com/feed.xml`·`1989v.com/en/feed.xml` 404(nginx 기본) | 통과 |
| Secret 없음 → 키 파일 없음 | Secret `place-indexnow` NotFound. `/{임의32hex}.txt`·`/.txt` → 200 SPA 셸(text/html 5058B), 32hex 본문 아님 | 통과 |
| portal-fe 기동 경고 한 줄(키 미노출) | `15-indexnow-key.sh: INDEXNOW_KEY 없음 — 키 파일 없이 기동`, `/etc/nginx/conf.d/indexnow/` 빈 디렉터리 | 통과 |
| CronJob `place-ingest-indexnow` · `INDEXNOW_ENABLED` false | 존재(`30 22 * * *`, 이미지 `place-ingest:0d7377f`), env `INDEXNOW_ENABLED=false`, `INDEXNOW_KEY` secretKeyRef optional | 통과 |
| place 응답 `contentUpdatedAt` 필드 | place API·search API 모두 키 있음. **값은 표본 전부 null** | 필드 통과 · 값은 재확인 대기 |

## 피드가 비어 있는 이유 (추정)

- place 응답·색인의 `contentUpdatedAt` 이 표본 30곳 전부 null 이다. RSS 는 `contentUpdatedAt` 있는 문서만 싣기 때문에(SR-3.2) 항목 0 은 이 값의 결과다.
- `content_updated_at` 은 목록 동기화가 해시를 계산할 때 채운다(SR-2.3 표: 첫 채움 = `source_modified_at`). V34 는 12:28 KST 에 적용됐고, `place-ingest-tour-sync` 의 마지막 실행은 2026-10-08 18:10Z(= 10-09 03:10 KST)로 **배포 전**이다. 그래서 아직 채운 행이 없다.
- 다음 순서: tour-sync 2026-10-10 03:10 KST → 정기 재색인 06:30 KST → IndexNow 잡 07:30 KST. 이 뒤에 아래 「재확인 대기」를 잰다.
- 이 추정은 DB 를 직접 세지 않았다(읽기 SELECT 도 이번 범위 밖으로 두었다). place 단건 응답 `77` 에서 `sourceModifiedAt` 은 `2025-12-02T16:24:16`, `contentUpdatedAt` 은 null 이다.

## 재확인 대기 (2026-10-10 07:30 KST 이후)

1. `/feed.xml`·`/en/feed.xml` item 1 ~ 50, `pubDate` 내림차순(같으면 id 오름차순), `lastBuildDate` = 첫 항목 시각, link·guid = 상세 canonical
2. place·search 응답 `contentUpdatedAt` 이 채워진 행이 있는지
3. `place-ingest-indexnow` 로그 `IndexNow 비활성 — 보낼 주소 N건`(N 은 0 일 수 있음)

## 명령과 결과 줄

```bash
ssh msa-oci 'sudo k3s kubectl -n commerce logs job/attraction-reindex-manual-1009 | grep -i -E "pair|parser"'
```

```text
2026-10-09T03:32:30.840Z  INFO 1 --- [search-batch] [main] c.k.s.i.job.AttractionApiReindexTasklet  : Alternate pairs: 1997 (edges 2013, dropped by uniqueness 16, dropped by overview 0, enabled=false)
2026-10-09T03:36:43.430Z  INFO 1 --- [search-batch] [main] c.k.s.i.job.AttractionApiReindexTasklet  : Attraction reindex complete: 67435 docs, 0 errors, … attribute parser v3, index pass 252577ms
```

```bash
for id in 2180 5337 14206 7935 13515 5318 1676 160 2477 1000 3000 5000 20000 30000 40000 50000 61000 66000 77 12933; do
  curl -s -m 20 https://place.1989v.com/api/search/attractions/$id \
  | jq -c --arg id $id '{id:$id, lang:.data.lang, alt:.data.alternateId, has:(.data|has("alternateId"))}'; done
```

```text
2026-10-09 12:42:03 KST
{"id":"2180","lang":"en","alt":null,"has":true}
{"id":"5337","lang":"ko","alt":null,"has":true}
{"id":"14206","lang":"en","alt":null,"has":true}
{"id":"7935","lang":"ko","alt":null,"has":true}
{"id":"13515","lang":"en","alt":null,"has":true}
{"id":"5318","lang":"ko","alt":null,"has":true}
{"id":"1676","lang":"en","alt":null,"has":true}
{"id":"160","lang":"ko","alt":null,"has":true}
{"id":"2477","lang":"ko","alt":null,"has":true}
{"id":"1000","lang":"ko","alt":null,"has":true}
{"id":"3000","lang":"ko","alt":null,"has":true}
{"id":"5000","lang":"ko","alt":null,"has":true}
{"id":"20000","lang":"ko","alt":null,"has":true}
{"id":"30000","lang":"ko","alt":null,"has":true}
{"id":"40000","lang":"en","alt":null,"has":true}
{"id":"50000","lang":"ko","alt":null,"has":true}
{"id":"61000","lang":"ko","alt":null,"has":true}
{"id":"66000","lang":"ko","alt":null,"has":true}
{"id":"77","lang":"ko","alt":null,"has":true}
{"id":"12933","lang":"ko","alt":null,"has":true}
```

(처음 고른 60000 은 404 라 61000 으로 바꿨다.)

```bash
for id in 77 12933 4811 16151 7861 2961 2180 14206; do curl -s -o ssr/$id.html https://place.1989v.com/attractions/$id; done
# <link rel="alternate" … hreflang> 수, 'hreflang=' 문자열 수, application/rss+xml 링크 유무
```

```text
2026-10-09 12:41:35 KST — 8곳 모두: hreflang links 0 any hreflang 0 | rss link True
```

```bash
for n in hub 1 2 3 4 events; do curl -s https://place.1989v.com/sitemap-places-$n.xml -o sm/$n.xml; done
# 파일별 <url> 수, hreflang= 수, /attractions/ 를 loc 으로 갖고 hreflang 이 있는 <url> 수
```

```text
hub    urls=541   hreflang=1542 attractions=0     hreflangInAttrUrl=0   (허브·지역 hreflang — 이번 범위 밖, 기존)
1      urls=20000 hreflang=0    attractions=20000 hreflangInAttrUrl=0
2      urls=20000 hreflang=0    attractions=20000 hreflangInAttrUrl=0
3      urls=20000 hreflang=0    attractions=20000 hreflangInAttrUrl=0
4      urls=2984  hreflang=0    attractions=2984  hreflangInAttrUrl=0
events urls=547   hreflang=0    attractions=547   hreflangInAttrUrl=0
```

```bash
for u in https://place.1989v.com/feed.xml https://place.1989v.com/en/feed.xml https://1989v.com/feed.xml \
         https://blog.1989v.com/feed.xml https://1989v.com/en/feed.xml; do curl -s -D - -o feed_$i.xml "$u" | grep -i -E '^HTTP|cache-control|content-type'; done
python3 -I parse.py feed_1.xml feed_2.xml   # ElementTree 파싱, item 수, pubDate 정렬
curl -s -D - -o /dev/null https://place.1989v.com/feed.xml | grep -ic '^cache-control'
```

```text
2026-10-09 12:40:46 KST
== 1 https://place.1989v.com/feed.xml     HTTP/2 200  content-type: application/rss+xml;charset=UTF-8  cache-control: public, max-age=600
== 2 https://place.1989v.com/en/feed.xml  HTTP/2 200  content-type: application/rss+xml;charset=UTF-8  cache-control: public, max-age=600
== 3 https://1989v.com/feed.xml           HTTP/2 404  content-type: text/html
== 4 https://blog.1989v.com/feed.xml      HTTP/2 404  content-type: text/html
== 5 https://1989v.com/en/feed.xml        HTTP/2 404  content-type: text/html
feed_1.xml rss 2.0 lang ko items 0 lastBuild None desc-sorted True
feed_2.xml rss 2.0 lang en items 0 lastBuild None desc-sorted True
1
```

국문 피드 본문(전체):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>K-관광 — 최근 바뀐 관광지</title>
  <link>https://place.1989v.com/</link>
  <description>한국관광공사 공식 데이터에서 내용이 최근 바뀐 관광지 50곳입니다.</description>
  <language>ko</language>
</channel>
</rss>
```

```bash
k=$(openssl rand -hex 16); for p in /$k.txt /.txt; do curl -s -o kf.txt -D kh.txt "https://place.1989v.com$p"; done
ssh msa-oci 'sudo k3s kubectl -n commerce get secret place-indexnow; P=…portal-fe 파드; logs $P | grep -i indexnow; exec $P -- ls -la /etc/nginx/conf.d/indexnow/'
ssh msa-oci 'sudo k3s kubectl -n commerce get cronjob place-ingest-indexnow -o jsonpath="{…image} {…env}"'
```

```text
2026-10-09 12:43:28 KST
/395819d83d6217ddaaffdfe5365e0f9b.txt 200 ctype=text/html bytes=5058 is32hex=0 spa=1
/.txt 200 ctype=text/html bytes=5058 is32hex=0 spa=1
Error from server (NotFound): secrets "place-indexnow" not found
pod/portal-fe-6687bb794f-9jbnb  2026-10-09T03:23:19Z  portal-fe:0d7377f
6:/docker-entrypoint.sh: Launching /docker-entrypoint.d/15-indexnow-key.sh
7:15-indexnow-key.sh: INDEXNOW_KEY 없음 — 키 파일 없이 기동
12:/docker-entrypoint.sh: Configuration complete; ready for start up
/etc/nginx/conf.d/indexnow/: total 12 (. 와 .. 만)
place-ingest-indexnow   30 22 * * *   (생성 48m 전, 아직 실행 없음)
ap-chuncheon-1.ocir.io/axyooxbyk5yv/place-ingest:0d7377f [{"name":"PLACE_API","value":"http://content:8097"},{"name":"INDEXNOW_ENABLED","value":"false"},{"name":"INDEXNOW_KEY","valueFrom":{"secretKeyRef":{"key":"key","name":"place-indexnow","optional":true}}}]
```

```bash
curl -s https://place.1989v.com/api/places/attractions/77 | jq -c '.data|{id,contentUpdatedAt,sourceModifiedAt:(.sourceModifiedAt//.modifiedAt),hasKey:has("contentUpdatedAt")}'
ssh msa-oci 'logs content 파드 | grep -i "Successfully applied|Migrating schema \`place_db\`"; get cronjob place-ingest-tour-sync …lastScheduleTime'
```

```text
{"id":77,"contentUpdatedAt":null,"sourceModifiedAt":"2025-12-02T16:24:16","hasKey":true}
2026-10-09T03:28:54.596Z … Migrating schema `place_db` to version "34 - attraction content hash"
2026-10-09T03:28:58.759Z … Successfully applied 1 migration to schema `place_db`, now at version v34
place-ingest-tour-sync   10 18 * * *   last 2026-10-08T18:10:00Z
```
