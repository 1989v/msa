# 배포 뒤 확인 — 상세 첫 화면

- 배포: 커밋 `0d7377f93`, 이미지 `0d7377f`(portal-fe·search·search-consumer·gateway·content), 2026-10-09 12:31 KST 롤아웃. 수동 재색인 `attraction-reindex-manual-1009` 12:31:55~12:36:46 KST(`attribute parser v3`, `67435 docs, 0 errors`)
- 방법: curl·python 만(브라우저 없음), GET 만
- 측정 대상 최신 여부: place.1989v.com 번들 `/assets/index-Cm9QxGrC.js`(last-modified 03:18:58 GMT = 12:18 KST 빌드), 운영 Deployment 이미지 `portal-fe:0d7377f`. 상세 SSR 에 이번에 넣은 `data-place-section="visit-summary"` 있음 → 유효

## 판정 요약

| 항목 | 결과 | 판정 |
|---|---|---|
| S2-7 30곳 기대값 대조 | 불일치 0 (`s2-7-after.md`) | 통과 |
| API 응답 필드 `feeText`·`source`·`copyrightDivCd`·`petAcmpyType` | 30/30 키 있음. `source` 30/30 = TOURAPI, `copyrightDivCd` 25/30 값 있음(Type1·Type3), `petAcmpyType` 1/30 값 있음(65532 「전구역 동반가능」) | 통과 |
| SSR 방문 요약 `<dl>` 7칸 | 일반 유형 표본 8곳(국 6·영 2) 모두 `dt` 7개, 칸 순서 = SR-2.1 표 | 통과 |
| JSON-LD `image` = ImageObject | 표본 8곳 모두 `@type: ImageObject`, `creditText` 한국관광공사, `license` 가 `copyrightDivCd` 와 맞음(Type1 → licenseType1, Type3 → licenseType3) | 통과 |

## 1. API 응답 필드

```bash
for f in d/*.json; do jq -c '.data|{id,source,copyrightDivCd,petAcmpyType,alternateId,contentUpdatedAt,lang}' $f; done
jq '.data|keys' d/77.json
```

```text
(2026-10-09 12:38 KST, 30곳 중 발췌)
{"id":"77","source":"TOURAPI","copyrightDivCd":"Type1","petAcmpyType":null,...}
{"id":"12933","source":"TOURAPI","copyrightDivCd":"Type3","petAcmpyType":null,...}
{"id":"50108","source":"TOURAPI","copyrightDivCd":null,"petAcmpyType":null,...}
{"id":"65532","source":"TOURAPI","copyrightDivCd":null,"petAcmpyType":"전구역 동반가능",...}
keys: [... "copyrightDivCd", ..., "feeText", ..., "petAcmpyType", ..., "source", ...]
```

`copyrightDivCd` null 5곳(50108·53069·65461·65482·65532)은 원천에 값이 없는 행이다 — 이 경우 JSON-LD `license` 를 넣지 않는 규칙(SR-3.5)이 적용될 자리다.

## 2. 상세 SSR 표본

```bash
for id in 77 12933 4811 16151 7861 2961 2180 14206; do
  curl -s -m 20 -o ssr/$id.html https://place.1989v.com/attractions/$id; done
python3 -I ssr.py ssr/*.html   # <dl data-place-section="visit-summary"> 의 dt/dd, ld+json 의 image, hreflang 수
```

```text
(2026-10-09 12:41:35 KST, 모두 200)
ssr/77.html    dl True dt 7 ['요금','이용시간','쉬는 날','주차','반려동물','무장애','확인 상태']  dd0 무료
   jsonld image [('TouristAttraction', {'@type':'ImageObject','license':'https://www.kogl.or.kr/info/licenseType1.do','creditText':'한국관광공사'})]
ssr/12933.html dl True dt 7 [...같은 7칸]  dd0 [개인]⏎⏎- 일반 2,000원⏎⏎- 청소년 1,000원⏎⏎…
   jsonld image ImageObject licenseType3
ssr/4811.html  dl True dt 7  dd0 - 개인 1,000원⏎- 단체(10인 이상) 800원⏎- 지역주민 500원⏎※ 무료 : 만 …   ImageObject licenseType1
ssr/16151.html dl True dt 7  dd0 무료   ImageObject licenseType1
ssr/7861.html  dl True dt 7  dd0 무료   ImageObject licenseType1
ssr/2961.html  dl True dt 7  dd0 - 성인(만25세~만64세) 3,000원⏎- 외국인(만19세~64세) 3,000원⏎※ 자세 …   ImageObject licenseType3
ssr/2180.html  dl True dt 7 ['Admission','Hours','Closed','Parking','Pets','Accessibility','Data status']  dd0 Not provided   ImageObject licenseType3
ssr/14206.html dl True dt 7 [...영문 7칸]  dd0 Not provided   ImageObject licenseType3
반려동물 dd (국문 6곳): 모두 「정보 없음」
```



- 절 순서(`data-place-section`): 일반 유형은 `visit-summary → (visit-badges) → actions → barrier-free → same-category-nearby → related → source`. 12933 은 배지 줄이 있어 `visit-badges` 가 `<dl>` 바로 뒤에 나온다.
- 숙박(65532, contentTypeId 32)은 `visit-summary` 가 없고 `stay` 절이 나간다. JSON-LD 는 `LodgingBusiness` 이고 `image` 키가 없다 — 이 행은 `imageUrl`·`thumbnailUrl` 이 null 이다. 방문 요약은 일반 유형 대상(U2)이라 표본에서 뺐다.
- 관찰: 12933 요금 `<dd>` 에 빈 줄이 그대로 나간다(원문 `<br>\n` 이 `\n\n` 이 되고 `EXTRA_NEWLINES` 는 3줄 이상만 줄인다). 규칙대로의 결과이고, 화면에서 줄 간격이 넓어 보일 수 있다 — 별건 판단.
