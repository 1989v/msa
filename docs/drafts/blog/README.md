# place 글 초안 (S4-5 · 유입 플랜 I2-2)

데이터 스토리 2편 + 빌드 스토리 1편 초안. **게시는 사용자 몫**이다 — DB(`blog_post`) 반영·발행 상태 변경·개념 매핑은 하지 않았다.
글 머리말은 `docs/conventions/blog-writing.md` §5 의 4필드 + `status: draft`.

| 파일 | slug | category | lint (`--strict`) |
|---|---|---|---|
| `2026-10-place-free-admission-by-sigungu.md` | `free-admission-attractions-by-sigungu` | `/tech/data` | `PASS  blog-writing §4 통과` |
| `2026-10-place-pet-and-wheelchair-attractions.md` | `pet-friendly-wheelchair-attractions-by-region` | `/tech/data` | `PASS  blog-writing §4 통과` |
| `2026-10-place-public-data-site-build.md` | `tourapi-attraction-site-ssr-parser-hreflang` | `/tech` | `PASS  blog-writing §4 통과` |

lint 명령: `python3 scripts/lint-blog-post.py docs/drafts/blog/<파일> --strict` (2026-10-11 KST, 세 편 FAIL 0 · WARN 0).

## 데이터 기준 시각

| 항목 | 값 |
|---|---|
| 색인 | `attractions_20261010213013` (별칭 `attractions`), 67,440 문서 (ko 52,140 · en 15,300) |
| 색인 시각 | 재색인 Job `attraction-reindex-29861130` 완료 2026-10-11 06:34:31 KST, 속성 파서 v3 |
| 질의 시각 | 2026-10-11 09:37~10:10 KST (OpenSearch 직접 · 공개 검색 API 교차 확인) |
| 집계 범위 (데이터 스토리) | `lang=ko` · `category ∈ {nature, history, culture, leisure}` = 18,469곳 · 시군구 257곳 (시군구 코드 없는 3곳 제외) |
| 시군구 키 | `ldongRegnCd`(2) + `ldongSignguCd`(3) = place 지역 주소 `/regions/{5자리}` |

공개 API 교차 확인(같은 수): 종로구 무료 167 · 종로구 전체 316 · 울주군 반려 전 구역 19 · 종로구 휠체어 27.

## 사용한 질의

모두 `ssh msa-oci` → `kubectl -n commerce exec opensearch-0 -- curl -s -XPOST localhost:9200/attractions/_search` (읽기 전용, size 0 집계).

1. 전체 분포 — 언어·분류·속성 값별 건수
```json
{"size":0,"track_total_hits":true,"query":{"bool":{"filter":[{"term":{"lang":"ko"}}]}},
"aggs":{"sight":{"filter":{"terms":{"category":["nature","history","culture","leisure"]}},
  "aggs":{"adm":{"terms":{"field":"attrAdmission"}},"pet":{"terms":{"field":"petPolicy"}},"bf":{"terms":{"field":"barrierFree","size":30}},
          "bfAny":{"filter":{"exists":{"field":"barrierFree"}}},"bfdetail":{"filter":{"exists":{"field":"barrierFreeDetail"}}},"ver":{"terms":{"field":"attributeParserVersion"}}}},
 "adm_all":{"terms":{"field":"attrAdmission"}},"pet_all":{"terms":{"field":"petPolicy"}},"bf_all":{"terms":{"field":"barrierFree","size":30}},
 "ct":{"terms":{"field":"contentTypeId","size":20}},"cat":{"terms":{"field":"category","size":20}},"src":{"terms":{"field":"source"}},"cp":{"terms":{"field":"copyrightDivCd"}}}}
```

2. 시도·시군구별 집계 — 무료·유료·반려(ALLOWED+PARTIAL)·휠체어·무장애 코드 유무. `top_hits` 는 `"sort":["_doc"]` 가 있어야 필터 집계 안에서 NPE 가 안 난다.
```json
{"size":0,"query":{"bool":{"filter":[{"term":{"lang":"ko"}},{"terms":{"category":["nature","history","culture","leisure"]}}]}},
"aggs":{
 "petcat":{"terms":{"field":"category"},"aggs":{"p":{"terms":{"field":"petPolicy"}}}},
 "sgg":{"multi_terms":{"terms":[{"field":"ldongRegnCd"},{"field":"ldongSignguCd"}],"size":400},
  "aggs":{"free":{"filter":{"term":{"attrAdmission":"FREE"}}},"paid":{"filter":{"term":{"attrAdmission":"PAID"}}},
          "pet":{"filter":{"terms":{"petPolicy":["ALLOWED","PARTIAL"]}}},"petA":{"filter":{"term":{"petPolicy":"ALLOWED"}}},
          "wc":{"filter":{"term":{"barrierFree":"WHEELCHAIR"}}},"bfany":{"filter":{"exists":{"field":"barrierFree"}}},
          "nm":{"top_hits":{"size":1,"sort":["_doc"],"_source":["sidoName","sigunguName","address"]}}}},
 "sido":{"terms":{"field":"ldongRegnCd","size":30},
  "aggs":{"free":{"filter":{"term":{"attrAdmission":"FREE"}}},"pet":{"filter":{"terms":{"petPolicy":["ALLOWED","PARTIAL"]}}},
          "petA":{"filter":{"term":{"petPolicy":"ALLOWED"}}},"wc":{"filter":{"term":{"barrierFree":"WHEELCHAIR"}}},"bfany":{"filter":{"exists":{"field":"barrierFree"}}},
          "nm":{"top_hits":{"size":1,"sort":["_doc"],"_source":["sidoName"]}}}},
 "missing_sgg":{"missing":{"field":"ldongSignguCd"}}}}
```

3. 휠체어 원문 표본 — WHEELCHAIR 코드가 있는 볼거리 1,212건 전부의 `barrierFreeDetail.wheelchair` 를 받아 「대여」 포함 여부를 셌다(1,168건, 96.4%).
```json
{"size":1500,"_source":["barrierFreeDetail.wheelchair"],"query":{"bool":{"filter":[{"term":{"lang":"ko"}},{"terms":{"category":["nature","history","culture","leisure"]}},{"term":{"barrierFree":"WHEELCHAIR"}}]}},
"aggs":{"x":{"global":{},"aggs":{"ko":{"filter":{"term":{"lang":"ko"}},"aggs":{"any":{"filter":{"exists":{"field":"barrierFree"}}}}},"en":{"filter":{"term":{"lang":"en"}},"aggs":{"any":{"filter":{"exists":{"field":"barrierFree"}}},"pet":{"terms":{"field":"petPolicy"}},"adm":{"terms":{"field":"attrAdmission"}}}}}}}}
```

4. 분류별·시도별 레저 비중
```json
{"size":0,"query":{"bool":{"filter":[{"term":{"lang":"ko"}},{"terms":{"category":["nature","history","culture","leisure"]}}]}},"aggs":{"s":{"terms":{"field":"ldongRegnCd","size":30},"aggs":{"c":{"terms":{"field":"category"},"aggs":{"f":{"filter":{"term":{"attrAdmission":"FREE"}}}}}}},"c":{"terms":{"field":"category"},"aggs":{"f":{"filter":{"term":{"attrAdmission":"FREE"}}}}}}}
```

빌드 스토리 수치 출처:

| 수치 | 출처 |
|---|---|
| 짝 후보 2,616 · 일대다 제외 16 · 짝 2,600 · `enabled=false` | 재색인 Job 로그 `Alternate pairs: 2600 (edges 2616, dropped by uniqueness 16, dropped by overview 0, enabled=false)` |
| http 원천 사진 20,188 / 사진 있는 문서 57,616 | `prefix imageUrl "http://tong.visitkorea.or.kr/"` 집계 |
| 국문 입장료 무료 9,421 · 유료 3,575 · 모름 39,144 | 1번 질의 `adm_all` |
| sitemap 상세 62,984 · 허브 541 · 행사 550 | `https://place.1989v.com/sitemap*.xml` 의 `<loc>` 수 |
| `X-Render: ssr` · 404 두 건 · `seo:prerendered` | 글 본문 「검증」 절의 curl (2026-10-11 KST 실행) |

## place 내부 링크 목록 (I2-2 용)

전부 2026-10-11 KST 에 200 확인. 속성 랜딩(`/regions/{코드}/{속성}`)은 색인 스위치가 꺼져 있어 **`noindex, follow`** 다 — 링크는 살아 있고 지역 페이지로 따라간다.

| 글 | 지역 페이지 (색인 대상) | 속성 랜딩 (noindex) | 상세 |
|---|---|---|---|
| 무료 입장 | `/regions/` 50110 · 11110 · 50130 · 47130 · 48220 · 47170 · 12130 · 43130 · 48310 · 28710 · 51150 · 48860 · 11140 · 43760 · 51110 · 47940 · 47750 · 27110 · 48740 · 47900 · 12170 · 28720 · 47230 · 47840 (24) | `/regions/11110/free` · `/regions/11140/free` · `/regions/11680/free` · `/regions/27110/free` | `/attractions/2408` 경주 첨성대 · `/attractions/66` 조계사 · `/attractions/40` 세종대왕 동상 |
| 반려·휠체어 | `/regions/` 51150 · 50110 · 50130 · 31710 · 47130 · 44825 · 12150 · 48270 · 51750 · 51110 · 11110 · 11140 · 28125 · 30200 · 11170 (15) | `/regions/31710/pet` · `/regions/50110/barrier-free` · `/regions/50130/barrier-free` · `/regions/11110/barrier-free` · `/regions/11140/barrier-free` | `/attractions/1580` 한라수목원 · `/attractions/5201` 덕수궁 · `/attractions/605` 대운산 · `/attractions/7542` 강릉 안목해맞이공원 |
| 빌드 | `/regions/11110` · `/` | — | `/attractions/2408` · `/attractions/5000` |

호스트는 모두 `https://place.1989v.com`. 공개 주소만 썼다(`/internal/**`·`rt.1989v.com` 없음).

## 사용자 검수가 필요한 점

1. **카테고리** — 블로그에 여행·데이터 해설용 카테고리가 없어 데이터 스토리는 `/tech/data`, 빌드 스토리는 `/tech` 로 뒀다. `/life` 아래 새 카테고리를 만들지는 사용자 판단(없는 path 는 INSERT 가 FK 로 막힌다).
2. **랜딩 목록 건수가 낡았다** — `portal-fe/src/content/place-landings.json` 의 `count` 는 2026-10-09(파서 v2) 값이다(종로구 free 68). 지금 같은 조건은 167건이다. 랜딩 화면은 실시간 목록이라 글과 어긋나지 않지만, 선정 스크립트를 다시 돌리면 선정 결과가 달라질 수 있다.
3. **속성 랜딩이 noindex** — 글의 「바로 가기」가 noindex 랜딩을 가리킨다. 랜딩 색인 스위치(ADR-0062 개정)가 승인되기 전에 게시하면 링크 가치는 지역 페이지로만 흐른다. 지역 페이지로 바꿀지 판단.
4. **「전남광주통합특별시」 표기** — 원천 시도명 그대로 썼다. 독자에게 낯설 수 있어 「전남(여수시)」처럼 줄일지 판단.
5. **hreflang 스위치 언급** — 빌드 스토리에 「스위치가 꺼져 있다」를 명시했다. 게시 전에 켜면 그 콜아웃을 지운다.
6. **반려동물 동반 쇼핑 편중** — 국문 전체로는 반려 동반 값이 9,663곳이지만 8,646곳이 쇼핑 분류다. 볼거리 4분류로 좁혀 846곳으로 썼다. 쇼핑을 포함한 수치를 원하면 다시 집계해야 한다.
7. **무장애 상세 수집 진행 중** — 상세는 하루 900콜 한도라 아직 안 받은 곳은 정보 없음으로 세어진다. 글에는 규칙으로만 적었다(진행률은 DB 를 읽어야 해서 재지 않았다).
8. **개념 매핑·DB 반영 안 함** — `blog_post_concept` 매핑과 hex INSERT 는 게시 때 `blog-post` 스킬 순서대로.

출처 표기: 각 글 마지막 줄에 TourAPI(공공누리 출처표시)·무장애 여행 정보(KorWithService2)·Google Places(`place_id`) 출처를 적었다.
