# 판정 세트 v2 150 질의 — 의도 유형 라벨 (SR-1)

2026-10-11. 대상 `k8s/base/search-batch/eval/judgments-attractions-2026-10-05.json`. 질의 문자열만 보고 매겼다(검색 결과를 보지 않았다). 둘 이상에 걸리면 SR-1 표의 위쪽이 이긴다.
기존 항목은 `evidence: "v2"` · `graded_by: "v2"` 를 단다. `source` 는 그대로 둔다.

## 유형별 수

| intent | ko | en | 계 |
|---|---|---|---|
| NO_ANSWER | 0 | 0 | 0 |
| TYPO | 3 | 1 | 4 |
| ALIAS | 0 | 0 | 0 |
| CONDITION | 2 | 2 | 4 |
| NATURAL | 24 | 18 | 42 |
| NAME | 15 | 8 | 23 |
| REGION_TYPE | 10 | 6 | 16 |
| CATEGORY | 36 | 25 | 61 |
| 계 | 90 | 60 | 150 |

CONDITION 4 질의는 SR-4.4 재채점 대상 넷(「반려견과 함께 갈 수 있는 곳」「무료로 볼 수 있는 곳」「pet friendly」「free admission」)과 같다.

## 판단 기준으로 정한 것
- 「야경·일출·노을·벚꽃·단풍·밤바다」는 원천 분류 코드에 없는 시간대·계절·경관 뜻이라 NATURAL 로 둔다. 지역이 붙어도(「서울 야경」「여수 밤바다」) NATURAL 이 REGION_TYPE 보다 위다.
- 「전주 한옥마을」「대구 근대골목」은 지역+분류 꼴이지만 장소 하나의 고유명이라 NAME.
- 「서울 근교 드라이브」는 「드라이브」「근교」가 분류 코드가 아닌 상황이라 NATURAL.
- 「전통시장 먹거리」「꽃 축제」「한복 대여」「드라마 촬영지」는 조건·상황 없이 종류만 말하므로 CATEGORY.
- 「캠핑」「글램핑」은 SR-1 이 명시한 대로 분류 이름 변형 → CATEGORY.

## 전체 표

| 질의 | lang | source | intent | 판단 근거 |
|---|---|---|---|---|
| 궁궐 | ko | 2026-09-13 | CATEGORY | 분류 이름 단독 |
| 한옥 | ko | 2026-09-13 | CATEGORY | 분류 이름 단독 |
| 해수욕장 | ko | 2026-09-13 | CATEGORY | 분류 이름 단독 |
| 경복궁 | ko | 2026-09-13 | NAME | 장소 하나 |
| 바다가 보이는 곳 | ko | 2026-09-13 | NATURAL | 경관을 문장으로 — 원천 필드 없음 |
| 아이와 갈만한 곳 | ko | 2026-09-13 | NATURAL | 동반자 |
| 조용한 사찰 | ko | 2026-09-13 | NATURAL | 분위기(조용한)+분류 — NATURAL 이 위 |
| 야경 명소 | ko | 2026-09-13 | NATURAL | 애매: 야경은 원천 분류에 없는 시간대·경관 뜻 → CATEGORY 아닌 NATURAL |
| 벚꽃 명소 | ko | 2026-09-13 | NATURAL | 계절 |
| 단풍 명소 | ko | 2026-09-13 | NATURAL | 계절 |
| 온천 | ko | 2026-09-13 | CATEGORY | 분류 이름 단독 |
| 캠핑장 | ko | 2026-09-13 | CATEGORY | 분류 이름 단독 |
| 케이블카 | ko | 2026-09-13 | CATEGORY | 분류 이름 단독 |
| 등산 코스 | ko | 2026-09-13 | CATEGORY | 분류(등산로) 이름 변형 |
| 야시장 | ko | 2026-09-13 | CATEGORY | 분류 이름 단독 |
| 전통시장 먹거리 | ko | 2026-09-13 | CATEGORY | 애매: 분류(전통시장)+대상(먹거리), 조건·상황 없음 → CATEGORY |
| 서울 근교 드라이브 | ko | 2026-09-13 | NATURAL | 애매: 지역+활동. 「드라이브」「근교」는 분류 코드가 아닌 상황 → REGION_TYPE 아닌 NATURAL(위쪽 우선) |
| 비 오는 날 갈만한 곳 | ko | 2026-09-13 | NATURAL | 상황(날씨) |
| 실내 놀거리 | ko | 2026-09-13 | NATURAL | 실내 여부는 원천 필드 없음 |
| 미술관 | ko | 2026-09-13 | CATEGORY | 분류 이름 단독 |
| 한복 대여 | ko | 2026-09-13 | CATEGORY | 시설·서비스 종류 단독 |
| 드라마 촬영지 | ko | 2026-09-13 | CATEGORY | 장소 종류 단독(촬영지) |
| 일출 명소 | ko | 2026-09-13 | NATURAL | 시간대·경관 |
| 섬 여행 | ko | 2026-09-13 | CATEGORY | 분류(섬) 단독 |
| palace in seoul | en | 2026-09-13 | REGION_TYPE | 지역+분류 |
| beach near busan | en | 2026-09-13 | REGION_TYPE | 지역+분류 |
| quiet temple | en | 2026-09-13 | NATURAL | 분위기+분류 |
| night view | en | 2026-09-13 | NATURAL | 야경 — ko 「야경 명소」와 같은 판단 |
| kids friendly place | en | 2026-09-13 | NATURAL | 동반자 — 원천 필드 없음(유모차 대여와 다름) |
| hot spring | en | 2026-09-13 | CATEGORY | 분류 |
| cherry blossom spots | en | 2026-09-13 | NATURAL | 계절 |
| autumn foliage | en | 2026-09-13 | NATURAL | 계절 |
| sunrise viewpoint | en | 2026-09-13 | NATURAL | 시간대·경관 |
| traditional market food | en | 2026-09-13 | CATEGORY | ko 「전통시장 먹거리」와 같은 판단 |
| hanok village | en | 2026-09-13 | CATEGORY | 분류 |
| art museum | en | 2026-09-13 | CATEGORY | 분류 |
| cable car | en | 2026-09-13 | CATEGORY | 분류 |
| hiking trail | en | 2026-09-13 | CATEGORY | 분류 |
| island trip | en | 2026-09-13 | CATEGORY | 분류(섬) |
| camping site | en | 2026-09-13 | CATEGORY | 분류 |
| indoor activities | en | 2026-09-13 | NATURAL | 실내 — 원천 필드 없음 |
| place to visit on a rainy day | en | 2026-09-13 | NATURAL | 상황(날씨) |
| ocean view | en | 2026-09-13 | NATURAL | 경관 |
| drama filming location | en | 2026-09-13 | CATEGORY | 장소 종류 |
| night market | en | 2026-09-13 | CATEGORY | 분류 |
| hanbok rental | en | 2026-09-13 | CATEGORY | 시설·서비스 종류 |
| scenic drive near seoul | en | 2026-09-13 | NATURAL | ko 「서울 근교 드라이브」와 같은 판단 |
| waterfall | en | 2026-09-13 | CATEGORY | 분류 |
| 폭포 | ko | 분류 | CATEGORY | 분류 이름 단독 |
| 동굴 | ko | 분류 | CATEGORY | 분류 이름 단독 |
| 수목원 | ko | 분류 | CATEGORY | 분류 이름 단독 |
| 계곡 | ko | 분류 | CATEGORY | 분류 이름 단독 |
| 자연휴양림 | ko | 분류 | CATEGORY | 분류 이름 단독 |
| 테마파크 | ko | 분류 | CATEGORY | 분류 이름 단독 |
| 동물원 | ko | 분류 | CATEGORY | 분류 이름 단독 |
| 수족관 | ko | 분류 | CATEGORY | 분류 이름 단독 |
| 전망대 | ko | 분류 | CATEGORY | 분류 이름 단독 |
| 스키장 | ko | 분류 | CATEGORY | 분류 이름 단독 |
| 래프팅 | ko | 분류 | CATEGORY | 분류 이름 단독 |
| 템플스테이 | ko | 분류 | CATEGORY | 분류 이름 단독 |
| 박물관 | ko | 분류 | CATEGORY | 분류 이름 단독 |
| 출렁다리 | ko | 분류 | CATEGORY | 분류 이름 단독 |
| 둘레길 | ko | 분류 | CATEGORY | 분류 이름 단독 |
| 오름 | ko | 분류 | CATEGORY | 분류 이름 단독 |
| 고택 | ko | 분류 | CATEGORY | 분류 이름 단독 |
| 등대 | ko | 분류 | CATEGORY | 분류 이름 단독 |
| 생태공원 | ko | 분류 | CATEGORY | 분류 이름 단독 |
| 민속마을 | ko | 분류 | CATEGORY | 분류 이름 단독 |
| 부산 해수욕장 | ko | 지역×유형 | REGION_TYPE | 지역+분류 |
| 제주 오름 | ko | 지역×유형 | REGION_TYPE | 지역+분류 |
| 경주 유적지 | ko | 지역×유형 | REGION_TYPE | 지역+분류 |
| 전주 한옥마을 | ko | 지역×유형 | NAME | 애매: 「전주한옥마을」은 장소 하나의 고유명 → NAME 이 REGION_TYPE 보다 위 |
| 서울 야경 | ko | 지역×유형 | NATURAL | 애매: 지역+야경 — 「야경 명소」와 같은 판단, NATURAL 이 위 |
| 여수 밤바다 | ko | 지역×유형 | NATURAL | 애매: 지역+밤바다(시간대·경관) → NATURAL |
| 강원도 계곡 | ko | 지역×유형 | REGION_TYPE | 지역+분류 |
| 인천 섬 | ko | 지역×유형 | REGION_TYPE | 지역+분류 |
| 대구 근대골목 | ko | 지역×유형 | NAME | 애매: 「대구 근대골목」은 고유 관광지명 → NAME |
| 제주 박물관 | ko | 지역×유형 | REGION_TYPE | 지역+분류(국립제주박물관 하나로 좁히지 않음) |
| 서울 궁궐 | ko | 지역×유형 | REGION_TYPE | 지역+분류 |
| 강릉 해변 | ko | 지역×유형 | REGION_TYPE | 지역+분류 |
| 가평 캠핑 | ko | 지역×유형 | REGION_TYPE | 지역+분류 |
| 충남 사찰 | ko | 지역×유형 | REGION_TYPE | 지역+분류 |
| 불국사 | ko | 고유명 | NAME | 장소 하나 |
| 해운대 | ko | 고유명 | NAME | 장소 하나 |
| 성산일출봉 | ko | 고유명 | NAME | 장소 하나 |
| 남이섬 | ko | 고유명 | NAME | 장소 하나 |
| 설악산 | ko | 고유명 | NAME | 장소 하나 |
| 한라산 | ko | 고유명 | NAME | 장소 하나 |
| 감천문화마을 | ko | 고유명 | NAME | 장소 하나 |
| 북촌한옥마을 | ko | 고유명 | NAME | 장소 하나 |
| 남산서울타워 | ko | 고유명 | NAME | 장소 하나 |
| 순천만 | ko | 고유명 | NAME | 장소 하나 |
| 독립기념관 | ko | 고유명 | NAME | 장소 하나 |
| 롯데월드 | ko | 고유명 | NAME | 장소 하나 |
| 데이트 코스 | ko | 의도 | NATURAL | 동반자·상황 |
| 반려견과 함께 갈 수 있는 곳 | ko | 의도 | CONDITION | 원천 petAcmpyType — 조건만 있는 질의(SR-4.4 재채점 대상) |
| 부모님과 가기 좋은 곳 | ko | 의도 | NATURAL | 동반자 |
| 무료로 볼 수 있는 곳 | ko | 의도 | CONDITION | 원천 attrAdmission — 조건만 있는 질의(SR-4.4 재채점 대상) |
| 사진 찍기 좋은 곳 | ko | 의도 | NATURAL | 분위기·상황 |
| 겨울 여행지 | ko | 의도 | NATURAL | 계절 |
| 여름 물놀이 | ko | 의도 | NATURAL | 계절+활동 |
| 걷기 좋은 길 | ko | 의도 | NATURAL | 문장으로 말한 분위기(좋은) |
| 역사 체험 | ko | 의도 | NATURAL | 활동을 말함 — 분류 코드 아님 |
| 아이 체험 학습 | ko | 의도 | NATURAL | 동반자+활동 |
| 혼자 여행 | ko | 의도 | NATURAL | 동반자(혼자) |
| 노을 명소 | ko | 의도 | NATURAL | 시간대·경관 |
| 꽃 축제 | ko | 의도 | CATEGORY | 애매: 행사 종류(꽃 축제) 단독 → CATEGORY. 계절 뜻은 질의에 없음 |
| 별 보기 좋은 곳 | ko | 의도 | NATURAL | 상황·분위기 |
| 조용한 바다 | ko | 의도 | NATURAL | 분위기 |
| 해수욕쟝 | ko | 표기 | TYPO | 해수욕장 편집 1회 |
| 경복굼 | ko | 표기 | TYPO | 경복궁 받침 편집 |
| 불국싸 | ko | 표기 | TYPO | 불국사 된소리 |
| 캠핑 | ko | 표기 | CATEGORY | 분류 이름 변형(SR-1 명시) |
| 글램핑 | ko | 표기 | CATEGORY | 분류 이름 변형(SR-1 명시) |
| waterfall hike | en | category | CATEGORY | 분류 이름 단독 |
| cave | en | category | CATEGORY | 분류 이름 단독 |
| botanical garden | en | category | CATEGORY | 분류 이름 단독 |
| valley | en | category | CATEGORY | 분류 이름 단독 |
| theme park | en | category | CATEGORY | 분류 이름 단독 |
| zoo | en | category | CATEGORY | 분류 이름 단독 |
| aquarium | en | category | CATEGORY | 분류 이름 단독 |
| observatory | en | category | CATEGORY | 분류 이름 단독 |
| ski resort | en | category | CATEGORY | 분류 이름 단독 |
| temple stay | en | category | CATEGORY | 분류 이름 단독 |
| museum | en | category | CATEGORY | 분류 이름 단독 |
| folk village | en | category | CATEGORY | 분류 이름 단독 |
| busan beach | en | region | REGION_TYPE | 지역+분류 |
| jeju oreum | en | region | REGION_TYPE | 지역+분류 |
| gyeongju historic site | en | region | REGION_TYPE | 지역+분류 |
| jeonju hanok village | en | region | NAME | ko 「전주 한옥마을」과 같은 판단 |
| seoul night view | en | region | NATURAL | ko 「서울 야경」과 같은 판단 |
| yeosu night sea | en | region | NATURAL | ko 「여수 밤바다」와 같은 판단 |
| gangneung beach | en | region | REGION_TYPE | 지역+분류 |
| bulguksa temple | en | name | NAME | 장소 하나 |
| haeundae | en | name | NAME | 장소 하나 |
| seongsan ilchulbong | en | name | NAME | 장소 하나 |
| nami island | en | name | NAME | 장소 하나 |
| seoraksan | en | name | NAME | 장소 하나 |
| gamcheon culture village | en | name | NAME | 장소 하나 |
| n seoul tower | en | name | NAME | 장소 하나 |
| date course | en | intent | NATURAL | 동반자·상황 |
| pet friendly | en | intent | CONDITION | 원천 petAcmpyType(영문 값 0) — 조건만(SR-4.4 재채점 대상) |
| free admission | en | intent | CONDITION | 원천 attrAdmission — 조건만(SR-4.4 재채점 대상) |
| photo spot | en | intent | NATURAL | 분위기·상황 |
| winter trip | en | intent | NATURAL | 계절 |
| walking trail | en | intent | CATEGORY | 분류(걷기길) — ko 「걷기 좋은 길」과 달리 형용 없음 |
| history experience | en | intent | NATURAL | ko 「역사 체험」과 같은 판단 |
| sunset spot | en | intent | NATURAL | 시간대·경관 |
| stargazing | en | intent | NATURAL | 활동·상황 |
| gyeongbokgoong | en | typo | TYPO | gyeongbokgung 철자 편집(SR-1 예) |
