# 속성 랜딩 선정 실행 기록

`portal-fe/src/content/place-landings.json` 을 만든 실행이다. 같은 명령을 다시 돌리면 그 시점의 색인으로 다시 고르고, 기존 항목은 지우지 않는다(안 뽑히면 `retired`).

## 실행

| 항목 | 값 |
|---|---|
| 명령 | `cd portal-fe && node scripts/select-place-landings.mjs` |
| 실행 시각 | 2026-10-09 04:52:17 ~ 04:58:30 KST (약 6분) |
| API | `https://api.1989v.com` (`SEO_API_ORIGIN` 미지정 기본값 — 프리렌더와 같은 출처), GET 만 |
| 요청 간격 | 250ms, 순차(동시 요청 없음) |
| 호출 수 | 900회 (행정구역 34 + facet 질의 507 + 필터 질의 359) |
| 결과 | exit 0, facet `null` 0건(재실행 없음), 은퇴 0 |
| 이전 목록 | 없음(첫 생성) |

호출 수 내역은 로그 수치에서 나온다: 행정구역 = 언어 2 × (시도 1 + 시도 16 개의 시군구 목록) = 34, facet 질의 = 시군구 257 + 250 = 507, 필터 질의 = 예비 후보 284 + 75 = 359. 이 밖에 응답 모양 확인 2회와 아래 표의 지역 이름 조회 8회를 손으로 불렀다.

## 조건

| 조건 | 값(`copy.mjs`) |
|---|---|
| 분류 필터 | `category=nature,history,culture,leisure` (`SIGHT_CATEGORIES`) — 모든 질의 |
| 모집단 | 언어별 `administrative-regions` 시군구 행 중 `attractionCount > 0` (지역 프리렌더와 같은 범위) |
| 예비 후보 | facet 건수(`parking.YES`·`pet.ALLOWED`·`barrierFree.WHEELCHAIR`·`admission.FREE`) ≥ 10 |
| N | 필터 질의(`size=30`, `sort=relevance`)의 `totalElements` |
| 하한 · 속성당 · 합산 · Jaccard | 10 · 5 · 20 · 0.5 |
| 영문 속성 | `parking`·`free` 만 |

## 실행 로그

```
[landings] ko: 시군구 257 · 예비 후보 284
[landings] en: 시군구 250 · 예비 후보 75
[landings] ko: 선정 15 (parking 5 · pet 1 · barrier-free 4 · free 5)
[landings] en: 선정 5 (parking 5 · pet 0 · barrier-free 0 · free 0)
[landings] 제외 사유: {"lang":0,"population":0,"belowMin":0,"perAttr":316,"total":23,"jaccard":0}
[landings] 은퇴 0 · 전체 항목 20 · 호출 900회 (https://api.1989v.com)
```

제외 사유 읽는 법: `perAttr` 는 그 언어·속성이 이미 5건 찬 뒤의 후보, `total` 은 합산 20건이 찬 뒤의 후보다. `belowMin` 0 은 facet 으로 거른 예비 후보의 필터 질의 건수가 모두 하한 이상이었다는 뜻이다.

## 선정 결과 (20건)

| 언어 | 코드 | 지역 | 속성 | N | jaccardMax |
|---|---|---|---|---|---|
| ko | 50110 | 제주 제주시 | parking | 266 | 0 |
| ko | 50130 | 제주 서귀포시 | parking | 229 | 0 |
| ko | 47130 | 경북 경주시 | parking | 157 | 0 |
| ko | 51150 | 강원 강릉시 | parking | 127 | 0 |
| ko | 48310 | 경남 거제시 | parking | 123 | 0 |
| ko | 11110 | 서울 종로구 | free | 68 | 0 |
| ko | 11680 | 서울 강남구 | free | 32 | 0 |
| ko | 11140 | 서울 중구 | free | 20 | 0.167 |
| ko | 11170 | 서울 용산구 | free | 19 | 0 |
| ko | 27110 | 대구 중구 | free | 19 | 0 |
| ko | 50110 | 제주 제주시 | barrier-free | 40 | 0.132 |
| ko | 50130 | 제주 서귀포시 | barrier-free | 37 | 0.091 |
| ko | 11110 | 서울 종로구 | barrier-free | 25 | 0.1 |
| ko | 11140 | 서울 중구 | barrier-free | 22 | 0 |
| ko | 31710 | 울산 울주군 | pet | 19 | 0 |
| en | 50110 | Jeju-si | parking | 78 | 0 |
| en | 50130 | Seogwipo-si | parking | 67 | 0 |
| en | 47130 | Gyeongju-si | parking | 50 | 0 |
| en | 51150 | Gangneung-si | parking | 40 | 0 |
| en | 11110 | Jongno-gu | parking | 36 | 0 |

## 관찰

- 합산 상한 20 이 건수 19 선에서 찼다. 그래서 영문 `free` 는 0건이고 국문 `pet` 은 1건, `barrier-free` 는 4건이다 — 정렬이 건수 내림차순이라 건수가 큰 주차·무료가 자리를 먼저 가져간다. 스펙 규칙대로의 결과이고, 언어·속성 균형을 원하면 상한 규칙을 바꿔야 한다.
- Jaccard 상한(0.5)으로 빠진 후보는 없다. 같은 시군구의 두 랜딩 사이 최대값은 0.167(서울 중구 free ↔ barrier-free).
