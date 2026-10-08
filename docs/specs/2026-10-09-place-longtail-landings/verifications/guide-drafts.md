# 편집 페이지 초안 3장 — 검색 조건과 결과 id

- 조회: 2026-10-09 05:4x KST, 운영 검색 API `https://api.1989v.com` 에 GET 만(목록 5회 + 상세 19회). 쓰기 없음.
- 세 장 모두 `status: draft`, `reviewedBy`·`reviewedAt` 비움 — 주제 선정·사실 검수·게시는 사용자 몫(Q1).
- 카드 값(요금·휴무·주차·반려동물)은 상세 응답을 `guideCard()`(copy.mjs)에 넣은 출력이고, 본문 비교 표는 그 출력을 옮겼다. 휴무 칸은 원천 문장의 첫 마디만 옮기고 단서는 카드 원문에 맡겼다.
- 문체: `python3 scripts/lint-blog-post.py <원본> --body-only` 세 장 모두 `PASS  blog-writing §4 통과`.
- 렌더: `node scripts/render-content.mjs` → `편집 페이지 3장`(표지 형식·집합·랜딩 링크 검사 통과).
- 카드 조회 스모크(fetchPlaceGuideCards + placeGuidePages, 운영 API): `cards 18 null []`, 세 장 모두 카드 6개·noindex·「검수 전 초안」 띠·h1 1개, `guides/index.html` 없음(published 0).

## 1. 서울 무료 실내 — `seoul-free-indoor`

| 항목 | 값 |
|---|---|
| 질의 | `GET /api/search/attractions?lang=ko&sidoCode=11&category=culture&admission=FREE&sort=relevance&page=0&size=20` |
| totalElements | 238 |
| 상위 20 id | 15278 15300 15357 15389 15460 15533 15883 15916 16010 16028 16058 16077 16100 16106 16135 16151 16158 16161 16163 16299 |
| 추린 규칙 | 상위 20 중 종로구·중구 + 이름에 박물관·전시관·기념관·갤러리 + 휴무 요일이 원천에 있음 |
| 제외(규칙) | 15278 한벽원미술관(이름) · 16077 신아기념관(휴무 「업체 별로 상이함」) · 16135 북촌 한옥청(이름) · 16163 KT온마루(이름) |
| 실은 id | 16151 15389 16106 16058 16028 16161 |
| 내부 링크 | `/regions/11110/free`(68) · `/regions/11140/free`(20) — 둘 다 목록에 있고 비은퇴 · `/regions/11110` · `/regions/11140` |

## 2. 서울 고궁 반나절 — `seoul-palaces-half-day`

| 항목 | 값 |
|---|---|
| 질의 | `GET /api/search/attractions?lang=ko&sidoCode=11&category=history&keyword=궁&sort=relevance&page=0&size=15` |
| totalElements | 39 |
| 상위 15 id | 1 8654 12989 77 7884 5201 7861 4490 12992 8190 12975 10635 2961 10745 12987 |
| 추린 규칙 | 궁 단위 등록만 — 전각·문(12989 인정문 · 7884 명정전 · 12992 흥화문 · 8190 숭정전 · 12975 건청궁 · 10635 낙선재 · 2961 광화문 · 12987 홍화문)과 궁이 아닌 곳(10745 황학정) 제외 |
| 실은 id | 1 4490 8654 5201 7861 77 |
| 랜딩 근거 | `GET …?lang=ko&category=nature,history,culture,leisure&sidoCode=11&sigunguCode=110&barrierFree=WHEELCHAIR&size=30` → 25건, 1·4490·8654 포함 |
| 내부 링크 | `/regions/11110/barrier-free`(목록 25, 비은퇴) · `/regions/11110` · `/regions/11140` |
| 비고 | 여섯 곳 모두 요금 칸이 원천에 없어 「정보 없음」 — 본문 주의 절에 적었다 |

## 3. 제주 반려동물 동반 — `jeju-pet-friendly`

| 항목 | 값 |
|---|---|
| 질의 | `GET /api/search/attractions?lang=ko&sidoCode=50&category=nature,history,culture,leisure&pet=ALLOWED&sort=relevance&page=0&size=20` |
| totalElements | 24 |
| 상위 20 id | 16 1585 1587 1588 5220 5296 6609 8443 10344 1536 1572 2422 2835 2877 2886 4563 4844 5308 5646 6574 |
| 추린 규칙 | 주차 YES 인 곳 중 제주시·서귀포시 각각 관련도 상위 3곳(PARTIAL 은 조건 밖) |
| 실은 id | 제주시 1585 1588 8443 · 서귀포시 16 1587 5220 |
| 내부 링크 | `/regions/50110/parking` · `/regions/50130/parking`(둘 다 목록·비은퇴) · `/regions/50110` · `/regions/50130` — 제주 반려동물 랜딩은 목록에 없다 |
