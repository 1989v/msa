# 작업 분해 — 관광 탐색 IA 개편

스펙: `spec.md` · 결정: `docs/adr/ADR-0071-place-region-drilldown.md`

**R1 이 나머지 전부의 선행이다.** 지금 `sigungu_code` 위에 드릴다운을 올리면 같은 구가 두 번
나오는 화면을 만들게 된다. 데이터를 먼저 세운다.

---

## R1 — 행정구역 데이터 — **코드 완료 (2026-08-20), 자료 파일 대기**

- [x] 법정동코드 파서 (`place/ingest/src/admin_region.py`) — 읍면동·폐지 제외, 시도 접두 제거
- [ ] **자료 파일 확보(사용자)** → `--job=admin-regions --file <경로>` 실행
- [x] `admin_regions` 테이블 + 도메인 + `GET/POST /api/places/admin-regions`
- [x] 시군구 중심 좌표 — 관광지 좌표 평균. 관광지가 없으면 좌표 없이 둔다
- [x] `attractions.ldong_regn_cd` / `ldong_signgu_cd` + `sync_tour.py` 가 원천 값 그대로 저장
- [ ] 목록 재동기화 → **미매칭 건수 집계** (OQ-1)

**함정**: 재동기화는 `syncFrom` 이 개요를 보존하므로 안전하다. 그래도 실행 전 `--stats` 로
개요 보유 수를 적어두고 실행 후 비교한다 — 300건을 잃은 전례가 있다.

---

## R2 — 드릴다운 API + 검색 필터 — **완료 (2026-08-20), 자료 들어오면 화면에 뜬다**

- [x] `GET /api/places/admin-regions?level=&parent=&lang=` — 관광 분류만 세는 카운트
      **search 가 아니라 place 에 뒀다** — place 가 행정구역과 관광지를 둘 다 갖고 있어
      교차 서비스 호출도 색인 변경도 필요 없다. 시도 건수는 시군구 합으로 한 번에 낸다.
- [x] 검색에 `sidoCode`/`sigunguCode` 필터 + `ldongRegnCd`/`ldongSignguCd` 색인
- [x] 좌표 → 시도 판정 (중심 좌표 최근접) — **정렬만 앞으로, 자동 선택은 하지 않는다**
- [x] FE 드릴다운(`RegionDrilldown`) — 자료가 없으면 이전 광역 선택을 그대로 쓴다.
      두 축을 동시에 노출하지 않는다 (ADR-0071 §9)
- [x] 레벨 선택 시 그 레벨의 줌으로 지도 이동

---

## R3 — 레이아웃 개편 — **1차 완료 (2026-08-20)**

- [x] 지도 센터 / 우측 정보 **영역**(오버레이 아님) / 좌측 목록 접기·펼치기
- [x] 지도 하단 아이템 캐로셀 (영상 썸네일 / 블로그 링크 줄 / 상품 버튼 — 형태로 구분)
- [x] 확대 상한 (SIDO 11 / SIGUNGU 13) — 시도를 골랐을 때 fitBounds 가 동네까지 당기지 않게
- [ ] 레벨 선택 시 중심 이동 — R2 의 지역 드릴다운이 붙어야 쓸 데가 생긴다
- [x] 좁은 화면: 목록 접힘 기본, 단일 열로 쌓임
- [x] 목록은 관광 분류만, 카페·식당·쇼핑은 지도 토글 (현재 지도 범위 안에서만, 최대 60개)
      `category` 파라미터가 쉼표 복수를 받는다 — 파라미터를 새로 만들지 않았다.
      오버레이 마커는 **모양으로** 구분한다(원 vs 핀). 색만 다르면 색각 이상에서 같아 보인다.

**검증 (2026-08-20 실측)**: 1440px — 펼침 `352/992`, 선택 `320/688/320`, 접힘 `44/964/320`.
820px — 단일 열로 쌓임. **정보 패널이 지도와 겹치지 않고**(사각형 교차 기준) 가로 스크롤 없음.
대비는 4조합 동일, 전부 4.5:1 상회.

> 처음 측정 함수가 x 축만 봐서 쌓인 레이아웃을 "가림"으로 셌다 — 사각형 교차로 고쳐 다시 쟀다.

---

## R4 — 지역 페이지 SEO/AEO

- [ ] `/regions/{시도}` · `/regions/{시도}/{시군구}` 라우트 + 프리렌더
- [ ] `TouristDestination` + `ItemList` 구조화 데이터
- [ ] `portal-fe/src/seo/copy.mjs` 에 지역 카피 (문구 SSOT)
- [ ] sitemap 에 지역 URL 추가

**함정**: 호스트로 갈리는 경로는 프리렌더도 `_hosts/$host` 키를 써야 한다 (ADR-0062).

---

## R5 — Google `place_id` (비용 판단 후)

- [ ] `AttractionLinkSource.GOOGLE_PLACE` — ADR-0070 큐 재사용
- [ ] Places `searchText` 커넥터, **`place_id` 만 저장**
- [ ] 월 상한 + 초과 시 좌표 링크 폴백 (링크가 깨지지 않는다)
- [ ] OQ-3(단가 × 조회량) 계산이 선행

---

## R6 — 여행 상품 아이템 (**막힘: 사용자 작업**)

- [ ] 제휴 프로그램 가입·승인 (Klook / Trip.com / 마이리얼트립)
- [ ] 승인된 곳만 상품 API 커넥터 + `revenueType: AFFILIATE` 승격
- [ ] 배지·고지·`rel="sponsored"` (ADR-0069 §1 규칙 그대로)

승인 전에는 진입 링크로 남는다. **코드로 앞당길 수 없다.**

---

## 사용자 작업 (코드 밖)

| 항목 | 막는 것 |
|---|---|
| `VITE_GOOGLE_MAPS_KEY` | 지도가 아예 안 보인다 — R3 전체 |
| `place-ingest-secrets`: `tour-api-key` | 개요 수집 CronJob |
| `place-ingest-secrets`: `youtube-api-key` · `naver-client-id/secret` | 영상·블로그 카드 (코드는 완료) |
| Google Places API 키 + 월 상한 | R5 |
| 여행 제휴 프로그램 가입 | R6 |

---

## 의존

```
R1 ──► R2 ──► R4
 └────► R3 (지도 키 필요)
R5 (비용 판단 후 · 독립)
R6 (승인 후 · 독립)
```
