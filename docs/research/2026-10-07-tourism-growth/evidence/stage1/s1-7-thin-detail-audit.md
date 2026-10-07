측정 시각(KST): 2026-10-08T04:15:19+09:00 ~ 2026-10-08T04:21:07+09:00 | 도구: Python 3.14.6 / urllib.request / ElementTree | 표본: 국문 600, 영문 300 (총 900) | 명령: `python3 - <<'PY' (stdlib urllib.request + ElementTree + fixed-seed random.sample + Wilson audit; inline script) PY`

# S1-7 빈약한 관광지 상세 표본 감사

## 결과

「빈약」 = 이미지 URL 0 AND 위도·경도 중 하나 이상 0/null AND 구조화 사실 값 0. 비율은 표본 관측값이며 모집단 수는 「추정」이다.

| 언어 | sitemap 상세 문서 | 성공/추출 | 사진 0 | 좌표 0 | 사실 값 0 | 빈약 (95% CI) | 빈약 문서 수 「추정」 (CI 환산) |
|---|---:|---:|---:|---:|---:|---|---|
| 국문 | 46,980 | 600/600 | 44/600 (7.33%) | 0/600 (0.00%) | 38/600 (6.33%) | 0/600 (0.00%); 0.00%–0.64% | 추정 0.0개 (0.0–298.9) |
| 영문 | 15,086 | 300/300 | 24/300 (8.00%) | 0/300 (0.00%) | 19/300 (6.33%) | 0/300 (0.00%); 0.00%–1.26% | 추정 0.0개 (0.0–190.7) |

모든 지표의 95% Wilson CI와 모집단 수 환산은 JSON `summary`에 기록했다. 표본에서 0건이어도 모집단 비율이 정확히 0이라는 뜻은 아니다.

## 사실 값 개수 분포

| 언어 | 0 | 1 | 2 | 3 | 4+ |
|---|---:|---:|---:|---:|---:|
| ko | 38 (6.33%) | 107 (17.83%) | 277 (46.17%) | 160 (26.67%) | 18 (3.00%) |
| en | 19 (6.33%) | 144 (48.00%) | 126 (42.00%) | 8 (2.67%) | 3 (1.00%) |

## overview 길이 분포

| 언어 | 0자 | 1–199자 | 200–999자 | 1000자 이상 |
|---|---:|---:|---:|---:|
| ko | 0 (0.00%) | 205 (34.17%) | 395 (65.83%) | 0 (0.00%) |
| en | 0 (0.00%) | 20 (6.67%) | 274 (91.33%) | 6 (2.00%) |

## 판정 필드와 재현 방법

- 사진: `imageUrl`, `thumbnailUrl`, JSON 문자열 `imagesRaw` 내부 `originimgurl`·`smallimageurl`의 HTTP(S) URL을 중복 제거. 원본·썸네일 URL은 다르면 별개로 센다. 외부 링크 썸네일 제외. URL 존재만 확인하며 이미지 로딩은 미확인.
- 좌표: `latitude`, `longitude` 중 하나라도 0/null이면 좌표 0. 두 필드 모두 결측인 건수도 JSON에 별도 기록.
- 사실: `closureState`, `closedWeekdays`, `attrAdmission`, `attrParking`, `petPolicy`, `barrierFree` (N=6). null/UNKNOWN/빈 문자열/빈 배열/빈 객체는 0. 배열·객체는 알려진 값이 하나라도 있으면 해당 필드 1. false/숫자 0은 알려진 값으로 센다. 원문 설명에서 사실을 추가 추출하지 않는다.
- overview: `overview` 원문 Unicode 코드포인트 수(Python len), 공백·HTML 포함. 0 / 1–199 / 200–999 / 1000+의 상호 배타 구간.
- 시드: 국문 20261007, 영문 20261008. 모든 하위 sitemap의 `<loc>` 중 `/attractions/{id}`, `/en/attractions/{id}`를 분리·중복 제거·문자열 정렬한 뒤 Python random.sample로 각각 600/300개 비복원 추출. sitemap 원본 SHA-256, 전체 모집단 URL, 표본 순서·시각·원시 필드를 JSON에 보존.
- 95% CI: Wilson score, z=1.959963984540054. 유한모집단 보정 없음(보수적), 다중지표 동시 신뢰구간 아님. 「추정」 문서 수 = 비율 × 언어별 sitemap 상세 문서 수; 신뢰구간도 동일 환산.
- 요청: 사전 확인 6회 + 본 측정 907회 = 총 913회; 본 측정 요청 시작 간격 ≥0.26초(초당 최대 4회), 단일 순차 요청, 일반 Chrome UA. 실패는 1회 재시도하고 대체 표본 없음. 국문/영문 미확인 응답: 0/0건.
- Chrome 실행 없음. 로컬 코드 열람·수정 및 Git 변경 없음. 공개 place sitemap과 지정 API만 요청.

## 빈약 표본 ID (Search Console 대조용)

| 언어 | ID | 제목 | 상세 URL |
|---|---|---|---|

표본 내 빈약 판정은 0건으로, 요청한 20개를 채울 수 없음. 조건에 맞지 않는 ID를 추가하지 않았다.

## 출처·한계

- [https://place.1989v.com/sitemap.xml](https://place.1989v.com/sitemap.xml) — 항목 6개, 국문 상세 0개 / 영문 상세 0개.
- [https://place.1989v.com/sitemap-places-hub.xml](https://place.1989v.com/sitemap-places-hub.xml) — 항목 541개, 국문 상세 0개 / 영문 상세 0개.
- [https://place.1989v.com/sitemap-places-1.xml](https://place.1989v.com/sitemap-places-1.xml) — 항목 20,000개, 국문 상세 20,000개 / 영문 상세 0개.
- [https://place.1989v.com/sitemap-places-2.xml](https://place.1989v.com/sitemap-places-2.xml) — 항목 20,000개, 국문 상세 20,000개 / 영문 상세 0개.
- [https://place.1989v.com/sitemap-places-3.xml](https://place.1989v.com/sitemap-places-3.xml) — 항목 20,000개, 국문 상세 6,584개 / 영문 상세 13,416개.
- [https://place.1989v.com/sitemap-places-4.xml](https://place.1989v.com/sitemap-places-4.xml) — 항목 1,559개, 국문 상세 0개 / 영문 상세 1,559개.
- [https://place.1989v.com/sitemap-places-events.xml](https://place.1989v.com/sitemap-places-events.xml) — 항목 507개, 국문 상세 396개 / 영문 상세 111개.
- API 출처: 각 JSON 레코드 `api_url` (`https://api.1989v.com/api/search/attractions/{id}`), 응답 `data`를 판정.
- 추정: 결과는 sitemap 모집단의 무작위 표본 추정이며 sitemap 누락·측정 중 변경·API와 실제 화면의 차이는 포함하지 않는다.
- 미확인: 전수 감사, 이미지 실제 로딩, 상세 페이지 렌더링, Search Console 실적 대조. 구조화 필드가 UNKNOWN이어도 overview 등에 사실이 있을 수 있다.
