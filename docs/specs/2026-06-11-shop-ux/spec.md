# Spec — 쇼핑 UX (portal-fe 커머스 사용자 플로우)

> Status: Implemented (2026-06-12)
> Origin: 플랫폼 전반 갭 감사 (Track B). 백엔드 커머스 API 는 완성됐으나 사용자 쇼핑 화면이 전무했던 갭.

## Problem

Product/Order/Search/Inventory/Fulfillment 백엔드는 Saga 까지 완성됐는데, 사용자가 상품을
검색하고 주문할 수 있는 화면이 어디에도 없었다 (admin 백오피스만 존재). 포트폴리오 검토자가
클릭해볼 수 있는 커머스 플로우 부재.

## Scope

### Backend

| 변경 | 내용 |
|---|---|
| `GET /api/orders/my` 신설 | X-User-Id 기준 내 주문 목록 (최신순, items 포함). `GetMyOrdersUseCase` + `OrderRepositoryPort.findAllByUserId` |
| `GET /api/orders/{id}` 소유권 검증 | 타인 주문은 NOT_FOUND (존재 은닉). ROLE_ADMIN 은 전체 허용 |
| Gateway: 상품 GET 공개 | `product-service-read` (GET, 인증 없음) / `product-service-write` (인증) 분리 — 탐색은 public, 주문은 인증이라는 커머스 표준 |
| Gateway: 검색 공개 | `/api/search/**` 인증 제거 (userId 는 optional 필드, debug API 는 `/api/v1/search/debug` 로 gateway 비노출) |

### Frontend (portal-fe)

| Route | Page |
|---|---|
| `/shop` | 상품 검색(`/api/search/products`) + 브라우즈(`/api/products`), impression/click 이벤트 발행, 페이지네이션 |
| `/shop/products/:id` | 상세 + 수량 스테퍼 + 구매하기 (비로그인 시 로그인 유도) |
| `/shop/orders` | 내 주문 목록 (auth guard) |
| `/shop/login`, `/oauth/callback` | Kakao/Google OAuth (gifticon FE 패턴 이식, `portal_*` localStorage 키) |

- `src/api/shopApi.ts`: Bearer 첨부 + 401 시 1회 refresh-and-retry 인터셉터
- DESIGN.md `--ko-*` 토큰만 사용 (raw hex 금지; PrimaryButton text=white 는 §7 스펙 그대로)
- 데드코드 `TopNav.tsx` 삭제 (미사용 + 미정의 라우트 링크)
- GNB·ServiceCatalog 에 쇼핑 진입점 추가

## Known Follow-ups (스코프 외)

- **admin FE 주문 페이지가 미존재 API 호출 중**: `GET /api/orders?page=&size=&status=` (전체 목록)
  과 `PATCH /api/orders/{id}/status` 가 백엔드에 없음 — admin orders 화면은 조용히 빈 목록 표시.
  별도 작업 필요 (admin 용 paged list + 상태 변경 API).
- Cart 서비스 (현재는 상세 페이지에서 직접 주문 — backend 에 cart 개념 없음)
- OAuth redirect URI 등록: portal 도메인 `${origin}/oauth/callback` 을 Kakao/Google 콘솔에 추가 필요 (운영 작업)

## Verification

- `./gradlew :order:app:build :gateway:build` + 테스트 → BUILD SUCCESSFUL
- `portal-fe: tsc -b && vite build` ✓, `vitest --run` 11/11 ✓ (2026-06-12)
