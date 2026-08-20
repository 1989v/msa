# 작업 분해 — 관광 탐색 IA 개편

스펙: `spec.md` · 결정: `docs/adr/ADR-0071-place-region-drilldown.md`

**R1 이 나머지 전부의 선행이다.** 지금 `sigungu_code` 위에 드릴다운을 올리면 같은 구가 두 번
나오는 화면을 만들게 된다. 데이터를 먼저 세운다.

---

## R1 — 행정구역 데이터 (선행, 막힘 없음)

- [ ] 행정안전부 법정동코드 전체자료 적재기 (`place/ingest/src/admin_region.py`)
      — 폐지 항목 제외, 시도 17 + 시군구 229
- [ ] `admin_regions` 테이블 + 도메인 + 조회 API
- [ ] 시군구 중심 좌표 — 자료에 없으면 해당 시군구 관광지 좌표 중앙값으로 채운다
      (지도 중심용이라 정밀도가 필요 없다)
- [ ] `attractions.ldong_regn_cd` / `ldong_signgu_cd` 컬럼 + `sync_tour.py` 가 저장
- [ ] 목록 재동기화 → **미매칭 건수 집계** (OQ-1)

**함정**: 재동기화는 `syncFrom` 이 개요를 보존하므로 안전하다. 그래도 실행 전 `--stats` 로
개요 보유 수를 적어두고 실행 후 비교한다 — 300건을 잃은 전례가 있다.

---

## R2 — 드릴다운 API + 검색 필터 (R1 이후)

- [ ] `GET /api/search/attractions/regions?level=&parent=` — 관광 분류만 세는 카운트
- [ ] 검색에 `sidoCode`/`sigunguCode` 필터 추가
- [ ] 좌표 → 시도 판정 (중심 좌표 최근접, 경계 폴리곤 없이)

---

## R3 — 레이아웃 개편 (R2 와 병행 가능)

- [ ] 지도 센터 / 우측 정보 **영역**(오버레이 아님) / 좌측 목록 접기·펼치기
- [ ] 지도 하단 아이템 캐로셀 — 영상·블로그·상품을 **형태로** 구분 (색만으로 가르지 않는다)
- [ ] 행정 레벨별 줌 프리셋 (SIDO 9 / SIGUNGU 12)
- [ ] 좁은 화면: 목록 접힘 기본, 캐로셀은 지도 아래로
- [ ] 목록은 관광 분류만, 카페·식당·쇼핑은 지도 토글 (현재 bounds 안에서만 조회)

**검증**: CDP 4조합 + 좁은 화면. 접힌 상태·펼친 상태 양쪽을 잰다.

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
