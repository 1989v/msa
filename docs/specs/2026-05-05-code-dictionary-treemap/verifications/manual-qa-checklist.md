<!-- source: code-dictionary -->
<!-- source: portal-fe -->
# Manual QA Checklist — Code Dictionary Treemap

> **Manual execution required — defer to QA pass before production rollout.**
>
> 본 체크리스트는 `planning/test-quality.md` §Manual QA Checklist (lines 126-140) 의
> 자동화 불가 항목을 모은 것이다. CI 게이트(BE test / FE test / lint / build /
> doc_map.py --check)와 별개로 PR 리뷰어/QA 가 직접 수행한다.

## 실행 환경

- 브라우저: Chrome 최신 (DevTools + Lighthouse + axe DevTools 확장)
- OS: macOS (다른 OS 도 가능, prefers-reduced-motion 토글이 가능한 환경)
- 타깃 URL:
  - 사용자 FE: `http://localhost:5173` 또는 ingress 경유 prod overlay URL
  - admin FE: `http://localhost:5174`
  - Gateway 경유 BE: `http://localhost:8080/api/v1/concepts/stats/treemap`

## 체크리스트

### 1. 모바일 viewport — chip overflow & layout

- [ ] 375 × 667 (iPhone SE) viewport 에서 chip strip 가로 스크롤 정상
      (chip strip 컨테이너 내부에 한정, 페이지 레벨 가로 스크롤 발생하지 않음)
- [ ] 414 × 896 (iPhone 11 Pro Max) viewport 에서도 동일하게 정상
- [ ] 모바일에서 트리맵 aspectRatio 가 1:1 로 적용 (desktop 16:9 와 구분)
- [ ] tile 최소 터치 영역 44 × 44 px 이상

### 2. 키보드 접근성

- [ ] 카테고리 chip Tab 순서 자연스러움 (좌→우)
- [ ] chip strip 외부에서 페이지 가로 스크롤 발생하지 않음
- [ ] Tab → tile 으로 포커스 이동 + Enter/Space 로 활성화
- [ ] focus-visible outline (`var(--focus-ring)`) 2-3 px 가시성 양호

### 3. 색상 & 대비 (WCAG AA)

- [ ] tile 색상 대비 WCAG AA 통과 (Chrome DevTools Lighthouse / axe DevTools)
- [ ] 색상에만 의존하지 않고 라벨만으로 level 구분 가능
      (OKLCH lightness sequential 의도 — BEGINNER cool light → ADVANCED warm deep 차이를
       텍스트 라벨로도 보강)
- [ ] 범례 텍스트 + 카운트가 색상 단독 의존을 보강

### 4. tile 라벨 처리

- [ ] 작은 면적 tile 에서 라벨 잘림 처리 정상
      (이름 + indexCount > 이름 단독 > 생략 우선순위)
- [ ] tooltip (hover) 에 이름, level, indexCount, category 모두 표시

### 5. 인터랙션 동선

- [ ] 사용자 FE: tile click → concept detail 라우팅 (`/concepts/{conceptId}` 또는 SidePanel)
- [ ] admin FE: tile click → edit 다이얼로그 즉시 오픈 + concept 정보 prefill
- [ ] chip click → 해당 카테고리만 트리맵 렌더 (미선택 시 전체)
- [ ] "전체" chip click → 모든 카테고리 표시로 복원

### 6. Gateway / 인프라

- [ ] Gateway 경유 호출 (`http://localhost:8080/api/v1/concepts/stats/treemap`) 200 OK
- [ ] K8s overlay (`k3s-lite`) 에서 ingress → gateway → code-dictionary 라우팅 정상
- [ ] prod overlay (managed K8s) 에서도 동일 경로 200 OK

### 7. 관측 가능성 (Observability)

- [ ] `cache.gets`, `cache.puts`, `cache.evictions` 메트릭이
      `/actuator/metrics` 에서 노출 (Micrometer Caffeine 통합)
- [ ] `http.server.requests` percentile histogram 이
      `tag=uri:/api/v1/concepts/stats/treemap` 으로 노출 (P99 알람용)
- [ ] CUD 후 다음 stats 호출이 fresh 데이터 반환 (캐시 invalidation 동작)

### 8. Reduced Motion

- [ ] OS 의 `prefers-reduced-motion: reduce` 설정 시 transition / motion 비활성
      (macOS: 시스템 설정 → 손쉬운 사용 → 디스플레이 → 동작 줄이기)
- [ ] tile hover scale(1.02) 도 reduced-motion 시 비활성

### 9. axe DevTools (a11y 자동 검사)

- [ ] axe DevTools 실행 → 0 critical issue
- [ ] tile 의 `role="treeitem"` + `aria-label="{name}, {level}, indexCount {n}"` 부착 확인
- [ ] chip strip 의 `role="tablist"` + 각 chip `role="tab" aria-selected` 부착 확인

### 10. AI Slop 자가 점검 (`docs/conventions/frontend-design.md`)

- [ ] side-stripe border 없음 (좌측 색상 띠 X)
- [ ] gradient text 없음 (`background-clip: text` 그라데이션 X)
- [ ] glow shadow 없음 (`box-shadow` 의 강한 색 발광 효과 X)
- [ ] purple gradient 없음 (보라/마젠타 그라데이션 배경 X)
- [ ] bounce / elastic / overshoot motion 없음
      (`cubic-bezier` overshoot, spring physics, `keyframes bounce` X)
- [ ] tile hover transition 100-150 ms `opacity` + `transform: scale(1.02)` 만 사용

### 11. 응답 페이로드 size

- [ ] `curl http://localhost:8080/api/v1/concepts/stats/treemap | wc -c` 결과 < 100 KB
      (NFR2 — concept 500 개 기준)

## 검증 결과 기록

| 일자 | QA | 통과 항목 / 전체 | 비고 |
|---|---|---|---|
| (수기) | (이름) | / 11 | (특이사항) |

- 11 개 모든 항목 통과 시 production rollout 승인.
- critical 항목 (3, 6, 9, 10) 중 하나라도 실패 시 rollout 차단.
- 그 외 항목 실패 시 follow-up issue 생성 후 합의 하 release 가능.

## 참조

- `planning/test-quality.md` lines 126-140 (원본 체크리스트)
- `planning/spec.md` §6 Frontend Design (lines 166-276)
- `docs/conventions/frontend-design.md` (AI Slop 방지, OKLCH, WCAG AA)
- ADR-0025 (latency Tier 1 P99 200ms)
- `docs/standards/doc-index-tracking.md` (CI 게이트 doc_map.py)
