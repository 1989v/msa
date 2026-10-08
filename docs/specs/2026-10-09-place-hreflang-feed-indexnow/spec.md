<!-- source: place/app, place/ingest/src, search/batch/src/main/kotlin/com/kgd/search/infrastructure/job/AttractionApiReindexTasklet.kt, search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt, portal-fe/scripts/prerender-seo.mjs, portal-fe/nginx.conf -->
# Specification: 관광지 영문 짝(hreflang) + 본문 변경 시각 + RSS + IndexNow (S3-5 · S3-9)

> 2026-10-09. 사용자 위임. S1-8: 국·영은 contentId가 다른 별개 행이다. 영문 placeId 보유 28.3%, 엄격 짝 8.3%이고, 30쌍 중 10쌍은 범위가 다르다. 그래서 placeId만으로는 자동 hreflang을 걸 수 없고, 제목 일치와 일대일 조건이 필요하다(`evidence/stage1/s1-8-place-id-pairs.md` §4·§5). S1-9: lastmod는 원천 수정일이다. 「실제로 바뀐 URL」을 알려면 본문 정규화 해시가 필요하다(`s1-9-lastmod.md`). 수집은 전량 upsert라 바뀐 행을 모른다. IndexNow 실제 제출은 사용자 몫이고(Q1), 설정으로 꺼 둔다. ADR: ADR-0062 §8(상세 hreflang 금지)과 ADR-0103 §4·대안 6(파생값을 place에 두지 않음)을 각각 개정 블록으로 고친다. 문안은 이 스펙의 §ADR 개정에 있다. 용어: **언어 대체 짝**(국문 문서 ↔ 영문 문서, 필드 `alternateId`)은 **`samePlace`(같은 언어 안의 중복 등록)와 다른 개념**이다. 이 스펙은 「같은 장소」라는 말을 쓰지 않는다.
>
> 개정 2026-10-09 — 1라운드 심판(40건 중 37 유지·1 강등·2 기각, `context/review-verdict-round1.md`) 반영. ADR 개정 문안은 `context/adr-amendments-draft.md`(승인 전 초안). 사용자 판단 2~8 은 권고 기본값. 판단 1(짝 표시를 바로 켤지)은 ADR-0062 §8 을 뒤집는 결정이라 **스위치로 꺼 둔다**: search:batch 설정 `search.alternate-pairs.enabled`(기본 false, CronJob env `SEARCH_ALTERNATE_PAIRS_ENABLED`). 꺼져 있으면 짝을 계산해 `Alternate pairs: N …` 로그만 남기고 문서 `alternateId` 는 null — SSR·하이드레이션·sitemap 은 그 필드만 보므로 hreflang 이 하나도 나가지 않는다. 사용자가 ADR-0062 개정을 승인하면 env 를 true 로 바꿔 다음 재색인에서 켜고, 배포 직후 운영 짝 무작위 30쌍을 S1-8 방식으로 수동 확인한다.
>
> 개정 2026-10-09 — 2라운드 심판(10건 전부 유지, I-1 BLOCK 승격 → SR-4 키 배선 교체로 해소, `context/review-verdict-round2.md`) 반영. 3라운드 심판(7건 중 6 유지·1 기각, `context/review-verdict-round3.md`) 반영.

## Goal
국문·영문 상세가 **언어 대체 짝**일 때만 서로 hreflang 으로 잇고, place 가 본문이 실제로 바뀐 관광지를 알아
RSS(언어별 최근 50)와 IndexNow(꺼 둔 채)로 그 주소만 알린다.

## 세 시각 (혼동 금지)
| 이름 | 열 / 필드 | 뜻 |
|---|---|---|
| 원천 수정일 | `source_modified_at` / `sourceModifiedAt`(색인 `modifiedAt`) | TourAPI `modifiedtime`. sitemap lastmod 의 값 — 바꾸지 않는다 |
| 행 갱신 시각 | `attractions.updated_at` | 행이 저장될 때마다 오른다(전화·이미지만 바뀌어도) |
| 본문 변경 시각 | `content_updated_at` / `contentUpdatedAt` | 새 행이거나 SR-2 해시가 달라졌을 때 `now` 로 오른다. 첫 채움·해시 버전 교체 때는 원천 수정일로 시작값을 둔다(SR-2.3 표). RSS·IndexNow 의 기준 — 그래서 RSS `pubDate` 에는 첫 채움 행의 원천 수정일이 섞일 수 있다(수용) |

## Specific Requirements

### SR-1 언어 대체 짝 (S3-5)
1. **계산 위치**: search:batch 재색인 **1차 패스**(`AttractionApiReindexTasklet.collectRegionPlacements`)가 전체 투영으로
   search:domain 순수 객체 `AlternateLanguagePairer.pair(projections): Map<String, String>`(id → 상대 id, 양방향)을 부른다.
   2차 패스가 문서에 `alternateId` 를 싣는다. `RegionProjection` 에 `googlePlaceId: String?` · `titleLocal: String?` ·
   `hasOverview: Boolean` 을 더한다(투영 증가는 문서당 수십 바이트 — 힙 256MB 안).
   `SamePlaceGrouper` 를 확장하거나 `samePlace` 필드에 섞지 않는다.
2. **유형 대응표**(search:domain 상수 `ContentTypeLang` 하나 — `sync_tour.py:47-58` 과 같은 값, 테스트도 이 상수를 쓴다):

   | 언어 중립 유형 | 국문 | 영문 |
   |---|---|---|
   | attraction | 12 | 76 |
   | culture | 14 | 78 |
   | leisure | 28 | 75 |
   | shopping | 38 | 79 |
   | food | 39 | 82 |
   | stay | 32 | 80 |
   | (짝 판정 제외) 행사 | 15 | 85 |
   | (짝 판정 제외) 코스 | 25 | — |

   표에 없는 코드·제외 유형은 짝 후보가 아니다.
3. **후보 간선** — 국문 문서 K · 영문 문서 E 가 아래를 **모두** 만족:
   ① `E.googlePlaceId` 와 `K.googlePlaceId` 가 둘 다 비어 있지 않고 같다
   ② `RegionAggregator.distanceMeters(E, K) ≤ 50`
   ③ 대응표의 언어 중립 유형이 같다(코드 문자열 비교 금지)
   ④ **제목**: `E.titleLocal` 과 `K.title`(국문 **표시명** = 투영 `title` = `titleDisplay ?: title`, S1-8 이 비교한 값)이
      각각 `Normalizer.normalize(NFKC)` → 모든 공백(`\s` 및 유니코드 공백) 제거 → `lowercase(Locale.ROOT)` 뒤 같다.
      `E.titleLocal` 이 비면 후보 아님.
4. **일대일**: 3의 간선 집합(전체 ACTIVE 투영, 행사·코스 제외)에서 E 의 간선 수 = 1 **이고** K 의 간선 수 = 1 인 간선만 짝.
5. **표시 가능 조건(판정에 포함)**: 4의 짝 중 **양쪽 모두 `hasOverview`** 인 것만 `alternateId` 로 싣는다
   (서버 렌더 noindex 판정 `AttractionPageRenderer.kt:63` 과 같은 기준 — 행사는 2에서 이미 빠짐).
   재색인 로그 한 줄: `Alternate pairs: N (edges E, dropped by uniqueness U, dropped by overview O, enabled=true|false)`. `search.alternate-pairs.enabled` 가 false 면 계산·로그는 그대로 하고 문서 `alternateId` 는 null 로 싣는다(테스트: 꺼짐 → 모든 문서 null · 로그 N 은 켜짐과 같음). 구현 커밋에서 `k8s/base/search-batch/cronjob-attraction-reindex.yaml` env 에 `SEARCH_ALTERNATE_PAIRS_ENABLED: "false"` 를 미리 넣는다. 켜기·되돌리기는 부록 C.
6. **경로**: `alternateId`(keyword, doc_values 유지) — 배치 `AttractionIndexDocument` · 색인 매핑(`ATTRACTIONS_INDEX_DEFINITION`) ·
   계약 게이트 · 앱 `AttractionSearchDocument` · 도메인 · `SearchAttractionUseCase` 응답 · FE `Attraction` 타입 ·
   `prerender-seo.mjs indexDoc` 투영.
7. **표시** (세 곳이 같은 순서·값):
   - 헬퍼 `copy.mjs attractionHreflangAlternates(docLang, id, alternateId)` → `[ko, en, x-default]`.
     ko 는 국문 쪽 id 의 `/attractions/{id}`, en 은 영문 쪽 id 의 `/en/attractions/{id}`, x-default = en
     (허브 `placeHreflangAlternates` 와 같은 규칙). **어느 쪽이 국문인지는 문서 `lang`(docLang) 기준** — 요청 경로 아님.
   - SSR(`AttractionPageRenderer`): `alternateId != null` **이고** 자기 noindex 가 아닐 때만 위 세 줄을
     `data-seo-multi` 속성과 함께 낸다(하이드레이션이 지우고 다시 달 수 있게). copy.mjs 출력과 대조하는 패리티 테스트.
   - 하이드레이션(`AttractionPage.tsx`): 같은 조건으로 `useSeo({ alternates: attractionHreflangAlternates(...) })`.
     조건이 아니면 alternates 를 넘기지 않는다.
   - sitemap(`placeDetailSitemapEntries`): 항목의 `alternateId` 가 **상대 언어 sitemap 항목 집합에도 있을 때만**
     `alternates` 를 붙인다. 정적 sitemap 은 FE 빌드 시점 값이라 다음 빌드까지 낡을 수 있다 — 수용(SSR 이 기준).
   - 영문 문서가 없는 관광지에 /en 주소를 만들지 않는다(지금 그대로).
   - 「hreflang 없음」 주석 세 곳(`AttractionPageRenderer.kt:65,117`, `AttractionPage.tsx:171-173`, `prerender-seo.mjs:707-708`)을 「언어 대체 짝이고 짝 스위치(`search.alternate-pairs.enabled`, 기본 꺼짐)가 켜졌을 때만 hreflang (ADR-0062 §8 개정)」으로 고친다.
8. **오라클**: 부록 A 의 30쌍. 픽스처는 `s1-8-review-pages.json` 에서 57개 문서의
   `id·lang·contentTypeId·googlePlaceId·latitude·longitude·title(국문)·titleLocal(영문)` 과 쌍별 `expected`(pair|none)를 뽑아
   `search/domain/src/test/resources/attraction/alternate-pairs-oracle.json` 에 둔다. 테스트는 **57개 문서 전체를 한 번에**
   `pair()` 에 넣고(그래야 13645·34965·15093 처럼 여러 쌍에 걸린 문서의 일대일이 판정된다) 30쌍 각각의 결과가 `expected` 와 같음을 단언한다.
   `hasOverview` 는 픽스처 전부 true 로 둔다.

### SR-2 본문 변경 시각 (place)
1. `attractions` 에 `content_hash VARCHAR(80) NULL` · `content_updated_at DATETIME(6) NULL` + 인덱스 `(content_updated_at, id)` — `V34`.
   두 열은 bulk 요청 DTO·`Attraction.syncFrom` 의 source 에서 **읽지 않는다**(자기 계산값).
2. **해시**: place:domain `AttractionContentHash`(자체 정규화 — search `sourceText` 와 일치를 요구하지 않는다).
   - 입력 필드(순서 고정 상수 `HASH_FIELDS`): `title, overview, address, tel, imageUrl, useTime, restDate, useFee, parking,
     parkingFee, infoCenter, eventStartDate, eventEndDate, introRaw`.
   - 필드별 정규화: null → 빈 문자열, `<[^>]*>` 제거, 공백류(유니코드 공백 포함) 연속을 공백 하나로, 앞뒤 trim. 날짜는 ISO.
   - 직렬화: `필드명=값` 을 `\u001F` 로 이어 SHA-256 hex. 저장값 = `"v1:" + hex`. 정규화 규칙을 바꾸면 접두를 `v2:` 로 올린다.
3. **시각 규칙** — `now` 는 호출자가 넘긴다(어댑터가 `LocalDateTime.now(ZoneId.of("Asia/Seoul"))`). 해시는 **병합이 끝난 뒤 자기 필드**로 계산
   (`syncFrom(source, now)` 의 마지막 단계, 생성은 `stampNew(now)`):

   | 상황 | content_hash | content_updated_at |
   |---|---|---|
   | 새 행(생성 경로 `AttractionRepositoryAdapter` `existing == null`) | 계산 | `now` (새 URL 은 변경으로 센다) |
   | 기존 행, 이전 해시 null (첫 채움) | 계산 | `source_modified_at` (null 이면 null) |
   | 기존 행, 이전 해시 접두 ≠ 현재 버전 | 재계산 | 그대로 (null 이면 `source_modified_at`) |
   | 같은 버전 · 같은 해시 | 그대로 | 그대로 |
   | 같은 버전 · 다른 해시 | 새 값 | `now` |

   `content_updated_at` 이 null 인 행은 RSS·IndexNow 에서 빠진다. 목록 동기화가 닿지 않는 행은 계속 null 일 수 있다 — 수용.
4. place API 응답(`/api/places/attractions` 목록·단건)과 search 색인 문서에 `contentUpdatedAt` 을 싣는다(SR-1.6 과 같은 경로 목록,
   색인 매핑 `date`, doc_values 유지 — 정렬용). sitemap lastmod 는 원천 수정일 그대로.

### SR-3 RSS (언어별 최근 갱신 50)
1. 주소: `https://place.1989v.com/feed.xml`(국문) · `/en/feed.xml`(영문). nginx `location = /feed.xml` · `location = /en/feed.xml` 두 개,
   각각 place 호스트 외 404, upstream 고정 문자열 `/internal/render/feed/ko.xml` · `/internal/render/feed/en.xml`
   (행사 sitemap location `nginx.conf:75-89` 를 그대로 따른다 — `proxy_intercept_errors`·셸 폴백 없음, 쿠키·인증 헤더 제거).
   성공에만 `Cache-Control: public, max-age=600`. 엣지 캐시·서버 캐시는 넣지 않는다(측정 뒤).
2. search:app `AttractionFeedRenderer`: 해당 언어, `contentUpdatedAt` 있는 문서, `contentUpdatedAt desc, id asc`, 50건.
   RSS 2.0 — channel(title·link=허브·description·language `ko`|`en`·lastBuildDate=첫 항목 시각), item(title=상세 제목 규칙,
   link·guid(isPermaLink=true)=id 로 조립한 상세 canonical, pubDate=`contentUpdatedAt` 을 `+0900` RFC 1123 으로, description=목록 요약 규칙).
3. 텍스트 처리 순서 고정: `sourceText` → XML 1.0 금지 문자(U+0000–U+0008, U+000B, U+000C, U+000E–U+001F, U+FFFE, U+FFFF) 제거 →
   XML 이스케이프(`& < > " '`).
4. 색인 조회 실패 → **503 + `Cache-Control: no-store`**(빈 200 금지). 0건 → 200 + 항목 없는 유효 channel.
5. 허브·상세 `<head>` 에 `<link rel="alternate" type="application/rss+xml" title=… href=(해당 언어 feed)>` — SSR 은 `data-seo-multi` 로 내고,
   `useSeo` 에 같은 MULTI 블록에서 처리하는 `feeds` 입력을 더하며, 허브 프리렌더도 같은 값을 낸다.

### SR-4 IndexNow (꺼 둔 채)
1. **키**: 32자 hex 키 하나를 Secret `place-indexnow`(키 `key`)로 둔다. 운영(oci-arm)은 레포 밖에서 만든다(사용자, `ssh msa-oci` 에서 `kubectl -n commerce create secret generic place-indexnow --from-literal=key=…`) — oci-arm 에는 SealedSecrets 컨트롤러가 없고 이 레포의 운영 Secret 은 수동 등록이 관례다(`cf-origin-ca-tls`·`place-ingest-secrets`). 레포에는 Secret 도 SealedSecret 도 두지 않는다.
   portal-fe · place-ingest 가 **같은 Secret** 을 env `INDEXNOW_KEY`(secretKeyRef, **`optional: true`**)로 읽는다 — Secret 이 없어도 두 파드는 뜨고, 키 파일이 없을 뿐이다. k3s-lite 도 Secret 을 두지 않는다(없음이 정상). 키·요청 본문은 로그에 쓰지 않는다.
2. **키 파일**: nginx.conf 본문에 키를 넣지 않는다(envsubst 는 정의된 변수만 치환해서, 키가 없으면 `${INDEXNOW_KEY}` 가 nginx 변수로 남아 기동이 실패하고 모든 호스트가 내려간다). `NGINX_ENVSUBST_FILTER` 는 그대로 둔다.
   - `portal-fe` 이미지에 `/docker-entrypoint.d/` 스크립트(20-envsubst 보다 앞 번호)를 실행 권한째 넣는다(`COPY --chmod=0755` 또는 레포 파일 모드 100755 — 실행 비트가 없으면 엔트리포인트가 오류 없이 건너뛰어 키 파일만 조용히 빠진다). `INDEXNOW_KEY` 가 값 전체로 32자 소문자 hex 일 때만 `/etc/nginx/conf.d/indexnow/indexnow.conf` 조각을 쓴다 — 검사는 `${#k} -eq 32` 와 `case "$k" in *[!0-9a-f]*) 거부` 를 함께 쓰고, 줄 단위 `grep` 은 쓰지 않는다(여러 줄 값의 첫 줄만 맞춰 보고 통과시킨다). 조각은 하위 디렉터리에 둔다 — `conf.d/` 바로 아래 `*.conf` 는 http 블록이 읽어 `location` 이 server 밖에 놓이고 nginx 기동이 실패한다. 비었거나 형식이 다르면 조각을 쓰지 않고 경고 한 줄을 남긴다(키 값은 찍지 않는다).
   - 조각 내용: `location = /{key}.txt { if ($host != "place.1989v.com") { return 404; } default_type text/plain; add_header Cache-Control "public, max-age=300"; return 200 "{key}"; }`
   - nginx.conf 의 server 블록에 `include /etc/nginx/conf.d/indexnow/*.conf;` — 글롭은 0건이어도 오류가 아니다.
   - 넓은 정규식(`\.txt$`)·디렉터리 마운트 금지. 검증: 키 없음 → nginx 기동·키 파일 없음, 형식 틀린 키(`;` 포함 · 첫 줄은 정상 키인 여러 줄 값 · 끝 개행 포함) → 조각 없음·기동, 정상 키 → 200·본문 = 키.
3. **변경 목록 포트(place)**: `GET /internal/attractions/content-updated?since=&until=&afterId=&size=` — 게이트웨이 비경유(`/internal/attractions/**` 관례).
   UseCase 인터페이스 `FindContentUpdatedAttractionsUseCase` + `AttractionRepositoryPort.findContentUpdated(since, until, afterId, size)` + 어댑터(ADR-0083).
   ACTIVE 만, `since ≤ content_updated_at < until`, id 키셋, 응답 `{id, lang}` 목록 + `nextAfterId`.
4. **제출 잡**: place-ingest `--job=indexnow`, 새 CronJob `place-ingest-indexnow` **UTC 22:30(KST 07:30)** — 재색인(UTC 21:30) 뒤라
   제출 시점에 SSR 이 새 본문을 낸다. 창 = `[실행 시각(KST) − 24h, 실행 시각)`, 저장처 없음.
   하루 실패하면 그날 변경은 IndexNow 에서 빠진다(RSS·sitemap 으로 남음 — 수용). 재색인이 실패한 날은 옛 본문을 알릴 수 있다 — 수용.
5. URL = 국문 `https://place.1989v.com/attractions/{id}` · 영문 `…/en/attractions/{id}`. 10,000건씩
   `POST https://api.indexnow.org/indexnow` JSON `{host:"place.1989v.com", key, keyLocation:"https://place.1989v.com/{key}.txt", urlList}`, 타임아웃 30초.
   - 200·202 → 성공(202 = 키 검증 대기). 400·403(「키 불일치 — 키 파일 확인」)·422·429·그 밖·타임아웃 → 코드별 문구로 기록, **잡은 성공(exit 0)**.
   - 0건 → 요청 없이 `IndexNow 대상 0건`.
   - `INDEXNOW_ENABLED`(기본 false) 가 아니면 요청 없이 `IndexNow 비활성 — 보낼 주소 N건`.
6. 외부 데이터 대장(`docs/architecture/data-sources.md`)에 「송신」 행 한 줄(보내는 것: 공개 URL·공개 키, 개인정보 없음).
   `k8s/base/network-policy/11-allow-egress-https-public.yaml` place-ingest 주석에 「+ IndexNow 송신(api.indexnow.org)」. 정책 값은 그대로.

### SR-5 검증
1. **단위**(Kotest BehaviorSpec, 도메인 Mock 금지):
   - `AlternateLanguagePairerTest`(search:domain): 오라클 30쌍(부록 A) · 조건 ①~④ 각각 실패(① 은 오라클 #27 — placeId 둘 다 있고 다름 — 과 합성 사례) · 국 12 ↔ 영 76 → 같은 유형 · 국 25·행사 15/85 → 없음 ·
     **합성** 일대다(국문 둘이 ①~④ 모두 만족 → 둘 다 없음) · **합성** 51m → 없음 · 한쪽 개요 없음 → 없음 · `titleLocal` 없음 → 없음.
   - `AttractionContentHashTest` · `AttractionTest`(place:domain): 같은 본문 → 같은 해시 · 공백·태그만 다름 → 같음 · 요금 변경 → 다름 ·
     행사 날짜만 변경 → 다름 · **개요 없는 목록 레코드가 들어와도 해시·시각 그대로** · 표 SR-2.3 다섯 행 각각 · source 에 해시를 넣어 보내도 무시.
   - 재색인: `AttractionApiReindexTaskletTest` 에 `alternateId` 단언(`samePlace` 단언 옆), `AttractionReindexCaptureTest` 역직렬화 경로.
   - `AttractionPageRendererTest`: 짝·자기 noindex 아님 → 세 줄(`data-seo-multi`), 짝 없음/noindex → 없음, `/en/attractions/{국문id}` 요청 → docLang 기준.
     `AttractionHreflangParityTest`: copy.mjs 출력과 대조.
   - FE vitest: `attractionHreflangAlternates`, `AttractionPage` 의 `useSeo` 입력에 alternates 존재/부재, `placeDetailSitemapEntries` 상대 항목 없음 → alternates 없음.
   - `AttractionFeedRendererTest` + 컨트롤러 슬라이스: 정렬·50 상한·언어·제어문자 포함 제목 → 유효 XML·이스케이프·0건·조회 실패 → 503.
   - place 내부 조회: UseCase(MockK 포트) + 어댑터 범위 조건.
   - `place/ingest/tests/indexnow_test.py`(`urlopen` 만 가짜): 꺼짐 → 미전송·건수 로그 · 켜짐 → 본문 `host·key·keyLocation·urlList` ·
     10,001건 → 요청 2회 · 202 성공 · 403/429/500/타임아웃 → 기록 후 exit 0 · 0건 → 미전송 · 로그에 키 없음.
   - `portal-fe/scripts/check-nginx-indexnow.sh`(`check-nginx-events-sitemap.sh` 와 같은 방식, 실제 nginx 이미지) — 레포의 실제 entrypoint 스크립트를 실행 권한째 `/docker-entrypoint.d/` 에 마운트하고 `-e INDEXNOW_KEY` 를 바꿔 가며 ① 미설정 → 기동·`/{임의hex}.txt` 응답이 키 본문 아님 ② `;` 포함·여러 줄(첫 줄 정상) → 조각 없음·기동 ③ 정상 → place 호스트 200·본문 = 키·`Cache-Control` 한 벌, apex·blog 호스트 404.
2. **회귀 주입**(임시 사본에서, 각 빨강을 본 뒤에만 「켰다」): 대응표 무시(문자열 비교) · 제목 조건 삭제 · 일대일 삭제(합성 사례가 잡는다) ·
   좌표 조건 삭제(합성 사례가 잡는다) · 개요 조건 삭제 · 해시 비교 삭제(항상 now) · 병합 전 source 로 해시 계산 · 첫 채움 처리 삭제 ·
   새 행 처리 삭제 · RSS 정렬 뒤집기 · XML 금지 문자 제거 삭제 · IndexNow 꺼짐 분기 삭제 · AttractionPage alternates 전달 삭제 · 짝 스위치 분기 삭제(꺼져도 `alternateId` 를 실음 — 「꺼짐 → 모든 문서 null」 테스트가 잡는다) · 키 형식 검사를 줄 단위 `grep` 으로 바꾸기(`check-nginx-indexnow.sh` ② 가 잡는다).
3. **배포 순서**: Secret `place-indexnow` 생성(사용자, OCI — 없어도 배포는 안전하고 키 파일만 없다. portal-fe 배포 뒤에 만들었으면 `ssh msa-oci` 에서 `kubectl -n commerce rollout restart deploy/portal-fe` — env 와 조각은 기동 때 한 번만 읽힌다. place-ingest 는 CronJob 실행마다 읽어 재시작이 필요 없다) → place(V34·응답 필드·내부 조회) → search:batch·app → portal-fe → place-ingest CronJob.
4. **배포 뒤**:
   - `feed.xml`·`/en/feed.xml` 200, 항목 ≤ 50, XML 파서 통과. 다른 호스트 404.
   - **배포 직후(스위치 꺼짐)**: 재색인 로그 `Alternate pairs: N (… enabled=false)` 에서 N ≥ 1. 운영 응답 `alternateId` 는 전부 null, SSR·sitemap 의 상세 hreflang 은 0줄.
   - **켠 뒤(부록 C)**: 표본 3곳 = 오라클 「짝」 중 우선 #2(en 2180 ↔ ko 5337) · #3(14206 ↔ 7935) · #9(13515 ↔ 5318).
     운영 응답 `alternateId` 와 양쪽 SSR `<link hreflang>` 세 줄을 확인. 운영 전역 판정에서 짝이 없으면 그 사실을 적고 부록 A 의 다음 「짝」 번호로.
     반례 #19(en 1676·ko 160)·#24(ko 2477)에 hreflang 없음.
   - **hreflang 오류 0(AC, 켠 뒤)**: 전제 — `alternateId` 있는 문서 수 ≥ 1(0건이면 AC 실패). 그 문서 전부를 스크롤해 — 상대 문서 존재 · 상대 `alternateId` = 자기 · 언어 다름 ·
     양쪽 overview 비어 있지 않음 — 위반 건수 0. 무작위 30쌍 수동 확인(S1-8 방식).
   - 키 파일 200·본문 = 키, apex·blog 호스트 404. `/.txt`·틀린 키 → 키 본문이 아님(SPA 셸 — 정확 일치 location 밖은 `location /` 로 떨어진다).
   - ingest 로그 `IndexNow 비활성 — 보낼 주소 N건`. 기대 N = 창 안의 새 행 + 원천 수정일이 창 안인 첫 채움 행(0 일 수 있음).

## Existing Code to Leverage
`AttractionJpaEntity.kt:20-25,134-156,172`, `Attraction.kt:325-407(syncFrom)`, `AttractionRepositoryAdapter.kt:24-46`,
`place_client.py:33-105`, `sync_tour.py:47-58(유형 코드)`, `SamePlace.kt:15-39(SamePlaceGrouper — 위치 선례)`, `RegionAggregator.kt:15-29`,
`AttractionApiReindexTasklet.kt:391-418,450-464`, `AttractionPageRenderer.kt:50-70,117,723-724`, `AttractionSeoText.kt:46-80`,
`useSeo.ts:69-78`, `AttractionPage.tsx:150-173`, `copy.mjs:541-547`, `prerender-seo.mjs:707-727,816-826,1003`,
`nginx.conf:64-89(행사 sitemap 동적 선례)`, `Dockerfile:76-80`, `EventSitemapRenderer.kt`,
`evidence/stage1/s1-8-place-id-pairs.md`·`s1-8-review-pages.json`, `s1-9-lastmod.md`.

## Out of Scope
IndexNow 실제 제출 켜기(사용자 — 부록 B), 짝 스위치 켜기(사용자 — 부록 C), 지역·허브 hreflang 변경, sitemap lastmod 를 contentUpdatedAt 으로 바꾸기, 영문 번역 생성,
ACTIVE → INACTIVE 로 사라진 URL 의 IndexNow 알림(해시는 상태를 보지 않는다), 행사(15·85) hreflang(동적 sitemap 포함),
placeId 없는 짝(#26·#29)·placeId 가 다른 짝(#27)·50m 밖 대표점·`titleLocal` 없는 영문 — 재현율 손실로 수용, 수동 매핑 경로,
introRaw 키 순서 변화로 인한 1회성 변경 판정, RSS·제출 캐시(측정 뒤).

## 부록 A — 오라클 기대값 (S1-8 30쌍, 규칙 SR-1.2~1.5, 57문서 동시 판정)
| # | 영문 id | 국문 id | 유형 영/국 | placeId | 거리 | 제목 일치 | S1-8 판정 | 기대 | 이유 |
|---:|---|---|---|---|---:|---|---|---|---|
| 1 | 14815 | 10381 | 76/12 | 같음 | 0.0 | 예 | 같은 범위 | 짝 | 전 조건 · 일대일 |
| 2 | 2180 | 5337 | 76/12 | 같음 | 5.6 | 예 | 같은 범위 | 짝 | 〃 |
| 3 | 14206 | 7935 | 76/12 | 같음 | 6.1 | 예 | 같은 범위 | 짝 | 〃 |
| 4 | 13645 | 4085 | 76/12 | 같음 | 0.0 | 예 | 같은 범위 | 짝 | 13645↔2477(#24)은 제목 불일치라 간선 아님 → 일대일 |
| 5 | 2325 | 3456 | 76/12 | 같음 | 4.5 | 예 | 같은 범위 | 짝 | 전 조건 · 일대일 |
| 6 | 13698 | 8647 | 76/12 | 같음 | 6.7 | 예 | 같은 범위 | 짝 | 〃 |
| 7 | 2194 | 6776 | 76/12 | 같음 | 4.6 | 예 | 같은 범위 | 짝 | 〃 |
| 8 | 18192 | 15369 | 78/14 | 같음 | 5.1 | 예 | 같은 범위 | 짝 | 〃 |
| 9 | 13515 | 5318 | 76/12 | 같음 | 0.0 | 예 | 같은 범위 | 짝 | 〃 |
| 10 | 13853 | 11343 | 76/12 | 같음 | 5.2 | 예 | 같은 범위 | 짝 | 〃 |
| 11 | 18161 | 16711 | 78/14 | 같음 | 6.4 | 예 | 같은 범위 | 짝 | 〃 |
| 12 | 18206 | 17689 | 78/14 | 같음 | 7.5 | 예 | 같은 범위 | 짝 | 〃 |
| 13 | 14200 | 13062 | 76/12 | 같음 | 0.0 | 예 | 같은 범위 | 짝 | 〃 |
| 14 | 2220 | 10334 | 76/12 | 같음 | 0.0 | 예 | 같은 범위 | 짝 | 〃 |
| 15 | 34965 | 22911 | 79/38 | 같음 | 0.0 | 예 | 같은 범위 | 짝 | 34965↔22851(#22)은 제목 불일치 → 일대일 |
| 16 | 15093 | 1015 | 76/12 | 같음 | 0.0 | 아니오 | 판단 불가 | 없음 | 제목(숲속야영장) |
| 17 | 15093 | 19627 | 76/28 | 같음 | 69.7 | 아니오 | 범위 다름 | 없음 | 거리·유형·제목 |
| 18 | 2059 | 20783 | 76/28 | 같음 | 273.1 | 아니오 | 범위 다름 | 없음 | 거리·유형·제목 |
| 19 | 1676 | 160 | 76/12 | 같음 | 32.0 | 아니오 | 범위 다름 | 없음 | 제목(월미짱랜드 ≠ 월미 관광특구) |
| 20 | 34929 | 22869 | 79/38 | 같음 | 0.0 | 아니오 | 범위 다름 | 없음 | 제목 |
| 21 | 34887 | 22857 | 79/38 | 같음 | 0.0 | 아니오 | 범위 다름 | 없음 | 제목 |
| 22 | 34965 | 22851 | 79/38 | 같음 | 0.0 | 아니오 | 범위 다름 | 없음 | 제목 |
| 23 | 14608 | 9095 | 76/12 | 같음 | 215.4 | 아니오 | 범위 다름 | 없음 | 거리·제목 |
| 24 | 13645 | 2477 | 76/12 | 같음 | 4.4 | 아니오 | 범위 다름 | 없음 | 제목 |
| 25 | 22453 | 19751 | 75/28 | 같음 | 6.3 | 예 | 같은 범위 | 짝 | 대응표로 leisure 같음(응답 category 는 다름) |
| 26 | 38412 | 25698 | 79/38 | 없음 | 0.0 | 예 | 같은 범위 | 없음 | placeId 없음(재현율 손실) |
| 27 | 18066 | 16043 | 78/14 | 다름 | 0.0 | 예 | 같은 범위 | 없음 | placeId 불일치 · 조건 ① 실패(재현율 손실) |
| 28 | 40604 | 27494 | 79/38 | 없음 | 0.0 | 아니오 | 범위 다름 | 없음 | placeId·제목 |
| 29 | 37669 | 23352 | 79/38 | 없음 | 5.7 | 예 | 같은 범위 | 없음 | placeId 없음(재현율 손실) |
| 30 | 36250 | 28383 | 79/38 | 없음 | 0.0 | 아니오 | 범위 다름 | 없음 | placeId·제목 |

합계: 짝 16(모두 「같은 범위」) / 없음 14(범위 다름 10 · 판단 불가 1 · placeId 없거나 다른 같은 범위 3 — 없음 #26·#29, 다름 #27). 오탐 0.
참고 — 제목 조건을 지우면 #16·#19 가 짝으로 나오고 #4·#15 가 일대일에서 빠진다(회귀 주입 기대값).
일대일·좌표 조건을 지워도 이 30쌍의 결과는 같다 → 합성 사례로 잡는다.

## 부록 B — IndexNow 켜기(사용자, Q1)
1. 배포 뒤 `https://place.1989v.com/{key}.txt` 200·본문 = 키 확인. 키 본문이 아니면 Secret 존재 여부와 Secret 생성 뒤 portal-fe 재시작 여부(SR-5.3)를 확인한다.
2. `k8s/base/place-ingest/cronjob-indexnow.yaml` 의 `INDEXNOW_ENABLED` 를 `"true"` 로 커밋 → 다음 KST 07:30 로그에서
   `IndexNow 제출 N건 — 200|202` 확인(403 이면 키 파일·Secret 대조).
3. 되돌리기: 같은 값을 `"false"` 로. 제출한 URL 은 회수할 수 없지만 해가 없다.

## 부록 C — 짝 스위치 켜기·되돌리기(사용자)
1. 사용자가 ADR-0062 §8 개정(스위치를 켜는 결정)을 승인한다.
2. `k8s/base/search-batch/cronjob-attraction-reindex.yaml` 의 `SEARCH_ALTERNATE_PAIRS_ENABLED` 를 `"true"` 로 커밋한다.
3. 다음 KST 06:30 재색인 로그 `enabled=true` 와 SR-5.4 「켠 뒤」 항목을 확인한다.
4. 무작위 30쌍 수동 확인 결과를 `docs/research/2026-10-07-tourism-growth/evidence/` 아래에 남긴다. 범위 다름이 1건이라도 나오면 5단계로 되돌린다.
5. 되돌리기: `"false"` 로 커밋 → 재색인 → **portal-fe 를 다시 빌드·배포**해 정적 sitemap 의 alternates 를 비운다(sitemap 은 빌드 시점 값이라 재색인만으로는 남는다).
