# CDP 4조합 — 가까운 역·근거 절 (TG6.6, 2026-10-11 20:3x KST)

드라이버: `scripts/cdp-chrome.sh start` → 측정 → `stop` 한 명령, 독립 프로필 헤드리스 크롬, 캐시 끔, 로드 뒤 7초.
조합: 국·영 × 데스크톱(1280×900, 데스크톱 UA)·모바일(390×844, iPhone UA, 터치).
판정 근거는 대상 페이지가 그린 DOM(`.place-access`·`.place-visitor-ranking`·`[data-place-section]`) 텍스트다.
로드 번들은 전 조합 `assets/index-vVB_BRMw.js`(운영 현행)이다.

| 페이지 | 국 데스크톱 | 국 모바일 | 영 데스크톱 | 영 모바일 |
|---|---|---|---|---|
| 상세 경복궁(국 `1`, 영 `21`) — 가까운 역·정류장 | 있음 | 있음 | 있음 | 있음 |
| 시도 서울 `11` — 타지 방문자 순위 | 있음 | 있음 | 있음 | 있음 |
| 시도 부산 `26` — 순위 | 있음 | 있음 | 있음 | 있음 |
| 시도 세종 `36`·제주 `50` — 순위(시군구 3개 미만) | 숨김 | 숨김 | 숨김 | 숨김 |
| 시군구 종로구 `11110` — 찜·클릭 근거 절(운영 표본 0) | 숨김 | 숨김 | 숨김 | 숨김 |

상세 가까운 역 절 원문(국 모바일):
> 가까운 역·정류장 대중교통 길찾기 경복궁(정부서울청사)역 (3호선) · 직선거리 278m 광화문(세종문화회관)역 (5호선) · 직선거리 488m 경복궁 버스정류장 · 직선거리 183m 경복궁역(효자로입구) 버스정류장 · 직선거리 226m 직선거리이며 실제 걷는 길은 더 깁니다 · 자료 기준일 2025-10-31 출처: 국가철도공단 도시철도 역사정보 · 국토교통부 전국 버스정류장 위치정보

영문(영 모바일, id 21):
> Nearby stations and stops Transit directions Gyeongbokgung (Government Complex-Seoul) (Line 3) · straight-line 278m Gwanghwamun(Sejong Center for the Performing Arts) (Line 5) · straight-line 488m Bus stop 경복궁 · straight-line 183m Bus stop 경복궁역(효자로입구) · straight-line 226m …

- 버스정류장 이름은 영문 원천이 없어 국문 그대로다(설계대로, `AttractionAccessStop.nameEn` 주석).
- 서울 순위 첫 줄: 「강남구 약 19,601,507명」 (영 「Gangnam-gu about 19,601,507」).
- 찜(`SITE_SAVES`)·클릭(`SITE_CLICKS`) 근거 절은 운영 표본이 0 이라(tg0-measurements 0.5·0.6) 컴포넌트 테스트로만 확인했다.
- 측정 중 발견: `/en/attractions/1`(국문 id)은 영문 경로인데 국문 내용을 낸다. 이미 보고된 기존 문제다(§16 「/en/attractions/{국문id} 국문 응답」).
