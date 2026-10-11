# 탐침 12 — 단계 1(`mode=OFF`) 운영 기록 (SR-7.1, TG6.0·6.4)

측정 시각 **2026-10-11 20:08 KST**. 공개 API GET 만 했고 쓰기는 없다.

## 측정 시점 운영 상태

| 항목 | 값 | 읽은 곳 |
|---|---|---|
| search 이미지 | `search:0a8afc3` | `ssh msa-oci "sudo kubectl -n commerce get deploy search -o jsonpath=…image"` |
| `SEARCH_ATTRACTION_*` env | `SEARCH_ATTRACTION_HYBRID_ENABLED=true` 하나뿐. 근거 모드·조건어 스위치 env 없음 → 코드 기본값(`OFF`·`true`) | 같은 deploy 의 `env` |
| 별칭 `attractions` → 색인 | `attractions_20261011044641`(67,440 문서, 생성 2026-10-11 13:46 KST) | `_alias/attractions*` · `_cat/indices` (opensearch-0 안 curl) |
| 품사 필터 | 색인 설정에 `search_pos_stop`(`nori_part_of_speech`, stoptags `EP EF EC ETN ETM JKS JKC JKG JKO JKB JKV JKQ JX JC`)이 있고, `nori_search` = `search_pos_stop` → `tourism_synonyms` | `_settings?filter_path=**.analysis` |
| 「아이랑 갈 만한 곳」 검색 분석 | `아이 · 가 · 만 · 하 · 곳` — `랑`·`ᆯ`·`ᆫ` 이 빠진다 | `_analyze {"analyzer":"nori_search",…}` |

`_analyze` 를 `"field":"title"` 로 부르면 **색인 분석기(`nori_analyzer`)** 가 돌아 `랑` 이 남는다. 검색 쪽 확인은 `analyzer: nori_search` 로 해야 한다(TG6.3 의 「`field: title`」 확인 문구는 이 점에서 틀린다).

## 명령

```
# 응답 필드 이름 확인(먼저 한 번 찍음): data.{totalElements, zeroReason, correctedKeyword, interpretedConditions[{param,value,phrase}], attractions[].{id,title,attrParking,petPolicy}}
GET https://place.1989v.com/api/search/attractions?keyword=<q>&lang=<ko|en>&size=10&page=0&sort=relevance&nc=<난수>
  UA: "Mozilla/5.0 … msa-eval"  (응답 헤더 cf-cache-status: DYNAMIC 확인)
# 「전 결과」 두 줄은 size=100 으로 totalPages 까지 전부 받아 필드 분포를 셈
```

## 결과

| 탐침 | lang | 기대(단계 1) | totalElements | zeroReason | interpretedConditions | top-5 (id 제목) | 판정 |
|---|---|---|---|---|---|---|---|
| 에펠탑 | ko | 기록만 | 786 | null | [] | 12978 충렬탑 · 4957 탑선리석탑 · 7744 여주 현충탑 · 437 광주 경찰충혼탑 · 316 충혼탑 | 기록 |
| 디즈니랜드 | ko | 기록만 | 337 | null | [] | 314 디즈니스토어 현대프리미엄아울렛 대전점 · 1203 유교랜드 · 10572 산정랜드 · 746 서울랜드 · 10154 쥬라기랜드 | 기록 |
| ㅁㄴㅇㄹ | ko | 0 · `NO_CONTENT` | 0 | `NO_CONTENT` | [] | — | 일치 |
| eiffel tower | en | 기록만 | 198 | null | [] | 13650 Jindo Tower · 1718 Tower of Great Light (Hanbit Tower) · 14328 Lotte World Tower & Mall · 14150 Busan Tower · 1765 E-World 83 Tower | 기록 |
| qwxzv | en | 기록만 | 0 | null | [] | — | 기록 |
| 도쿄 수족관 | ko | msm `_count` 고정(아래) | **0** | null | [] | — | 기록 — 라이브는 이미 0. 원인 미확인(아래) |
| 주차 되는 해수욕장 | ko | parking · 전 결과 `attrParking=YES` | 100 | null | `parking=YES`(「주차 되는」) | 4675 금능해수욕장 · 12807 사곡해수욕장 · 10192 용한 1리 해수욕장 · 4179 신덕해수욕장 · 834 노봉해변 | 일치 — 100/100 `YES` |
| 반려견과 함께 갈 수 있는 곳 | ko | pet · 전 결과 `petPolicy ∈ {ALLOWED, PARTIAL}` | 100 | null | `pet=ALLOWED,PARTIAL`(「반려견과 함께」) | 6128 강아지숲 · 13320 삼막애견공원 · 13250 PTP 애견테마파크 · 7349 일산호수공원 반려견놀이터 · 5673 양지파인펫파크 | 일치 — ALLOWED 48 · PARTIAL 52 |
| 아이랑 갈 만한 곳 | ko | top-5 에 「아이」로 시작하는 상호 없음 | 1,326 | null | [] | 6202 **아이아이 연남** · 15671 **아이와즈** · 5922 **아이러브팜핑** · 13316 와글아이 · 6857 밀양 우리아이마음숲놀이터 | **불일치 — 3건** |
| 아이와 갈만한 곳 | ko | 같음 | 1,287 | null | [] | 6202 **아이아이 연남** · 15671 **아이와즈** · 13316 와글아이 · 6857 밀양 우리아이마음숲놀이터 · 5682 포레스트벨 | **불일치 — 2건** |
| 해수욕장 | ko | top-5 기준 id 고정 | 100 | null | [] | 4479 변산해수욕장 · 8721 광암해수욕장 · 9362 협재해수욕장 · 12806 옥계해수욕장 · 12807 사곡해수욕장 | 기준 id 고정 |
| 경복궁 | ko | top-5 기준 id 고정 | 266 | null | [] | 1 경복궁 · 8654 창경궁 · 7861 경희궁 · 9640 한복남 경복궁점 · 5484 궁집 | 기준 id 고정 |

**기준 id(단계 2·3 에서 top-5 중 4개 이상 유지)**
- 해수욕장: `4479, 8721, 9362, 12806, 12807`
- 경복궁: `1, 8654, 7861, 9640, 5484`

## 기대와 다른 것

1. **「아이랑 갈 만한 곳」「아이와 갈만한 곳」** — 품사 필터가 든 색인(`랑` 이 검색 분석에서 빠짐)인데도 top-5 에 「아이」로 시작하는 상호가 3건·2건 남는다. 남은 토큰 `아이` 가 `title^3` 에 맞는 것이 원인으로 보인다. 조사 제거만으로는 이 탐침을 통과시키지 못한다 — 스펙 기대(SR-7.1)와 SR-1(불용구 창)·SR-2 설계를 다시 봐야 한다.
2. **「도쿄 수족관」** — 라이브가 `OFF` 에서 이미 0건이고 `zeroReason` 은 null 이다. `exact=true`·`keepConditionWords=true`·`sort=popularity` 로 바꿔도 0. 같은 시각 「수족관」 단독은 20건(대구·대전·단양 아쿠아리움), 「도쿄」 단독은 10건이다. 레포의 `search/` 에 「수족관」 규칙 문자열은 없다. 0건이 되는 경로는 확인하지 못했다. 반면 msm `2<75%` `_count` 는 98 이라(`approx-measurement.md` 끝 절) 단계 2 `GATE` 의 근거 검사는 이 질의를 막지 않는다.

원 응답은 세션 스크래치패드 `probe/stage1-raw.json` 에 있다(레포에 두지 않음).
