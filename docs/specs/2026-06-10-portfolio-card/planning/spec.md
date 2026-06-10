# Spec — Portfolio Card (code-dictionary + portal-fe)

> Status: Implemented (retro-documented 2026-06-10 — 코드 선행 후 스펙 사후 작성. 파이프라인 위반 정정 목적)
> Service: code-dictionary (BE) / portal-fe (FE)

## 1. Overview

포트폴리오 카드 — 프로젝트·기능·트러블슈팅·학습 항목을 카드 단위로 적재하고,
portal-fe `/portfolio` 페이지에서 시간순/임팩트순 정렬 + 태그(스택) 필터 + 키워드 검색으로 노출한다.
code-dictionary 서비스에 도메인을 두고(PUBLIC 카드만 외부 노출), 어드민/seed 로 데이터를 관리한다.

## 2. Domain Model

`com.kgd.codedictionary.domain.portfolio`

| 항목 | 내용 |
|---|---|
| Aggregate | `PortfolioCard` — private constructor + `create()`/`restore()` 팩토리 |
| VO | `Visibility` enum: `PUBLIC` / `PRIVATE` |
| 불변식 | title/body 비어있지 않음, `impact ∈ [1,10]`, `periodEnd >= periodStart` |

## 3. Persistence

- 테이블: `portfolio_card` (Flyway `V5__portfolio_card.sql`, CHECK 제약 + visibility/impact/period_end/created_at 인덱스)
- `PortfolioCardJpaEntity`: 모든 가변 컬럼 `var + private set`, 변경은 `update(card)` 전체 동기화 메서드로만 (entity-mutation.md)
- `visibility`: `@Enumerated(EnumType.STRING)` (jpa-persistence.md §2)
- `tags`/`keywords`: JSON 컬럼 + `StringListJsonConverter`
- 동적 검색(가시성 + 키워드 LIKE + 페이지네이션)은 `PortfolioCardQueryRepository` (Querydsl, jpa-persistence.md §5). `PortfolioCardJpaRepository` 는 CRUD 전용

## 4. API

Base: `/api/v1/portfolio` — 응답은 `ApiResponse<T>` 포맷.

| Method | Path | Params | 응답 |
|---|---|---|---|
| GET | `/cards` | `sort`(time\|impact, 기본 time), `stack`(csv 태그, AND 매칭), `q`(키워드 — 제목/요약/본문), `page`(0), `size`(50) | `Page<PortfolioCardSummaryDto>` |
| GET | `/cards/{id}` | — | `PortfolioCardDetailDto` |

- 두 엔드포인트 모두 `PUBLIC` 카드만 노출. PRIVATE 카드 상세 조회 시 NOT_FOUND (존재 여부 은닉)
- 정렬: time → `createdAt DESC`, impact → `impact DESC, createdAt DESC`
- stack 필터는 페이지 조회 후 메모리 필터 (카드 수 소규모 전제 — 카드 수가 커지면 JSON 검색으로 이전)

## 5. Frontend (portal-fe)

- Route: `/portfolio` (`PortfolioPage.tsx`)
- 검색(200ms debounce) + 정렬 세그먼트 + 태그 칩 필터(다중 AND) + 카드 그리드 + 상세 모달
- DESIGN.md 토큰만 사용 (`--ko-*` CSS 변수, raw hex 금지). 모션은 `--ko-duration-*` (prefers-reduced-motion 은 tokens.css 에서 0ms 처리)
- a11y: 모달 `role="dialog"` + `aria-modal` + ESC 닫기 + 포커스 이동, 카드 키보드 접근(`role="button"` + Enter/Space), 태그 칩 `aria-pressed`, 에러 `role="alert"`
- API 클라이언트: `portfolioApi.ts` — axios timeout 10s, 목록/상세 에러 상태 분리 표시

## 6. Non-Goals (이번 범위 제외)

- 쓰기 API (생성/수정/삭제 어드민 엔드포인트) — seed DML(`code-dictionary/docs/portfolio-dummy-seed.sql`)로 대체, 어드민 CRUD 는 후속
- 인증/권한 — PUBLIC 전용 읽기라 불필요
- 페이지네이션 UI — 기본 size 50 단일 페이지

## 7. References

- 컨벤션: `docs/conventions/entity-mutation.md`, `docs/conventions/jpa-persistence.md`
- 디자인: `DESIGN.md`, `docs/conventions/frontend-design.md`
- seed: `code-dictionary/docs/portfolio-seed.md`
