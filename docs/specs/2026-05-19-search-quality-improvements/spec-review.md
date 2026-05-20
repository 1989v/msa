<!-- source: search -->
# Spec Review — 5-Dimension Check

리뷰 일자: 2026-05-19
리뷰 대상: `spec.md`, `requirements.md`, `ADR-0050`

## D1. 완성도 (Completeness)
- ✅ 5개 영역 (신호확장 / MAB확장 / 평가 / 디버그UI / 운영) 모두 다룸
- ✅ 마이그레이션 시나리오, 롤백 시나리오, 의존성 명시
- ✅ Out of Scope 명확 (LinUCB, Vector, synonyms graph 운영 자동화)
- ⚠️ Phase 3 의 product `brand` 필드 합의 절차가 spec 외부 의존 → tasks.md 에서 명시적 task 로 분리 필요
- 판정: **PASS**

## D2. 일관성 (Consistency)
- ✅ ADR-0050 ↔ spec ↔ requirements 의 Phase 분류 일치
- ✅ ADR-0043 (Thompson MAB) 의 P2/P3 흡수 영역 명시
- ✅ ADR-0017 (analytics 책임) 위배 없음 — 스무딩/GMV 산출은 analytics 측
- ⚠️ `BanditKey` 일반화는 ADR-0043 의 P3 (Contextual Bandit) 와 다름 — 본 ADR 은 multi-bucket blend 의 정적 weight, contextual feature 없음. spec.md §3.1 에 명시 추가 권장
- 판정: **PASS w/ minor**

## D3. 실현 가능성 (Feasibility)
- ✅ Phase 1 은 코드 변경 < 100 LoC, 즉시 적용 가능
- ✅ Phase 2 의 ES alias swap 절차는 기존 `IndexAliasManager` 재사용
- ✅ Phase 4 의 Spring Batch + ClickHouse 는 기존 인프라 활용
- ⚠️ Phase 4 admin-fe UI 는 5~10md 소요 예상 (좌우 비교 + score breakdown 카드) — 분리 spec 후보
- ⚠️ Phase 3 의 brand 필드 추가는 product 서비스 변경 동반 → cross-team 협의 비용
- 판정: **PASS w/ caveats**

## D4. 리스크 (Risk)
- ✅ 회귀 보호: 신규 weight default 0 / enabled=false
- ✅ ADR-0025 latency 영향 검토 — top-N 한정 in-memory 처리
- ✅ alias swap 롤백 절차 존재
- ⚠️ judgment set 약지도의 self-fulfilling prophecy 위험을 ADR-0050 Consequences 에 명시 → 정기 spot-check 절차 추가 필요 (tasks.md P4 에 포함)
- ⚠️ Redis MAB state 메모리 (scope 확장 시 약 10x) — TTL/LRU 정책 미상세 → spec 보완 필요
- 판정: **REVISE** (minor)

## D5. 측정 가능성 (Measurability)
- ✅ 성공 기준 표 (requirements §7) 정량적
- ✅ 신규 메트릭 (`search.feature_score.distribution`, `search.eval.ndcg10`, `search.diversity.unique_sellers_at_k`)
- ✅ Grafana 대시보드 명시
- ⚠️ Phase 1 의 freshness/CVR ramp 시 baseline 비교 데이터 어디서 — Phase 4 인프라가 선행 안 되면 객관 측정 불가. spec §5 마이그레이션 시나리오에 "D+21 평가 잡 가동 후 Phase 2 ramp" 로 순서 보정 됨 ✓
- 판정: **PASS**

## 종합 판정
**SHIP w/ minor revisions** — 다음 항목을 tasks.md 에서 명시:
1. (D1/D3) product `brand` 필드 합의 task 분리
2. (D2) `BanditKey` 일반화 vs Contextual Bandit 차이를 spec.md §3.1 에 1-2줄 추가
3. (D4) Redis MAB state TTL/LRU 정책 — Phase 3 task 에 sub-task 로 명시
4. (D4) judgment set 정기 spot-check 절차 — Phase 4 task 에 운영 가이드 포함
5. (D5) baseline 비교 데이터 기록 위치 (`docs/benchmarks/search-quality-baseline.md`) — Phase 1 task 에 포함
