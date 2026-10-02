# Q3 — `searchStay2` · `areaBasedList2`(코스) 목록 행 필드

운영 키, 2026-10-02(KST). 표본: `sample-searchStay2-{ko,en}.json` · `sample-course-ko.json`.

## 필드 — 다른 것 없음

세 오퍼레이션의 목록 행 키 집합이 `areaBasedList2`(유형 32 · 80)와 **같다**(25개):

`addr1 addr2 areacode cat1 cat2 cat3 contentid contenttypeid cpyrhtDivCd createdtime firstimage firstimage2 lDongRegnCd lDongSignguCd lclsSystm1 lclsSystm2 lclsSystm3 mapx mapy mlevel modifiedtime sigungucode tel title zipcode`

- `searchStay2` ko 100행 · en 211행, `areaBasedList2` 32 ko · 80 en 각 20행, 코스 ko 100행의 키 합집합으로 비교했다.
- `searchFestival2` 만 키 넷이 더 있다: `eventstartdate` · `eventenddate` · `progresstype` · `festivaltype`. 표본에서 `progresstype`·`festivaltype` 은 전부 빈 문자열이다.
- 결론: Q3 기본안대로 목록 행 원문 컬럼에 행 전체를 싣는 것으로 충분하고, 지금 더할 파생 컬럼은 없다.

## 필드 밖에서 나온 것 — 수집 코드가 알아야 할 것

### 1. `searchStay2` 는 숙박 유형만 주지 않는다

| 서비스 | totalCount | 32/80 | 그 밖 |
|---|---:|---:|---|
| KorService2 | 2,990 | 2,925 (= `areaBasedList2` 32 의 totalCount) | 12: 61 · 28: 3 · 14: 1 |
| EngService2 | 211 | 208 (= `areaBasedList2` 80 의 totalCount) | 76: 2 · 85: 1 |

- 국문 유형 12 의 61건은 대부분 체험마을·한옥(`VE040200` 등)이다. 이 행들은 이미 유형 12 로 DB 에 있다(표본 7건 중 7건 존재 확인).
- 영문 유형 85 1건(`Deungchon SBS Open Hall`)은 **`contentid` 가 빈 문자열**이다. 그대로 정규화하면 contentId `""` 행이 bulk 에 들어가고 `@NotBlank` 검증으로 묶음 전체(최대 2,000건)가 400 이 된다.
- 영문 유형 80 1건(`Sono Calm Gyeongju`, 1251139)은 `mapx` 가 비어 좌표 제외 대상이다.
- 결정 필요(open-questions Q6): `searchStay2` 응답에서 유형 32·80 이 아닌 행을 버릴지, 유형대로 받을지. 받으면 같은 contentId 의 기존 행(유형 12 동기화가 쓴 것)을 숙박 경로가 덮는다 — 목록 행 원문이 숙박 응답으로 바뀌고 `category` 가 다시 계산된다.

### 2. 여행코스는 법정동 코드가 거의 없다

| 항목 | 건수 / 1,068 |
|---|---:|
| `lDongRegnCd` 빈 값 | 1,016 |
| 좌표 없음(`mapx`·`mapy` 빈 값 또는 0) | 68 |
| 대표 이미지 없음 | 1,025 |
| 신분류 1단계 | 전부 `C01`(2단계 C0112 337 · C0113 96 · C0114 449 · C0115 129 · C0116 37 · C0117 20) |

- 법정동이 빈 행은 지역 드릴다운·지역 허브의 지역 축에 들지 못한다. 좌표는 있으므로 반경 검색에는 나온다.
- 대표 이미지가 96% 비어 목록 카드가 거의 다 이미지 없이 그려진다.
- 결정 필요(open-questions Q7): 코스의 지역을 좌표로 역산할지, 코스 구성 첫 지점의 지역을 쓸지, 지역 축에서 빼고 둘지.

### 3. 영문 코스

`EngService2/areaBasedList2?contentTypeId=25` 의 totalCount 는 0 이다(스펙 SR-1 「코스는 영문 서비스에 유형이 없다」와 일치).
