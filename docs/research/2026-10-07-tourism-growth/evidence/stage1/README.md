<!-- source: docs/plans/2026-10-08-place-growth-work-plan.md, docs/research/2026-10-07-tourism-growth/evidence/stage1/*.md -->
# 1단계 진단·기준선 결과 (2026-10-08 새벽)

- 범위: `docs/plans/2026-10-08-place-growth-work-plan.md` 의 코드 몫 S1-5~S1-12 여덟 건. 사용자 몫 S1-1~S1-4(Search Console·서치어드바이저·Bing·Cloudflare)는 계정이 필요해 남아 있다.
- 방법: 코덱스(gpt-6.1-sol·medium) 8건에 위임, 사용자 승인에 따라 병렬(동시 최대 4건, 주간 사용률 상한 30%). 사용률은 시작 11.0% → 끝 12.0%. Chrome 이 필요한 두 항목은 코덱스 샌드박스에서 `Abort trap: 6` 으로 못 떠서 세션 셸에서 직접 보충했다(S1-6 허브 실화면, S1-10 클릭 실측, S1-5 전부).
- 코드 근거는 전부 `origin/main a8d1c97` 을 `git show` 로 읽었다(로컬 main 은 수백 커밋 뒤). 운영 배포 SHA 와의 동일성은 미확인.
- 원시 덤프(JSON·JSONL 1~14MB)는 레포에 넣지 않았다. 세션 스크래치패드 `raw-archive/` 에 있고, 재현 스크립트(`*.py`)와 요약 `.md` 만 커밋한다.

## 결과 한눈에

| ID | 결론 | 계획에 미치는 영향 | 파일 |
|---|---|---|---|
| S1-6 영문 텍스트 결함 | 상세 SSR 본문 노출 **0/30**. API 텍스트 **63회/8페이지**(overview 26 · infoRaw 21 · 기타 16; `<br` 55 · `&rsquo;` 5 · `&nbsp;` 3). 허브 카드(`PlaceCard` `.place-card-overview`)와 선택 패널은 overview 원문을 그대로 출력 → 실화면 확인: **영문 허브 첫 화면 카드 30개 중 3개 노출**, 국문 0. 「Not closed today」는 영업 배지가 아니라 `openToday` 패싯 칩 | S2-1 범위 확정: 상세 SSR 은 이미 `sourceText` 로 정규화됨. 고칠 곳은 `PlacePage.tsx` 카드·패널 두 경로와 칩 문구(`placeAttributes.ts`) | `s1-6-en-text-defects.md` · `s1-6-hub-ui-check.md` · `s1-6-origin-main-render-evidence.md` |
| S1-7 빈약한 상세 | 「사진 0 ∧ 좌표 0 ∧ 사실 값 0」은 **0/900**(좌표 0 이 아예 없음). 현실적 정의 「사진 0 ∧ 사실 값 0」은 **국문 0.33%(2/600, CI 0.09~1.21%) · 영문 3.33%(10/300, CI 1.82~6.03%)** → 전수 추정 국문 약 150건, 영문 약 500건(영문은 병원·피부과 등 의료 항목이 대부분). 사진 0 은 7.3~8.0%, 사실 값 0 은 6.3%, 사실 값 2개 이상 ko 76% · en 46%. overview 0자 없음 | **D-3 의 전제가 바뀐다.** noindex 후보는 수만 장이 아니라 수백 장이고, 영문 의료 항목이 중심. 일괄 noindex 논쟁은 사실상 소멸 → 표본 감사 뒤 소규모 적용으로 충분 | `s1-7-thin-detail-audit.md` (+ 원시 JSON 은 스크래치패드) |
| S1-8 googlePlaceId 짝 | 보유율 **영문 28.3% · 국문 68.3%**. placeId 일치 짝 16.3%, 엄격(placeId+50m+분류+제목+유일) **8.3%**. 손 판정 30쌍: 같은 범위 19 · **범위 다름 10**(아울렛 안 다른 브랜드, 휴양림 전체 vs 짚라인, 관광특구 vs 놀이공원) · 불가 1. 부수 발견: 검색 API 의 `q` 는 무시되고 **`keyword`** 가 실제 파라미터(`q` 로 부르면 같은 5건 고정) | S3-5: placeId 만으로 자동 hreflang 불가. 엄격 조건 + 제목 일치 + 사람 표본 검수 뒤 쌍 단위 적용. 영문 커버리지 자체가 낮아 쌍은 수백~수천 수준(추정). `q`/`keyword` 불일치는 API 문서·클라이언트 정합 소작업 | `s1-8-place-id-pairs.md` |
| S1-9 lastmod | `<lastmod>` = **원천 수정일**(TourAPI `modifiedtime` → `sourceModifiedAt` → search `modifiedAt`), 재색인 시각 아님. 코드 전 구간 확인 + 라이브 20,000 URL 에 고유 날짜 398개, 오늘·어제 0%. 허브 sitemap 은 lastmod 없음 | S2-8 의 lastmod 항목은 **불필요**. ETag/304 만 남는다. 「본문 변경 시각」이 따로 필요하면 `contentUpdatedAt`(해시 비교) 신설안 | `s1-9-lastmod.md` |
| S1-10 로그인 복귀 | `next` 에 상세 장소 ID 는 남지만(`/attractions/1`), **허브에서는 `/` 만** 실리고 검색 조건·선택 장소·저장 의도는 보관하지 않는다(`portal_login_next` 에 next 만, 저장 의도 큐 없음). 실측 클릭 결과가 코드 계산과 정확히 일치 | S3-3 범위 확정(D-4 와 무관): ① 허브 별 클릭 시 next 에 대상 상세 URL ② 저장 의도 보관 → 복귀 시 자동 저장 또는 안내 ③ 검색 상태 URL 은 S2-3 몫. 로그인 뒤 구간은 테스트 계정이 있어야 검증 | `s1-10-login-return.md` · `s1-10-live-click-check.md` |
| S1-11 신뢰 표시 매핑 | 출처 = `attractions.source`(TOURAPI/GOCAMPING)인데 **검색 문서로 전달되지 않아** 화면·SSR 이 「한국관광공사 TourAPI」를 고정 출력(고캠핑 오표기 가능). 원천 갱신일 = `source_modified_at` → `modifiedAt`(전달됨). **전체 수집일·검수일은 없음**(정보별 `intro/pet/extra_synced_at` 만). `dateModified` 는 WebPage 콘텐츠 수정일 필드 신설 전 생략 | S2-2 신뢰 블록 범위: 「출처(source 전달 추가) · 원천 갱신일(지금 가능) · 정보별 수집일(선택, 전달 추가)」. 검수일은 S2-7 결과로 신설. 날짜는 YYYY-MM-DD 만(시간대 미확인) | `s1-11-trust-field-mapping.md` |
| S1-12 행동 계측 | 허브의 검색·필터·결과 선택·찜·길찾기는 **공통 원장에 안 실린다**. 통합 검색·상세 추천·지역 행사 링크만 SEARCH/IMPRESSION/CLICK. 찜 성공 이벤트 없음, 공유 기능 없음, 길찾기 링크는 Maps 「검색」. ClickHouse MergeTree 라 중복 행 가능, beacon 식별자 계약 불일치(FE 본문 vs 서버 헤더) | 2단계 **전**에 최소 계측(S1-12b 신설): 허브 submit·filter·결과 선택·찜 성공·지도 링크 + 세션 시작, 중복 키 `(viewId, entityType, entityId, action)`, beacon 계약 통일. 이것 없이는 S2 효과를 잴 수 없다 | `s1-12-instrumentation.md` · `s1-12-instrumentation-errata.md` |
| S1-5 성능 기준선 | 3페이지 × 5회(세션 셸, Lighthouse 13.5.0 simulate). 분해값 합 = 관측 LCP 가 15/15 「예」. **상세·지역은 LCP 요소가 텍스트**(관측 LCP = TTFB 377~2,048ms + 렌더 지연 198~2,114ms; 시뮬 LCP 중앙값 8.7s·8.9s, 범위 2.9~27.0s). **허브는 LCP 요소가 이미지**이고 관측 LCP 의 최대 단계가 「Resource load delay」 955~1,655ms(이미지가 JS 렌더 뒤 늦게 발견됨; 시뮬 LCP 중앙값 21.9s, CLS 가 2회 0.74). 전송 상세 6.5MB · 허브 5.0MB · 지역 4.4MB | S2-5 범위: 상세·지역은 렌더 지연·TTFB, **허브는 LCP 이미지 조기 발견(preload/SSR 마크업)과 CLS**. 시뮬레이션 단일 값은 지표로 쓰지 않고 중앙값·관측값으로 전후 비교 | `perf-baseline.md` · `lh/batch.log` · `lh/startup-failure.md`(코덱스 실패 기록) · 원본 JSON 15개(10MB)는 스크래치패드 `raw-archive/lh/` |

## 결정 5건에 미치는 영향

| 결정 | 변화 |
|---|---|
| D-1 타깃 | 영향 없음. 영문 빈약 항목이 의료 중심이라 영문 확장은 데이터 질부터 |
| D-2 랜딩 | 영향 없음 |
| D-3 noindex | **전제 변경**: 후보가 국문 약 150·영문 약 500(추정)으로 작다. 「표본 감사 뒤 범위별」로 결정되는 것이 아니라, 이 표본 자체가 감사다. 남은 확인은 그 후보들의 Search Console 실적뿐 |
| D-4 게스트 저장 | 영향 없음. 단 S3-3(허브 next·저장 의도)은 D-4 와 무관하게 필요하다는 것이 실측으로 확인 |
| D-5 모바일 지도 | 영향 없음 |

## 새로 드러난 소작업

- API `q` 무시 / `keyword` 실제 (S1-8). 공개 API 문서·클라이언트 정합.
- 출처 `source` 가 검색 문서에 없어 고캠핑 관광지도 「TourAPI」로 표기될 수 있음 (S1-11).
- `wishlist_collections` 가 아니라 `wishlist_collection` (S1-12 정정).
- beacon 전송의 visitorId/sessionId 가 서버 DTO 에 없음 (S1-12).

## 다음 (2단계 착수 조건)

1. 사용자: S1-1~S1-4 등록·확인. 특히 S1-7 의 빈약 후보 ID(JSON `thin`/`photo_zero∧facts_zero`)로 Search Console 실적 대조.
2. 코드: S1-12b 최소 계측 → S2-1(영문 정제: `PlacePage` 카드·패널 + 칩 문구) → S2-2(신뢰 블록: source 전달 + 원천 갱신일) → S2-3a 변형 시안.
3. S2-8 은 ETag/304 만.
