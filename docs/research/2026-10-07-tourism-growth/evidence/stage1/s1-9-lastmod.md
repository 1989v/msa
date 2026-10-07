측정 시각(KST): 2026-10-08 04:23:01–04:23:23 | 도구: Python 3.14.6(urllib.request·ElementTree·Counter), git 2.50.1 (Apple Git-155) | 표본: 상세 20,000 URL + 행사 507 URL + 허브 541 URL, 인덱스 1개, 공개 GET 총 4회 | 명령: `git ls-tree -r origin/main --name-only | grep -i sitemap`, `git show origin/main:<path> | nl -ba`, `python3 - <<'PY'`(공개 sitemap GET·XML 집계; 재현 코드 아래)

# S1-9 — sitemap lastmod의 실제 의미

**결론: origin/main의 관광지·행사 sitemap `<lastmod>`는 원천 수정일(TourAPI `modifiedtime` → place `sourceModifiedAt` → search `modifiedAt`)의 날짜이며, 매일 재색인하는 시각이 아니다. 라이브 표본의 날짜 분포도 이 구현과 일치한다.**

## 확인 범위

- 읽은 ref: `origin/main`, SHA `a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24`. 원격 fetch는 하지 않았다.
- 코드는 모두 `git ls-tree`로 찾고 `git show origin/main:<path>`로 읽었다. 아래 줄 번호는 해당 ref 기준이다.
- 공개 사이트맵만 요청했다. 사내 도구·운영 DB·kubectl·ssh·브라우저는 사용하지 않았다.
- 이 문서만 신규 생성했다. 기존 파일·코드·git index·커밋·브랜치는 변경하지 않았다.

## 코드 근거: 원천에서 XML까지

아래 경로는 저장소 루트 기준이다. 줄 번호를 붙여 그대로 재조회할 수 있다.

| 단계 | 파일·줄 | 확인한 동작 |
|---|---|---|
| TourAPI 수집 | `place/ingest/src/sync_tour.py:219–224,282` | `parse_modified`가 `yyyyMMddHHmmss`를 ISO LocalDateTime 문자열로 바꾸며, `sourceModifiedAt = parse_modified(modifiedtime)`을 적재한다. 현재 시각으로 대체하지 않는다. |
| 요청 → 도메인 | `place/feature/src/main/kotlin/com/kgd/place/presentation/attraction/dto/AttractionDtos.kt:70,118` · `place/feature/src/main/kotlin/com/kgd/place/application/attraction/service/AttractionService.kt:25–26,50,96` | 요청의 `sourceModifiedAt`을 명령·Attraction 생성에 그대로 전달해 upsert한다. |
| Attraction 갱신 | `place/domain/src/main/kotlin/com/kgd/place/domain/attraction/model/Attraction.kt:80,210,406` | 생성 시 원천 값을 보관하고 `syncFrom`에서 `sourceModifiedAt = source.sourceModifiedAt`으로 갱신한다. `now()`를 쓰지 않는다. |
| DB 보존 | `place/feature/src/main/kotlin/com/kgd/place/infrastructure/persistence/attraction/adapter/AttractionRepositoryAdapter.kt:40–44` · `place/feature/src/main/kotlin/com/kgd/place/infrastructure/persistence/attraction/entity/AttractionJpaEntity.kt:174,230,286` | 기존 행은 `syncFrom(incoming)`으로 합쳐 저장하고 JPA ↔ 도메인 양쪽에서 원천 값을 보존한다. |
| place API 응답 | `place/feature/src/main/kotlin/com/kgd/place/application/attraction/service/AttractionService.kt:149` · `place/feature/src/main/kotlin/com/kgd/place/presentation/attraction/dto/AttractionDtos.kt:187,241` | 응답 필드 `sourceModifiedAt`에 보존한 값을 실어 보낸다. |
| 재색인 API 읽기 | `search/batch/src/main/kotlin/com/kgd/search/infrastructure/client/PlaceApiClient.kt:73,213` | API `sourceModifiedAt` 문자열을 `LocalDateTime.parse`로 읽는다. |
| 재색인 쓰기 | `search/batch/src/main/kotlin/com/kgd/search/infrastructure/job/AttractionApiReindexTasklet.kt:309` · `search/batch/src/main/kotlin/com/kgd/search/infrastructure/indexing/AttractionIndexDocument.kt:86,235` | `modifiedAt = attraction.sourceModifiedAt` → `modifiedAt = doc.modifiedAt`. 이 경로에서 재색인 시각으로 덮지 않는다. |
| 검색 응답 | `search/app/src/main/kotlin/com/kgd/search/infrastructure/opensearch/AttractionSearchDocument.kt:67,201` · `search/app/src/main/kotlin/com/kgd/search/application/attraction/service/SearchAttractionService.kt:242` · `search/app/src/main/kotlin/com/kgd/search/application/attraction/usecase/SearchAttractionUseCase.kt:102–106` | 색인의 `modifiedAt`을 도메인·공개 검색 응답에 그대로 전달한다. 필드 설명도 원천 최종 수정일이다. |
| 정적 상세 sitemap | `portal-fe/scripts/prerender-seo.mjs:1056,1065–1068,982–996,795–803,617–624` | 공개 검색 응답을 `indexDoc`으로 투영해 `a.modifiedAt`을 보존하고, `lastmod: isoDate(a.modifiedAt)`으로 날짜를 쓴다. 값이 없으면 태그를 생략한다. 빌드일 대체를 피하는 이유도 994–995줄에 명시되어 있다. |
| 동적 행사 sitemap | `search/app/src/main/kotlin/com/kgd/search/infrastructure/opensearch/AttractionSearchAdapter.kt:131–135,398–405` · `search/app/src/main/kotlin/com/kgd/search/infrastructure/render/EventSitemapRenderer.kt:25` | 같은 검색 문서의 `modifiedAt`을 읽어 `toLocalDate()`로 XML에 쓴다. 값이 없으면 생략한다. |

추가 확인:

- `portal-fe/scripts/prerender-seo.mjs:808,823–837`: 상세를 20,000 URL씩 정적 분할하고 인덱스가 허브·분할본·동적 행사 sitemap을 연결한다.
- `portal-fe/nginx.conf:75–87,91–96`: 행사는 search 렌더로 프록시하고, 나머지는 호스트별 정적 파일을 서빙한다.
- `search/app/src/main/kotlin/com/kgd/search/application/attraction/service/EventSitemapService.kt:29–40`: 오늘(KST)은 행사 포함·만료 판정에 쓰이며 `lastmod` 생성값으로 쓰이지 않는다.
- `place/ingest/src/gocamping.py:110,125`: GoCamping 관광지도 해당 원천의 `modifiedtime` 날짜를 `sourceModifiedAt`으로 사용한다. 따라서 모든 문서의 원천이 TourAPI인 것은 아니다.

## 라이브 측정 사실

인덱스 [sitemap.xml](https://place.1989v.com/sitemap.xml)은 HTTP 200이며 아래 6개 자식을 연결했다: `sitemap-places-hub.xml`, `sitemap-places-1.xml`, `sitemap-places-2.xml`, `sitemap-places-3.xml`, `sitemap-places-4.xml`, `sitemap-places-events.xml`.

| 표본 | 측정 시각(KST) | URL 수 | lastmod 있음 / 없음 | 고유 날짜 수 | 최빈 날짜·건수·비율 | 오늘(10/08) | 어제(10/07) |
|---|---|---:|---:|---:|---|---|---|
| [정적 상세 1](https://place.1989v.com/sitemap-places-1.xml) | 04:23:19.689 | 20,000 | 20,000 / 0 | 398 | 2026-06-30 · 3,689 · 18.445% | 0건 / 0% | 0건 / 0% |
| [동적 행사](https://place.1989v.com/sitemap-places-events.xml) | 04:23:22.039 | 507 | 507 / 0 | 79 | 2026-10-02 · 36 · 7.101% | 0건 / 0% | 0건 / 0% |
| [허브·지역](https://place.1989v.com/sitemap-places-hub.xml) | 04:23:01 시작 측정 묶음 | 541 | 0 / 541 | 0 | 없음 | 0건 / 0% | 0건 / 0% |

- 비율 분모는 각 sitemap의 전체 URL 수다. 허브는 `lastmod`가 전부 없어 날짜가 있는 표본 기준 비율은 해당 없음이다.
- 상세 날짜 범위: **2023-01-17–2026-10-02**. 상위 5개: 2026-06-30(3,689), 2026-03-27(1,699), 2026-03-30(1,080), 2026-03-16(645), 2026-03-17(610).
- 행사 날짜 범위: **2025-11-13–2026-10-02**. 상위 5개: 2026-10-02(36), 2026-09-29(35), 2026-09-30(34), 2026-10-01(30), 2026-09-23(25).
- 상세 예시: `/attractions/1` → 2026-05-20, `/attractions/9` → 2025-09-17, `/attractions/17` → 2025-09-02.
- 상세·인덱스·허브 응답의 HTTP `Last-Modified`는 **2026-10-07 21:23:40 KST**였다. 이 헤더는 XML 안의 문서별 `<lastmod>`와 다른 값이다. 행사 응답에는 이 헤더가 없었다.
- 「추정」 정적 파일의 HTTP `Last-Modified`는 파일 생성·배포 시각을 반영할 가능성이 있다. 운영 파일의 실제 생성 원인은 확인하지 않았으며, 재색인 실행 시각이라고 단정할 수 없다.
- 공개 GET은 인덱스 → 허브 → 상세 1 → 행사 순으로 총 4회였다. 요청은 순차 실행했고 연속 요청 사이에 0.3초 대기를 넣어 초당 5건·총 2,000건 제한 안에서 수행했다.

## 실제 본문 변경 시각으로 바꾸려면

**원천 수정일이 목표라면 현재의 `sourceModifiedAt`을 계속 쓰면 된다. 이미 그 값을 쓰므로 `now()` 대체를 고치는 작업은 필요 없다.** 다만 원천 레코드 수정일은 이 사이트에 표시된 본문이 실제로 달라진 시각과 완전히 같다고 보장할 수 없다.

「제안」 이 사이트의 실제 본문 변경 시각이 목표라면 별도 `contentUpdatedAt`을 둔다. 관광지별로 표시되는 주요 본문·이미지·안내 정보의 정규화 해시를 이전 값과 비교해 **내용이 달라졌을 때만** 갱신하고, 재수집·재색인에서 내용이 같으면 유지한다. search 문서와 검색 응답에 이를 전달해 정적 상세·동적 행사 sitemap 모두 이 값을 쓰도록 한다. 최초 관측 시각을 과거 실제 변경 시각으로 주장하지 않고, 값이 없는 경우 생략하거나 원천 수정일 fallback 정책을 명시한다. `createdAt`, `introSyncedAt`, 재색인일, 빌드일은 본문 변경 시각의 대체값으로 쓰지 않는다.

「미확인」 운영 배포 SHA와 origin/main의 동일 여부, 나머지 상세 분할본 2–4의 분포, 여러 날에 걸친 재색인 전후 비교, TourAPI 원문과 live 값의 항목별 일치, 과거 실제 본문 변경 시각은 확인하지 않았다. 라이브 분포만으로 값의 출처를 증명하지 않았으며, 출처 결론은 위 코드 추적으로 뒷받침했다.

## 재현 명령

코드 탐색·읽기:

```sh
git ls-tree -r origin/main --name-only | grep -i sitemap
git show origin/main:portal-fe/scripts/prerender-seo.mjs | nl -ba
git show origin/main:search/batch/src/main/kotlin/com/kgd/search/infrastructure/job/AttractionApiReindexTasklet.kt | nl -ba
git show origin/main:place/domain/src/main/kotlin/com/kgd/place/domain/attraction/model/Attraction.kt | nl -ba
git show origin/main:place/ingest/src/sync_tour.py | nl -ba
```

아래는 같은 GET·XML 집계 방법을 한 번에 재현하는 코드다(재실행은 별도 측정이며 이 문서의 수치를 덮어쓰지 않는다).

```python
import collections, datetime, time, urllib.request, xml.etree.ElementTree as E
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
NS = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
for name in ['sitemap.xml', 'sitemap-places-hub.xml', 'sitemap-places-1.xml', 'sitemap-places-events.xml']:
    now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9)))
    req = urllib.request.Request('https://place.1989v.com/' + name, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=40) as r:
        root = E.fromstring(r.read())
        print(now.isoformat(), name, r.status, dict(r.headers))
    if name == 'sitemap.xml':
        print([v.text for v in root.findall('s:sitemap/s:loc', NS)])
    else:
        urls = root.findall('s:url', NS)
        vals = [v.findtext('s:lastmod', default='', namespaces=NS) for v in urls]
        counts = collections.Counter(v[:10] for v in vals if v)
        print('urls', len(urls), 'missing', vals.count(''), 'unique dates', len(counts))
        print('mode', counts.most_common(5), 'distribution', dict(sorted(counts.items())))
        for day in [now.date(), now.date() - datetime.timedelta(days=1)]:
            n = counts[str(day)]
            print(day, n, n / len(urls) if urls else None)
    time.sleep(0.3)
```
