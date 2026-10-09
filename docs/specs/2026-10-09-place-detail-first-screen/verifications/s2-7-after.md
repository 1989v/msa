# S2-7 재색인 후 대조 (기대값 표 ↔ 운영)

> `s2-7-expected.md` 의 「재색인 후 확인 명령」을 그대로 돌려 30곳을 id 별로 대조했다.

- 대상 확인: 운영 portal-fe·search·search-consumer·gateway·content 이미지 `0d7377f`, 번들 `index-Cm9QxGrC.js`(place·apex 같은 해시, index.html 에 `%2Fshared%2F` 1건). 재색인 Job `attraction-reindex-manual-1009`(이미지 `search-batch:0d7377f`) 03:31:55Z~03:36:46Z, 로그 `attribute parser v3`, `67435 docs, 0 errors`
- 측정 시각: **2026-10-09 12:38:13 KST**
- 응답에 `feeText` 키 있음(30/30) → 측정 유효

## 판정 요약

| 절 | 기대 | 결과 | 판정 |
|---|---|---|---|
| 1. 요금 칸 「정보 없음」 11건 | 11곳 `feeText` non-null, 첫머리 일치 | 11/11 non-null, 첫머리 일치 | **일치** |
| 2. 입장 UNKNOWN + 원문 무료 9건 | FREE 7 · PAID 1(4811) · UNKNOWN 1(13354) | FREE 7 · PAID 1 · UNKNOWN 1 | **일치** |
| 2. 9건 밖 변화 | 12933·12975·2961 → PAID | 셋 다 PAID | **일치** |
| 3. 휴무 빔 2건 | 77 `["MON"]`, 4811 null | 77 `["MON"]`, 4811 null | **일치** |
| 4. 안 바뀌는 19곳 | 지금 값 그대로 | 19/19 같음 | **일치** |

불일치 0건.

## id 별 결과

| id | 이름 | feeText 첫머리 | attrAdmission | closedWeekdays | 기대 대비 |
|---|---|---|---|---|---|
| 77 | 서울 운현궁 | 무료 | FREE | ["MON"] | 일치 |
| 12933 | 남한산성행궁 | [개인]⏎⏎- 일반 2,000원⏎⏎- 청소년 1,000원 … | PAID | ["MON"] | 일치(아래 비고) |
| 12975 | 건청궁 | - 개인 3,000원⏎⏎- 단체(10인 이상) 2,400원 | PAID | ["TUE"] | 일치 |
| 7545 | 안동 태사묘 | 무료 | FREE | null | 일치 |
| 11295 | 흥국사 | 무료 | FREE | null | 일치 |
| 4811 | 고양 서오릉 | - 개인 1,000원⏎- 단체(10인 이상) 800원 … | PAID | null | 일치 |
| 2961 | 광화문 | - 성인(만25세~만64세) 3,000원⏎- 외국인 … | PAID | ["TUE"] | 일치 |
| 2786 | 동십자각 | 무료 | FREE | null | 일치 |
| 10745 | 황학정 | 무료 | FREE | ["MON"] | 일치 |
| 6253 | 청와대칠궁 | 무료 | FREE | ["TUE"] | 일치 |
| 7861 | 경희궁 | 무료 | FREE | ["MON"] | 일치 |
| 13354 | K-컬처 스크린 | null | UNKNOWN | null | 일치(남는 건) |
| 11199 | 사충서원 | null | UNKNOWN | null | 일치 |
| 16151 | 국립고궁박물관 | 무료(useFee) | FREE | null | 일치 |
| 17693 | 대한민국역사박물관 | 무료(useFee) | FREE | null | 일치 |
| 49399 | 통의동 국빈관 | null | UNKNOWN | null | 일치 |
| 50108 | 라브리 | null | UNKNOWN | ["SAT","SUN"] | 일치 |
| 65340 | 스테이 데이 오프 | null | UNKNOWN | null | 일치 |
| 62502 | 서울 왕궁수문장 교대의식 | 무료(useFee) | FREE | null | 일치 |
| 8190 | 경희궁 숭정전 | null | UNKNOWN | ["MON"] | 일치 |
| 62392 | 국악공연 진연 | - 일반 65,000원- 장애인 50% 할인… (useFee) | PAID | null | 일치 |
| 62524 | 남산봉수의식 | 무료(useFee) | FREE | null | 일치 |
| 62399 | 페인터즈 | - VIP석 70,000원- R석 60,000원… (useFee) | PAID | null | 일치 |
| 53069 | 두가헌 레스토랑 | null | UNKNOWN | null | 일치 |
| 34067 | 견지동 불교용품거리 | null | UNKNOWN | null | 일치 |
| 65461 | 사사로이 | null | UNKNOWN | null | 일치 |
| 65532 | 효자스테이 | null | UNKNOWN | null | 일치 |
| 62527 | 2026 숭례문 파수의식 | 무료(useFee) | FREE | null | 일치 |
| 65482 | 자하 | null | UNKNOWN | null | 일치 |
| 62109 | DDP 건축투어 | - 일반 10,000원- 국가유공자 … (useFee) | PAID | null | 일치 |

`useFee` 있는 8곳(16151·17693·62502·62392·62524·62399·62527·62109)은 `feeText` = `useFee` 정규화 결과로 같다.

## 비고 — 빈 줄

12933·12975 의 `feeText` 는 줄 사이에 빈 줄이 하나씩 있다(`\n\n`). 원문이 `<br>\n` 이라 `<br>` → `\n` 과 원문 `\n` 이 겹친다.
`AttractionSeoText.EXTRA_NEWLINES` 는 `\n{3,}` → `\n\n` 이라 두 줄바꿈은 그대로 남는다. 기대값 표의 「6줄 + ※ 줄」 서술과 공백만 다르다.
기대값 표 판정 규칙(「공백 차이는 보지 않는다」)상 일치로 친다. 상세 SSR `<dd>` 에도 빈 줄이 그대로 나간다(`deploy-check.md` §2) — 표시를 좁히려면 별건이다.

## 명령과 결과 줄

```bash
for id in 77 12933 11199 12975 7545 11295 4811 13354 2961 16151 17693 49399 2786 50108 65340 \
          62502 8190 10745 62392 62524 6253 62399 7861 53069 34067 65461 65532 62527 65482 62109; do
  curl -s -m 20 "https://place.1989v.com/api/search/attractions/$id" -o d/$id.json; done
for f in d/*.json; do id=$(basename $f .json); jq -c --arg id "$id" '.data | {id: $id, title,
  useFee: ((.useFee // null)|if . then .[0:20] else . end),
  feeText: ((.feeText // null) | if . then .[0:40] else . end), attrAdmission, closedWeekdays, attrParking}' $f; done
```

```text
측정 2026-10-09 12:38:13 KST
{"id":"10745","title":"황학정","useFee":null,"feeText":"무료","attrAdmission":"FREE","closedWeekdays":["MON"],"attrParking":"YES"}
{"id":"11199","title":"사충서원","useFee":null,"feeText":null,"attrAdmission":"UNKNOWN","closedWeekdays":null,"attrParking":"YES"}
{"id":"11295","title":"흥국사","useFee":null,"feeText":"무료","attrAdmission":"FREE","closedWeekdays":null,"attrParking":"YES"}
{"id":"12933","title":"남한산성행궁","useFee":null,"feeText":"[개인]\n\n- 일반 2,000원\n\n- 청소년 1,000원\n\n[단체(30인","attrAdmission":"PAID","closedWeekdays":["MON"],"attrParking":"YES"}
{"id":"12975","title":"건청궁","useFee":null,"feeText":"- 개인 3,000원\n\n- 단체(10인 이상) 2,400원","attrAdmission":"PAID","closedWeekdays":["TUE"],"attrParking":"YES"}
{"id":"13354","title":"K-컬처 스크린","useFee":null,"feeText":null,"attrAdmission":"UNKNOWN","closedWeekdays":null,"attrParking":"YES"}
{"id":"16151","title":"국립고궁박물관","useFee":"무료","feeText":"무료","attrAdmission":"FREE","closedWeekdays":null,"attrParking":"UNKNOWN"}
{"id":"17693","title":"대한민국역사박물관","useFee":"무료","feeText":"무료","attrAdmission":"FREE","closedWeekdays":null,"attrParking":"UNKNOWN"}
{"id":"2786","title":"동십자각","useFee":null,"feeText":"무료","attrAdmission":"FREE","closedWeekdays":null,"attrParking":"NO"}
{"id":"2961","title":"광화문","useFee":null,"feeText":"- 성인(만25세~만64세) 3,000원\n- 외국인(만19세~64세) 3","attrAdmission":"PAID","closedWeekdays":["TUE"],"attrParking":"YES"}
{"id":"34067","title":"견지동 불교용품거리","useFee":null,"feeText":null,"attrAdmission":"UNKNOWN","closedWeekdays":null,"attrParking":"NO"}
{"id":"4811","title":"고양 서오릉 [유네스코 세계유산]","useFee":null,"feeText":"- 개인 1,000원\n- 단체(10인 이상) 800원\n- 지역주민 500","attrAdmission":"PAID","closedWeekdays":null,"attrParking":"YES"}
{"id":"49399","title":"통의동 국빈관","useFee":null,"feeText":null,"attrAdmission":"UNKNOWN","closedWeekdays":null,"attrParking":"NO"}
{"id":"50108","title":"라브리","useFee":null,"feeText":null,"attrAdmission":"UNKNOWN","closedWeekdays":["SAT","SUN"],"attrParking":"YES"}
{"id":"53069","title":"두가헌 레스토랑","useFee":null,"feeText":null,"attrAdmission":"UNKNOWN","closedWeekdays":null,"attrParking":"YES"}
{"id":"62109","title":"DDP 건축투어","useFee":"- 일반 10,000원- 국가유공자 ","feeText":"- 일반 10,000원- 국가유공자 / 군인 / 장애인 / 청소년 단체 ","attrAdmission":"PAID","closedWeekdays":null,"attrParking":"UNKNOWN"}
{"id":"62392","title":"국악공연 진연","useFee":"- 일반 65,000원- 장애인 50","feeText":"- 일반 65,000원- 장애인 50% 할인※ 무료 : 24개월 미만","attrAdmission":"PAID","closedWeekdays":null,"attrParking":"UNKNOWN"}
{"id":"62399","title":"페인터즈","useFee":"- VIP석 70,000원- R석 6","feeText":"- VIP석 70,000원- R석 60,000원- S석 50,000원","attrAdmission":"PAID","closedWeekdays":null,"attrParking":"UNKNOWN"}
{"id":"62502","title":"서울 왕궁수문장 교대의식","useFee":"무료","feeText":"무료","attrAdmission":"FREE","closedWeekdays":null,"attrParking":"UNKNOWN"}
{"id":"62524","title":"남산봉수의식 등 전통문화행사","useFee":"무료","feeText":"무료","attrAdmission":"FREE","closedWeekdays":null,"attrParking":"UNKNOWN"}
{"id":"62527","title":"2026 숭례문 파수의식","useFee":"무료","feeText":"무료","attrAdmission":"FREE","closedWeekdays":null,"attrParking":"UNKNOWN"}
{"id":"6253","title":"청와대칠궁","useFee":null,"feeText":"무료","attrAdmission":"FREE","closedWeekdays":["TUE"],"attrParking":"YES"}
{"id":"65340","title":"스테이 데이 오프","useFee":null,"feeText":null,"attrAdmission":"UNKNOWN","closedWeekdays":null,"attrParking":"NO"}
{"id":"65461","title":"사사로이","useFee":null,"feeText":null,"attrAdmission":"UNKNOWN","closedWeekdays":null,"attrParking":"NO"}
{"id":"65482","title":"자하","useFee":null,"feeText":null,"attrAdmission":"UNKNOWN","closedWeekdays":null,"attrParking":"NO"}
{"id":"65532","title":"효자스테이","useFee":null,"feeText":null,"attrAdmission":"UNKNOWN","closedWeekdays":null,"attrParking":"YES"}
{"id":"7545","title":"안동 태사묘","useFee":null,"feeText":"무료","attrAdmission":"FREE","closedWeekdays":null,"attrParking":"NO"}
{"id":"77","title":"서울 운현궁","useFee":null,"feeText":"무료","attrAdmission":"FREE","closedWeekdays":["MON"],"attrParking":"NO"}
{"id":"7861","title":"경희궁","useFee":null,"feeText":"무료","attrAdmission":"FREE","closedWeekdays":["MON"],"attrParking":"YES"}
{"id":"8190","title":"경희궁 숭정전","useFee":null,"feeText":null,"attrAdmission":"UNKNOWN","closedWeekdays":["MON"],"attrParking":"YES"}
```
