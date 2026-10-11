# 새 질의 후보 (SR-2 · SR-3 · SR-7)

2026-10-11 KST 10:01~10:07, 운영 색인 `attractions_20261010213013`(`_alias/attractions`). 조회는 `ssh msa-oci` 에서 검색 파드
encoder 컨테이너로 OpenSearch `_search`·`_count`·`_mget`(읽기), ClickHouse `--readonly=1`, place_db `SELECT` 만 썼다.
모든 행에 SR-2 형식 `evidence` 가 있고, 형식은 `live-eval.py` `check_format()` 이 판정한다(위반 0 — TG4 검증 줄 참고).

## 유형별 수 (SR-7 표 대비)

| 유형 | ko | en | SR-7 목표 |
|---|---|---|---|
| CONDITION | 12 | 4 | 12 / 4 |
| NATURAL | 10 | 6 | 10 / 6 |
| ALIAS | 10 | 8 | 10 / 8 |
| TYPO | 8 | 6 | 8 / 6 |
| NO_ANSWER | 8 | 6 | 8 / 6 |
| 운영 검색어 | 0 | 0 | 그때 수 |
| 계 | 48 | 30 | 78 |

## 2.1 운영 검색어 (SR-2 첫 행)

ClickHouse `analytics.events` `action='SEARCH'`: 95행, 검색어가 있는 행 8 · 서로 다른 검색어 5.
제외 — 시험 입력(`qzx…`·`probe…`) 3행 · 개인정보 정규식(숫자 6자리 이상·`@`·URL) **0건** · 한 방문자만 낸 것 2개(「게임」「궁」).
규칙을 통과한 것은 「하이브리드 검색」(UNIFIED_SEARCH, 방문자 2) 하나인데 관광지 검색어가 아니다(통합 검색의 비관광지 질의 — 스펙 Out of Scope).
**더한 운영 검색어 0.** 방문자 id 는 어디에도 남기지 않았다.

## 확인 기록
- CONDITION 조합 수는 그 언어 색인에서 `lang ∧ <속성>=<값> ∧ lclsSystm3=<코드>` `_count`. 모두 ≥5. 「반려동물 동반 캠핑장」(`AC050100` ALLOWED **1건**)은 5 미만이라 「반려동물 동반 공원」(`VE030100` 33건)으로 바꿨다.
- TYPO 는 `title.keyword` 정확 일치 + `title.en` 구문 일치 0 을 확인했다. 「musuem」(en)은 1건이 걸려 버리고 「watrefall」로 바꿨다.
- ALIAS `title:` 문서는 `_mget` 으로 제목을 확인했다(아래 표 비고). `romanize:` 은 그 문서의 영문 제목(개정 로마자)을 매큔-라이샤워로 옮기고 장음 부호·어깻점을 뺐다.
- NO_ANSWER ⓑ 는 분류 × 시도(`ldongRegnCd`) 집계 버킷에 그 시도가 없음을 확인. ⓐ 는 아래 「스펙과 다른 점」.
- 정규화(소문자·공백 제거) 중복 0 — 기존 150 과 서로.

## 스펙과 다른 점 (보고)
1. **ⓐ 국외 지명 출처** — place `regions` 에 국외 도시가 없다(`level='CITY' AND country_code<>'KR'` 0행, 국외는 `COUNTRY` 251행뿐, `name_ko` 도 비어 있다). 그래서 GeoNames `cities15000` 국외 도시 대신 **`regions` 의 국가 행**(geonames id 를 evidence 에 적음)을 쓰고, 국문 이름은 표준 외래어 표기로 옮겼다. 제목·현지 제목·주소 구문 일치 0 인 국가만 골랐다(「노르웨이」1 · 「핀란드」3 · 「스위스」10 · 「뉴질랜드」1 은 걸려서 뺐다).
2. **띄어쓰기 편집이 중복 규칙에 걸린다** — TG2.7 중복 판정이 공백을 지우므로 `edit:…:띄어쓰기`·`variant:…:띄어쓰기` 후보(「롯데 월드」「themepark」「cablecar」「비오는날 갈만한곳」「별보기 좋은 곳」)가 전부 원 질의와 같은 것으로 잡힌다. 다른 편집 종류로 바꿨고, 이번 세트에 띄어쓰기 종류는 없다.

## 후보 표

| 질의 | lang | intent | evidence |
|---|---|---|---|
| 주차 가능 해수욕장 | ko | CONDITION | `attr:attrParking=YES&lclsSystm3=NA020900:377` |
| 주차 가능 계곡 | ko | CONDITION | `attr:attrParking=YES&lclsSystm3=NA010400:216` |
| 주차 가능 사찰 | ko | CONDITION | `attr:attrParking=YES&lclsSystm3=HS030100:900` |
| 주차 가능 수목원 | ko | CONDITION | `attr:attrParking=YES&lclsSystm3=NA040700:192` |
| 입장 무료 박물관 | ko | CONDITION | `attr:attrAdmission=FREE&lclsSystm3=VE070100:284` |
| 입장 무료 미술관 | ko | CONDITION | `attr:attrAdmission=FREE&lclsSystm3=VE070600:156` |
| 입장 무료 전시관 | ko | CONDITION | `attr:attrAdmission=FREE&lclsSystm3=VE070300:292` |
| 반려동물 동반 해수욕장 | ko | CONDITION | `attr:petPolicy=ALLOWED&lclsSystm3=NA020900:32` |
| 반려동물 동반 수목원 | ko | CONDITION | `attr:petPolicy=ALLOWED&lclsSystm3=NA040700:14` |
| 반려동물 동반 공원 | ko | CONDITION | `attr:petPolicy=ALLOWED&lclsSystm3=VE030100:33` |
| 유모차 대여 박물관 | ko | CONDITION | `attr:attrStrollerRental=YES&lclsSystm3=VE070100:22` |
| 유모차 대여 테마파크 | ko | CONDITION | `attr:attrStrollerRental=YES&lclsSystm3=VE020100:6` |
| beach with parking | en | CONDITION | `attr:attrParking=YES&lclsSystm3=NA020900:127` |
| botanical garden with parking | en | CONDITION | `attr:attrParking=YES&lclsSystm3=NA040700:62` |
| free admission museum | en | CONDITION | `attr:attrAdmission=FREE&lclsSystm3=VE070100:67` |
| free admission art gallery | en | CONDITION | `attr:attrAdmission=FREE&lclsSystm3=VE070600:24` |
| 일몰 명소 | ko | NATURAL | `seed:intents.yml` |
| 설경 | ko | NATURAL | `seed:intents.yml` |
| 유아와 갈만한 곳 | ko | NATURAL | `seed:intents.yml` |
| 더운 날 실내 | ko | NATURAL | `seed:intents.yml` |
| 밤에 갈만한 곳 | ko | NATURAL | `seed:intents.yml` |
| 숲길 산책 | ko | NATURAL | `seed:intents.yml` |
| 아이랑 갈 만한 곳 | ko | NATURAL | `variant:아이와 갈만한 곳:조사` |
| 비 오는 날 가기 좋은 곳 | ko | NATURAL | `variant:비 오는 날 갈만한 곳:어미` |
| 부모님이랑 가기 좋은 곳 | ko | NATURAL | `variant:부모님과 가기 좋은 곳:조사` |
| 혼자서 여행 | ko | NATURAL | `variant:혼자 여행:조사` |
| rainy day indoor | en | NATURAL | `seed:intents.yml` |
| date spot | en | NATURAL | `seed:intents.yml` |
| scenic drive | en | NATURAL | `seed:intents.yml` |
| kids-friendly place | en | NATURAL | `variant:kids friendly place:띄어쓰기` |
| places to visit on a rainy day | en | NATURAL | `variant:place to visit on a rainy day:어미` |
| photo spots | en | NATURAL | `variant:photo spot:어미` |
| DDP | ko | ALIAS | `title:9856` |
| KSPO DOME | ko | ALIAS | `title:20878` |
| 관기재래시장 | ko | ALIAS | `title:34039` |
| 남대문 수입상가 | ko | ALIAS | `title:34535` |
| 너븐개 해안 | ko | ALIAS | `title:6493` |
| 용마공원 | ko | ALIAS | `title:6577` |
| 뮤지엄 | ko | ALIAS | `synonym:박물관` |
| 재래시장 | ko | ALIAS | `synonym:전통시장` |
| 유원지 | ko | ALIAS | `synonym:테마파크` |
| 한옥촌 | ko | ALIAS | `synonym:한옥마을` |
| hanbit tower | en | ALIAS | `title:1718` |
| jade cave | en | ALIAS | `title:13687` |
| mysterious road | en | ALIAS | `title:2371` |
| posco museum | en | ALIAS | `title:2145` |
| kyongbokkung | en | ALIAS | `romanize:21:mr` |
| pulguksa | en | ALIAS | `romanize:2178:mr` |
| chomsongdae | en | ALIAS | `romanize:13767:mr` |
| sokkuram | en | ALIAS | `romanize:2160:mr` |
| 해운데 | ko | TYPO | `edit:해운대:ㅐㅔ` |
| 전망데 | ko | TYPO | `edit:전망대:ㅐㅔ` |
| 독립기녕관 | ko | TYPO | `edit:독립기념관:받침` |
| 등때 | ko | TYPO | `edit:등대:된소리` |
| 케이블까 | ko | TYPO | `edit:케이블카:된소리` |
| 성산일춘봉 | ko | TYPO | `edit:성산일출봉:받침` |
| 순천마 | ko | TYPO | `edit:순천만:철자누락` |
| 할나산 | ko | TYPO | `edit:한라산:철자전치` |
| haeundea | en | TYPO | `edit:haeundae:철자전치` |
| watrefall | en | TYPO | `edit:waterfall:철자전치` |
| seoraksn | en | TYPO | `edit:seoraksan:철자누락` |
| seongsan ilchulbog | en | TYPO | `edit:seongsan ilchulbong:철자누락` |
| aquarim | en | TYPO | `edit:aquarium:철자누락` |
| botanical garedn | en | TYPO | `edit:botanical garden:철자전치` |
| 이집트 박물관 | ko | NO_ANSWER | `zero:regions#495(EG,geonames 357994) title/titleLocal/address phrase '이집트'=0 @2026-10-11T10:03+0900` |
| 멕시코 해수욕장 | ko | NO_ANSWER | `zero:regions#588(MX,geonames 3996063) title/titleLocal/address phrase '멕시코'=0 @2026-10-11T10:03+0900` |
| 페루 유적지 | ko | NO_ANSWER | `zero:regions#605(PE,geonames 3932488) title/titleLocal/address phrase '페루'=0 @2026-10-11T10:03+0900` |
| 제주 스키장 | ko | NO_ANSWER | `zero:lang=ko&lclsSystm3=LS010800&ldongRegnCd=50 =0 @2026-10-11T10:03+0900` |
| 서울 해수욕장 | ko | NO_ANSWER | `zero:lang=ko&lclsSystm3=NA020900&ldongRegnCd=11 =0 @2026-10-11T10:03+0900` |
| 대전 계곡 | ko | NO_ANSWER | `zero:lang=ko&lclsSystm3=NA010400&ldongRegnCd=30 =0 @2026-10-11T10:03+0900` |
| ㅁㄴㅇㄹ | ko | NO_ANSWER | `zero:nonsense` |
| ㅂㅈㄷㄱ | ko | NO_ANSWER | `zero:nonsense` |
| egypt museum | en | NO_ANSWER | `zero:regions#495(EG,geonames 357994) title.en/address.en phrase 'egypt'=0 @2026-10-11T10:03+0900` |
| mexico beach | en | NO_ANSWER | `zero:regions#588(MX,geonames 3996063) title.en/address.en phrase 'mexico'=0 @2026-10-11T10:03+0900` |
| jeju ski resort | en | NO_ANSWER | `zero:lang=en&lclsSystm3=LS010800&ldongRegnCd=50 =0 @2026-10-11T10:03+0900` |
| daejeon beach | en | NO_ANSWER | `zero:lang=en&lclsSystm3=NA020900&ldongRegnCd=30 =0 @2026-10-11T10:03+0900` |
| qwxzv | en | NO_ANSWER | `zero:nonsense` |
| zkvqjx | en | NO_ANSWER | `zero:nonsense` |
