# 배포 뒤 구조화 데이터 확인 (tasks 6.9, SR-5.4)

- 대상: 운영 상세 SSR(gateway → search 렌더러). 이미지 `0d7377f`. 측정 시각 2026-10-09 13:15~13:17 KST
- 표본: 화면 측정(`screens.md`)과 같은 11 URL
  - 국 77·4811·16151·12933·2961
  - 국 행사 62109
  - 영 13863·13808·18083·14580·14367
- 방법 둘:
  1. **SSR HTML 직접 파싱**: curl(사람 UA)로 받은 HTML 에서 `<script type="application/ld+json">` 을 뽑아 `json.loads` 하고 @type·필수 키를 검사한다(`scratchpad/meas3/ld.py`).
  2. **validator.schema.org 프로그램 호출**: `POST https://validator.schema.org/validate` 에 `url=` 을 보내고, 응답(`)]}'` 접두 뒤 JSON)의 `totalNumErrors`·`totalNumWarnings` 를 읽었다. 부를 수 있었다.

## 1. SSR JSON-LD 파싱

| URL | lang · canonical | 블록 | 파싱 | @type | image (license · creditText) | containedInPlace | isAccessibleForFree | 문제 |
|---|---|---|---|---|---|---|---|---|
| /attractions/77 | ko · 자기 주소 | 2 | OK | TouristAttraction + BreadcrumbList(4단계) | ImageObject, 제1유형 · 한국관광공사 | 종로구 → 서울특별시 | true | 없음 |
| /attractions/4811 | ko · 자기 주소 | 2 | OK | TouristAttraction + BreadcrumbList(4) | ImageObject, 제1유형 · 한국관광공사 | 고양시 덕양구 → 경기도 | false | 없음 |
| /attractions/16151 | ko · 자기 주소 | 2 | OK | TouristAttraction + BreadcrumbList(4) | ImageObject, 제1유형 · 한국관광공사 | 종로구 → 서울특별시 | true | 없음 |
| /attractions/12933 | ko · 자기 주소 | 2 | OK | TouristAttraction + BreadcrumbList(4) | ImageObject, 제3유형 · 한국관광공사 | 광주시 → 경기도 | false | 없음 |
| /attractions/2961 | ko · 자기 주소 | 2 | OK | TouristAttraction + BreadcrumbList(4) | ImageObject, 제3유형 · 한국관광공사 | 종로구 → 서울특별시 | false | 없음 |
| /attractions/62109 | ko · 자기 주소 | 2 | OK | Event + BreadcrumbList(4) | 문자열 https tong 주소 | — | — | 없음 |
| /en/attractions/13863 | en · 자기 주소 | 2 | OK | TouristAttraction + BreadcrumbList(4) | ImageObject, 제1유형 · 한국관광공사 | Jongno-gu → Seoul | 키 없음 | 없음 |
| /en/attractions/13808 | en · 자기 주소 | 2 | OK | TouristAttraction + BreadcrumbList(4) | ImageObject, 제1유형 · 한국관광공사 | Deogyang-gu, Goyang-si → Gyeonggi-do | 키 없음 | 없음 |
| /en/attractions/18083 | en · 자기 주소 | 2 | OK | TouristAttraction + BreadcrumbList(4) | ImageObject, 제3유형 · 한국관광공사 | Jongno-gu → Seoul | true | 없음 |
| /en/attractions/14580 | en · 자기 주소 | 2 | OK | TouristAttraction + BreadcrumbList(4) | ImageObject, 제3유형 · 한국관광공사 | Gwangju-si → Gyeonggi-do | 키 없음 | 없음 |
| /en/attractions/14367 | en · 자기 주소 | 2 | OK | TouristAttraction + BreadcrumbList(4) | 없음(사진 없음) | Jung-gu → Seoul | 키 없음 | 없음 |

검사한 필수 키:

- 공통: `@context` 가 schema.org
- TouristAttraction: `name`·`url` 있음. `image` 가 있으면 ImageObject + `contentUrl` https. `geo` 가 GeoCoordinates + 위도 있음
- BreadcrumbList: ListItem 의 `position` 이 1부터 연속, `name` 있음, 마지막 단계 외에는 `item` 있음
- 위반 0건

관찰:

- BreadcrumbList 는 4단계(탐색 → 시도 → 시군구 → 이름)로 시군구 단계가 들어가 있다.
- `isAccessibleForFree` 는 입장 값이 판정된 곳에만 있다. 영문 4곳은 키가 없다.

## 2. validator.schema.org

| URL | totalNumErrors | totalNumWarnings | 경고 내용 |
|---|---|---|---|
| /attractions/77 · 4811 · 16151 · 12933 · 2961 | **0** (5곳 모두) | 4 | `UNKNOWN_FIELD` — TouristAttraction 의 `inLanguage`·`isPartOf` |
| /attractions/62109 | **0** | 2 | `UNKNOWN_FIELD` — Event 의 `isPartOf` |
| /en/attractions/13863 · 13808 · 18083 · 14580 · 14367 | **0** (5곳 모두) | 4 | `UNKNOWN_FIELD` — TouristAttraction 의 `inLanguage`·`isPartOf` |

- **오류 0 — 11/11 통과.** 경고는 전부 `isSevere: false` 이고, schema.org 정의상 해당 타입에 없는 속성이라는 뜻이다(`inLanguage` 는 CreativeWork 계열, `isPartOf` 는 CreativeWork·WebPage 계열 속성).
- 경고 수가 속성 수의 두 배이고 `numObjects` 가 4 다. 응답의 `isRendered: true` 로 보아 validator 가 정적 HTML 과 JS 실행 뒤 문서를 함께 센 것으로 보인다.
  - 실제 렌더 뒤 DOM 을 CDP 로 따로 쟀다(`/attractions/77`, 13:18 KST): `application/ld+json` 은 2개(TouristAttraction·BreadcrumbList, `data-seo-multi`, head)뿐이다. 페이지에 중복 블록은 없다.
- Google 리치 결과 테스트(표본 3 URL)는 사용자 몫(Q2)으로 남는다.
