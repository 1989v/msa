# ADR-0041 — Quant 뉴스·공시 피드

- **Status**: Proposed (별도 spec / 후속 사이클 진행)
- **Date**: 2026-05-09
- **Deciders**: 운영자
- **Related**: ADR-0038 (차트 페이지 토스급 Foundation)

---

## Context

토스 종목 상세의 "뉴스·공시" 탭은 종목별 실시간 뉴스 + 공시 자료 표시. P1 Foundation 의 ChartsPage 'news' 탭은 disabled placeholder.

뉴스 source 후보:
- **Yahoo Finance v8**: `news` query — 무료, US 종목 위주
- **NewsAPI.org**: 유료 ($449/mo Basic) — 글로벌 뉴스
- **Naver 뉴스 API**: KR 뉴스, 검색 API 무료 (월 25,000건 한도)
- **DART (전자공시)**: KR 공시 자료 — 무료, OpenDART API
- **GDELT**: 글로벌 뉴스, 무료 + 무한, 그러나 실시간성 약함

---

## Decision

### D1. 자산 클래스별 source 분리
- **STOCK_US (Yahoo)**: Yahoo Finance v8 news API
- **STOCK_KR (FDR_KR)**: Naver 뉴스 검색 API + DART 공시
- **CRYPTO**: 별도 — 코인 뉴스 source (CoinDesk RSS 등) 또는 미지원
- **다국어**: 영어/한국어 자동 감지 + 표시

### D2. 백엔드
- `application/port/external/NewsPort.kt` — interface
- `infrastructure/external/YahooNewsAdapter.kt` (US)
- `infrastructure/external/NaverNewsAdapter.kt` (KR, API key 필요)
- `infrastructure/external/DartDisclosureAdapter.kt` (KR 공시)
- 라우팅: 자산 클래스에 따라 적절한 adapter 호출
- Caffeine 캐시 (TTL 10분) — 뉴스는 갱신 빈도 중간

### D3. 도메인
```kotlin
data class NewsItem(
  val asset: AssetCode, val market: MarketCode,
  val title: String,
  val source: String,        // "Yahoo Finance" / "Naver" / "DART"
  val url: String,
  val publishedAt: Instant,
  val summary: String?,      // 옵션 (LLM 요약 — 후속)
  val kind: NewsKind,        // 'NEWS' | 'DISCLOSURE'
)

enum class NewsKind { NEWS, DISCLOSURE }
```

### D4. FE
- `charting/components/NewsFeed.tsx` 신규 — list 형태, NEWS / DISCLOSURE 필터
- ChartsPage 의 'news' 탭 disabled 해제 → 활성

### D5. 모더레이션 / 신뢰도
- 외부 RSS / 비공식 source 제외 (피싱/사기 위험)
- DART 공시는 정부 공식 source 라 안전

### D6. LLM 요약 (옵션)
- 뉴스 본문 → GPT/Claude 한 줄 요약 (별도 ADR-0010 LLM)
- 비용/지연 trade-off → P3 이후

---

## Consequences

### Positive
- 토스급 정보 풍부도
- DART 공시는 KR 사용자에게 차별화 가치

### Negative / Risks
- API key 관리 (Naver, Yahoo) — secrets 인프라 (KEK envelope ADR-0027) 활용
- 뉴스 본문 표시 시 라이선스 — 제목+요약+source link 만 (full content 표시 X)
- Naver API 일일 한도 초과 시 fallback (캐시 오래 유지)
- 뉴스 source 별 응답 latency 차이 (ko=빠름, us=중간)

---

## Phase

| Phase | 범위 |
|---|---|
| PA | YahooNewsAdapter + DartDisclosureAdapter (무료 API 만) + FE NewsFeed |
| PB | NaverNewsAdapter + API key + 모더레이션 |
| PC | LLM 요약 (옵션) |

---

## Open Questions

- OQ-NF-01: API key 비밀번호 관리 (Vault / OCI Vault — ADR-0027 KEK envelope)
- OQ-NF-02: 뉴스 표시 라이선스 — 한국 신문 협회 약관 조사
- OQ-NF-03: 새 뉴스 알림 (push) 도입 여부 — 종목별 watchlist 와 연동
