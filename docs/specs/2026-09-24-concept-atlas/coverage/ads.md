# 광고 — 커버리지 체크리스트

원천:
- `docs/specs/2026-09-23-ad-network/context/concepts.md` — 광고 개념 107개(A1~K7, 볼트 `ad-network-concepts.md` 와 같다). 107개 전부 아래 표의 출처 열에 있다
- `docs/specs/2026-09-23-ad-network/spec.md`(SR-1~17) · `context/key-decisions.md` · `docs/adr/ADR-0098-ad-network.md` · `docs/adr/ADR-0076-adsense-monetization.md`
- 레포 코드 `ads/domain` · `ads/feature` · `portal-fe/src/components/ads` · `common/.../CrawlerUserAgents.kt`
- 분야 표준 — IAB Tech Lab(OpenRTB 2.6 · ads.txt · sellers.json · SupplyChain · VAST · SIMID · OM SDK · Content Taxonomy · TCF) · MRC 가시성 기준 · 경매 이론(1차가 · 2차가 · GSP · VCG) · 페이싱 · 어트리뷰션 · IVT 분류

| id | 개념 | 출처 | 배치 |
|---|---|---|---|
| ads-direct-sales | 직접 판매 · 보장형 거래 | concepts 절 구성 · 분야 표준 | placed |
| ads-guaranteed-delivery | 보장형 게재 | concepts B13 | placed |
| ads-line-item-priority | 라인아이템 우선순위 | concepts D17 | placed |
| ads-avails-forecasting | 인벤토리 예측 (avails) | concepts D18 | placed |
| make-good | 메이크굿 | 분야 표준 | placed |
| ads-intermediation | 네트워크 중개 | concepts 절 구성 · 분야 표준 | placed |
| ad-network | 광고 네트워크 | concepts A3 · 스펙 Goal | placed |
| ad-server | 광고 서버 | concepts A11 | placed |
| ads-candidate-index | 메모리 후보 인덱스 | 스펙 SR-6 · ADR-0098 | placed |
| dmp | DMP | concepts A10 | placed |
| ads-programmatic-trading | 프로그래매틱 거래 | concepts 절 구성 · 분야 표준 | placed |
| ad-exchange | 애드 익스체인지 | concepts A5 | placed |
| ssp | SSP | concepts A5 | placed |
| dsp | DSP | concepts A5 | placed |
| rtb | RTB (실시간 입찰) | concepts A6 | placed |
| openrtb | OpenRTB | concepts A6 | placed |
| header-bidding | 헤더 비딩 | concepts A7 | placed |
| ads-deal-types | 프로그래매틱 거래 유형 | 분야 표준 | placed |
| supply-path-optimization | 공급 경로 최적화 (SPO) | 분야 표준 | placed |
| cookie-syncing | 쿠키 싱크 | 분야 표준 | placed |
| ads-supply-chain-opacity | 공급망 불투명 · 도메인 스푸핑 | 분야 표준 | placed |
| win-rate | 낙찰률 | 분야 표준 | placed |
| ads-campaign-setup | 캠페인 설정 | concepts 절 구성 · 분야 표준 | placed |
| ads-self-serve-console | 광고주 셀프서브 콘솔 | 확정 범위(셀프서브) · 스펙 SR-15 | placed |
| ads-pricing-model | 과금 모델 | concepts B10 | placed |
| cpm | CPM | concepts B10 | placed |
| cpc | CPC | concepts B10 | placed |
| cpa | CPA | concepts B10 | placed |
| cpt | CPT | concepts B13 | placed |
| cps | CPS · 제휴 마케팅 | ADR-0069 · 분야 표준 | placed |
| ads-bid-strategy | 입찰 전략 | concepts B9 | placed |
| auto-bidding | 자동 입찰 | 분야 표준 | placed |
| bid-shading | bid shading | 분야 표준 | placed |
| ads-flight-scheduling | 게재 기간 · 스케줄 | concepts B8 | placed |
| dayparting | 요일 · 시간대 스케줄 | concepts B8 | placed |
| ads-budget-cap | 예산 상한 강제 | 스펙 SR-6 · SR-10 | placed |
| ads-creative-management | 소재 제작 · 심사 | concepts 절 구성 · 분야 표준 | placed |
| ads-ad-format | 광고 형식 | concepts B14 | placed |
| display-ad | 디스플레이 광고 | concepts B14 | placed |
| native-ad | 네이티브 광고 (인피드) | concepts B14 | placed |
| video-ad | 동영상 광고 | 분야 표준 | placed |
| vast | VAST | concepts F10 | placed |
| simid | SIMID | concepts F10 | placed |
| interstitial-ad | 전면 광고 | 분야 표준 | placed |
| rewarded-ad | 보상형 광고 | 분야 표준 | placed |
| search-ad | 검색 광고 | 분야 표준 | placed |
| ads-responsive-creative | 반응형 소재 규격 | concepts B15 | placed |
| ads-creative-review | 소재 심사 | concepts B5 | placed |
| dynamic-creative-optimization | 동적 소재 최적화 (DCO) | 분야 표준 | placed |
| ads-site-onboarding | 사이트 등록 · 판매 권한 선언 | concepts 절 구성 · 분야 표준 | placed |
| ads-site-verification | 사이트 소유권 확인 | concepts C2 | placed |
| ads-site-review | 사이트 심사 | concepts C3 · ADR-0076 | placed |
| ads-txt | ads.txt | concepts C6 · ADR-0076 §3 | placed |
| sellers-json | sellers.json | concepts C7 | placed |
| schain | SupplyChain 객체 | 분야 표준 | placed |
| ads-inventory-setup | 지면 구성 | concepts 절 구성 · 분야 표준 | placed |
| ads-manual-placement | 코드 지정 지면 | ADR-0076 §1 | placed |
| ads-auto-ads | 자동 광고 | ADR-0076 §1 | placed |
| ads-lazy-loading | 지면 지연 로딩 | concepts D16 | placed |
| ads-slot-reservation | 지면 높이 확보 | 스펙 SR-15 | placed |
| ads-native-insertion | 네이티브 삽입 규칙 · 광고 비중 | concepts D19 | placed |
| ads-publisher-block-rules | 퍼블리셔 차단 규칙 | concepts C8 | placed |
| ads-placement-registry-sync | 코드 지면 ↔ 등록부 동기화 | concepts K7 | placed |
| ads-unregistered-placement | 등록 안 된 지면 | concepts K7 | placed |
| ads-layout-shift | 레이아웃 밀림 (CLS) | 스펙 SR-15 | placed |
| ads-yield-management | 채움 · 수익 최적화 | concepts 절 구성 · 분야 표준 | placed |
| floor-price | 최저 가격 | concepts D8 | placed |
| dynamic-floor | 동적 최저가 | 분야 표준 | placed |
| ads-mediation | 미디에이션 | concepts A8 | placed |
| ads-waterfall | 워터폴 | concepts A8 | placed |
| ads-unfilled-handling | 빈 지면 처리 | concepts C9 · 스펙 SR-15 | placed |
| house-ad | 하우스 광고 | concepts A9 · 스펙 SR-14 | placed |
| ads-adslot-provider | AdSlot 수요처 추가 | concepts K3 · ADR-0076 | placed |
| google-adsense | Google AdSense | ADR-0076 §2 | placed |
| fill-rate | 채움률 | concepts F1 | placed |
| rpm | RPM | concepts F6 | placed |
| ad-blocking | 광고 차단 | 스펙 SR-15 | placed |
| ads-request-handling | 광고 요청 처리 | concepts 절 구성 · 분야 표준 | placed |
| ads-ad-request | 광고 요청 | concepts D1 | placed |
| ads-creative-sandboxing | 소재 격리 렌더링 | concepts D13 | placed |
| ads-serving-domain-isolation | 광고 서빙 도메인 분리 | concepts D14 · ADR-0098 §2 | placed |
| ads-decision-latency-budget | 광고 결정 지연 예산 | concepts D15 | placed |
| ads-targeting | 타기팅 | concepts 절 구성 · 분야 표준 | placed |
| contextual-targeting | 문맥 타기팅 | concepts E1 | placed |
| ads-page-classification | 페이지 분류 크롤러 | concepts E4 | placed |
| ads-content-taxonomy | 콘텐츠 분류 체계 | concepts E5 | placed |
| ads-keyword-matching | 키워드 매칭 | concepts E6 | placed |
| behavioral-targeting | 행태 타기팅 | concepts E2 | placed |
| retargeting | 리타기팅 | concepts E3 | placed |
| lookalike-targeting | 유사 타기팅 | 분야 표준 | placed |
| ads-targeting-filter | 타기팅 조건 필터 | concepts D3 | placed |
| ads-placement-targeting | 지면 타기팅 | concepts D3 | placed |
| device-targeting | 기기 타기팅 | concepts D3 | placed |
| geo-targeting | 지역 타기팅 | concepts D3 | placed |
| ads-eligibility | 후보 추림 · 게재 조절 | concepts 절 구성 · 분야 표준 | placed |
| ads-eligibility-filter | 게재 자격 판정 | concepts D2 | placed |
| frequency-capping | 빈도 제한 | concepts D4 | placed |
| pacing | 페이싱 | concepts D12 | placed |
| ads-throttling-pacing | 확률 스로틀링 페이싱 | 분야 표준 | placed |
| ads-bid-modification-pacing | 입찰가 조절 페이싱 | 분야 표준 | placed |
| ads-wallet-headroom | 지갑 여유 판정 | 스펙 SR-6 | placed |
| ads-overdelivery | 초과 집행 | 스펙 SR-4 · 분야 표준 | placed |
| ads-early-budget-exhaustion | 예산 조기 소진 | 스펙 SR-6 | placed |
| ad-fatigue | 광고 피로 | 분야 표준 | placed |
| ads-budget-utilization | 예산 소진율 | 분야 표준 | placed |
| ads-ad-selection | 경매 · 순위 | concepts 절 구성 · 분야 표준 | placed |
| ad-auction | 광고 경매 | concepts D5 | placed |
| first-price-auction | 1차가 경매 | concepts D6 · ADR-0098 §5 | placed |
| second-price-auction | 2차가 경매 | concepts D7 | placed |
| gsp | GSP 경매 | concepts D7 | placed |
| vcg-auction | VCG 경매 | 분야 표준 | placed |
| ecpm-ranking | eCPM 순위 | concepts D9 | placed |
| ads-pctr | 예상 클릭률 (pCTR) | concepts D10 | placed |
| quality-score | 품질 점수 | concepts D20 | placed |
| ads-creative-exploration | 새 소재 탐색 | concepts D11 | placed |
| ads-position-debiasing | 위치 편향 보정 | concepts F11 | placed |
| ads-winners-curse | 승자의 저주 · 과지불 | 분야 표준 | placed |
| ads-new-creative-cold-start | 새 소재 콜드 스타트 | 분야 표준 | placed |
| ecpm | eCPM | concepts F6 | placed |
| ads-event-tracking | 노출 · 클릭 계측 | concepts 절 구성 · 분야 표준 | placed |
| ads-impression-tracking | 노출 계측 | concepts F2 | placed |
| viewability | 가시 노출 | concepts F3 · ADR-0098 §4 | placed |
| om-sdk | OM SDK | concepts F10 | placed |
| ads-click-redirect | 클릭 리다이렉트 | concepts F4 | placed |
| ads-event-dedup | 이벤트 중복 제거 | concepts F8 | placed |
| ads-event-ledger-copy | 이벤트 원장 사본 발행 | concepts F7 | placed |
| ads-event-retention | 계측 데이터 보존기간 | concepts F9 · ADR-0077 | placed |
| ctr | CTR | concepts F6 | placed |
| viewability-rate | 가시율 | 분야 표준 | placed |
| ads-attribution | 전환 · 어트리뷰션 | concepts 절 구성 · 분야 표준 | placed |
| conversion-tracking | 전환 추적 | concepts F5 | placed |
| attribution-modeling | 어트리뷰션 모델 | concepts F5 | placed |
| incrementality-testing | 증분 효과 측정 | 분야 표준 | placed |
| ads-cvr | 전환율 (CVR) | 분야 표준 | placed |
| roas | ROAS | 분야 표준 | placed |
| ads-ivt-defense | 무효 트래픽 방어 | concepts 절 구성 · 분야 표준 | placed |
| ads-crawler-filter | 크롤러 판정 | concepts G1 | placed |
| ads-self-click-block | 자기 클릭 방지 | concepts G3 · 스펙 SR-8 | placed |
| ads-click-rate-limit | 클릭 속도 제한 | concepts G4 | placed |
| ads-signed-token | 서명 노출 · 클릭 토큰 | concepts G5 · 스펙 SR-7 | placed |
| ads-clawback | 사후 수익 회수 | concepts G6 | placed |
| ads-sivt-detection | 정교한 무효 트래픽 탐지 | 분야 표준 | placed |
| invalid-traffic | 무효 트래픽 (IVT) | 스펙 SR-10 · 분야 표준(IVT) | placed |
| givt | GIVT (일반 무효 트래픽) | concepts G1 | placed |
| sivt | SIVT (정교한 무효 트래픽) | concepts G2 | placed |
| ads-token-replay | 토큰 위조 · 재사용 | 스펙 SR-7 | placed |
| ivt-rate | 무효 트래픽 비율 | 스펙 SR-10 · 분야 표준(IVT) | placed |
| ads-reporting | 리포트 | concepts 절 구성 · 분야 표준 | placed |
| ads-advertiser-report | 광고주 리포트 | concepts I1 | placed |
| ads-publisher-report | 퍼블리셔 리포트 | concepts I2 | placed |
| ads-ops-dashboard | 운영 대시보드 | concepts I3 | placed |
| ads-billing | 과금 | concepts 절 구성 · 분야 표준 | placed |
| ads-credit-topup | 크레딧 충전 | concepts H1 | placed |
| ads-realtime-spend-counter | 실시간 지출 카운터 | 스펙 SR-10 · SR-11 | placed |
| ads-billing-timing | 과금 확정 시점 | concepts H6 | placed |
| ads-settlement | 정산 | concepts 절 구성 · 분야 표준 | placed |
| ads-credit-ledger | 광고 크레딧 복식부기 원장 | concepts H2 · ADR-0098 §10 | placed |
| ads-settlement-idempotency | 정산 멱등 키 | 스펙 SR-12 | placed |
| revenue-share | 수익 배분 | concepts H4 | placed |
| ads-impression-based-payout | 노출당 정산 | concepts H5 | placed |
| ads-monthly-settlement | 월 정산 · 지급 기준액 | concepts H7 | placed |
| ads-credit-refund | 환불 · 잔액 소멸 | concepts H8 | placed |
| ads-publisher-payout-tax | 실결제 · 지급 · 세무 | concepts H9 | placed |
| ads-ledger-balance-check | 원장 합 검사 | 스펙 SR-12 | placed |
| ads-ledger-imbalance | 원장 불균형 | ADR-0098 §10 | placed |
| ads-regulatory-compliance | 광고 규제 준수 | concepts 절 구성 · 분야 표준 | placed |
| ads-ad-disclosure-label | 광고 라벨 표시 | concepts B12 | placed |
| ads-restricted-verticals | 금지 업종 | concepts B11 · ADR-0069 | placed |
| ads-creative-policy | 소재 정책 | concepts J5 | placed |
| ads-excluded-surfaces | 광고 게재 금지 면 | concepts J4 · ADR-0076 | placed |
| ads-privacy-notice-sync | 개인정보처리방침 동기화 | concepts J6 · ADR-0077 | placed |
| ads-privacy | 프라이버시 · 동의 | concepts 절 구성 · 분야 표준 | placed |
| consent-management | 동의 관리 (CMP) | 분야 표준 | placed |
| privacy-sandbox | Privacy Sandbox | concepts E8 | placed |
| third-party-cookie-deprecation | 3자 쿠키 소멸 | 분야 표준 | placed |
| ads-brand-safety | 브랜드 안전 | concepts 절 구성 · 분야 표준 | placed |
| brand-safety | 브랜드 안전 필터 | concepts E7 | placed |
| ads-unsafe-adjacency | 부적절한 인접 노출 | 분야 표준 | placed |
| ads-system-build | 광고 시스템 구축 | concepts 절 구성 · 분야 표준 | placed |
| ads-engagement-fold | engagement 폴드 | concepts K1 · ADR-0098 §1 | placed |
| ads-layer-standard | 광고 도메인 레이어 배치 | concepts K2 · ADR-0083 | placed |
| ads-house-absorption | game ads 흡수 | concepts K4 · ADR-0098 §7 | placed |
| ads-console-single-login | 광고주 콘솔 단일 로그인 | concepts K6 · ADR-0079 | placed |
| ads-free-tier-ceiling | 무료 티어 자원 상한 | concepts K5 | placed |
| ads-advertiser | 광고주 | concepts A1 | placed |
| ads-publisher | 퍼블리셔 | concepts A2 | placed |
| ads-buy-sell-side | 구매 쪽 · 판매 쪽 | concepts A4 | placed |
| ads-advertiser-account | 광고주 계정 | concepts B1 · 스펙 SR-3 | placed |
| ads-publisher-account | 퍼블리셔 계정 | concepts C1 | placed |
| ads-publisher-id | 게시자 ID | ADR-0076 §2 | placed |
| ads-campaign | 캠페인 | concepts B2 · 스펙 SR-4 | placed |
| ads-ad-group | 광고그룹 · 라인아이템 | concepts B3 | placed |
| ads-creative | 소재 | concepts B4 · 스펙 SR-4 | placed |
| ads-landing-url | 랜딩 URL · 클릭 URL | concepts B6 | placed |
| ads-budget | 일예산 · 총예산 | concepts B7 | placed |
| ads-bid | 입찰가 | concepts B9 | placed |
| ads-placement | 광고 단위 · 지면 (구좌) | concepts C4 · 스펙 SR-5 | placed |
| ads-ad-tag | 게재 코드 (광고 태그) | concepts C5 | placed |
| ads-inventory-catalog | 인벤토리 카탈로그 | concepts C10 | placed |
| ads-identity-key | 식별 키 | concepts F12 | placed |
| attribution-window | 어트리뷰션 기간 | 분야 표준 | placed |
| ads-ledger-accounts | 원장 계정 과목 | concepts H3 | placed |
| ads-disclosure-law | 광고 표시 의무 | concepts J1 | placed |
| ads-marketing-consent-law | 광고성 정보 전송 동의 | concepts J2 | placed |
| ads-behavioral-data-guideline | 행태정보 가이드라인 | concepts J3 | placed |
| prebid | Prebid.js · Prebid Server | concepts A7 | excluded — 벤더 한정 구현체 — header-bidding 의 동의어로 둔다 |
| vpaid | VPAID | 분야 표준 | excluded — 폐기된 규격 — simid 설명에 대체 관계로만 둔다 |
| ab-test | A/B 테스트 | 분야 표준 | excluded — owned by search (incrementality-testing 이 USES) |
| bandit-exploration | 밴딧 · Thompson Sampling | concepts D11 | excluded — owned by search (ads-creative-exploration · dynamic-creative-optimization 이 USES) |
| position-bias | 위치 편향 | concepts F11 | excluded — owned by search (ads-position-debiasing 이 MITIGATES) |
| inverse-propensity-scoring | 성향 역수 가중 | concepts F11 | excluded — owned by search (ads-position-debiasing 이 USES) |
| idempotency | 멱등성 | concepts F8 | excluded — owned by distributed (ads-event-dedup · ads-settlement-idempotency 가 USES) |
| rate-limiting | 레이트 리미팅 | concepts G4 | excluded — owned by security (ads-click-rate-limit 이 USES) |
| sec-hmac | HMAC | concepts G5 | excluded — owned by security (ads-signed-token 이 USES) |
| ord-double-entry | 복식부기 일반 | concepts H2 | excluded — owned by commerce-order (ads-credit-ledger 가 USES — 광고 구체형만 여기 둔다) |
| latency-budget | 지연 예산 일반 | concepts D15 | excluded — owned by observability — 광고 결정 값 ads-decision-latency-budget 만 둔다 |
| rec-ctr-prediction | CTR 예측 모델 | concepts D10 | excluded — owned by recommendation (ads-pctr 가 USES) |
| bayesian-smoothing | 베이지안 평활 | concepts D10 | excluded — owned by recommendation (ads-pctr 가 USES) |
