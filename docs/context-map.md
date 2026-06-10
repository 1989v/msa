# Context Map — Commerce Platform (MSA)

> 본 문서는 멀티 Bounded Context(BC) 프로젝트의 **glossary 위치 인덱스**다.
> 각 BC는 자체 `glossary.md`(유비쿼터스 사전)를 가지며, `/hns:glossary` 등 hns 스킬은 이 매핑을 따른다.
>
> 표준 정의 → `hns` 플러그인 `references/language-reference.md`

## Status

- **Phase**: Bootstrap (auto-scan 1차 draft)
- **Source**: `/hns:glossary --scan` (hns v0.8.0, 자동 추출 시점: 2026-05-11)
- **Next**: 각 BC에서 `/hns:glossary` 새 세션 실행 → grilling → Definition/Avoid/Code 보강

## BC ↔ Glossary 매핑

| BC | Root | Glossary | 핵심 도메인 명사 (auto-extracted) |
|---|---|---|---|
| product | `product/` | `product/glossary.md` | Product, Money |
| order | `order/` | `order/glossary.md` | Order, OrderItem |
| search | `search/` | `search/glossary.md` | ProductDocument, BanditState, BanditPosterior |
| member | `member/` | `member/glossary.md` | Member, SsoProvider |
| auth | `auth/` | `auth/glossary.md` | Role, AuthProvider, MemberRole |
| inventory | `inventory/` | `inventory/glossary.md` | Inventory, Reservation, InventoryEvent |
| fulfillment | `fulfillment/` | `fulfillment/glossary.md` | FulfillmentOrder |
| warehouse | `warehouse/` | `warehouse/glossary.md` | Warehouse |
| gifticon | `gifticon/` | `gifticon/glossary.md` | Gifticon, Brand, ExpiryDate, ShareGroup, ShareMember, ViewMark |
| chatbot | `chatbot/` | `chatbot/glossary.md` | Conversation, Message, AccessDecision |
| analytics | `analytics/` | `analytics/glossary.md` | KeywordScore, ProductScore, ScoreStats |
| experiment | `experiment/` | `experiment/glossary.md` | Experiment, Variant, StatisticalSignificance |
| wishlist | `wishlist/` | `wishlist/glossary.md` | WishlistItem |
| quant | `quant/` | `quant/glossary.md` | Asset, Execution, Fundamentals, KillSwitch, HybridStrategy, OrderCommand, PriceTick, RiskLimit |
| code-dictionary | `code-dictionary/` | `code-dictionary/glossary.md` | Concept, CodeLocation, ConceptIndex |

## Cross-Context Shared Terms

여러 BC에서 동일 단어가 등장할 때 의미가 다르면 BC별로 정의를 분리해야 한다.

- **Money** — product, order 양쪽에서 등장 (현재는 동일 의미로 추정) → 정의 일치 여부 확인 필요
- **Order** — order BC의 핵심 도메인, fulfillment의 `FulfillmentOrder`, quant의 `OrderCommand`와 명확히 구분 필요
- **Reservation** — inventory BC의 핵심 도메인, mrt-package의 외부 `reservation`과 혼동 주의
- **Role** — auth BC가 권한 모델로 정의. member BC의 `MemberRole`은 auth의 Role을 참조하는 외래 개념

## Excluded
- **agent-viewer** — `api` 모듈만 존재, 자체 도메인 없음 (다른 BC의 viewer)
- **common** — 인프라 공통, 도메인 어휘 없음
- **gateway** — 인프라 (K8s DNS 라우팅; discovery/Eureka 는 ADR-0019 에서 제거됨)

## How to Use

1. 새 피처 작업 시작 시 어느 BC인지 식별
2. 해당 BC의 `{bc}/glossary.md` 로드
3. `/hns:start`는 이 매핑을 PHASE 0에서 자동 참조
4. 용어 충돌·신조어 발견 시 `/hns:glossary --conflict {term}`

## Maintenance

- 새 BC 추가 시 위 표에 한 줄 + `{bc}/glossary.md` 생성
- BC 이름 변경 시 Migration 로그를 ADR로 작성 (`docs/adr/`)
- Cross-Context Shared Terms는 정기적으로 (분기 1회 권장) 점검 — 동의어 충돌 회귀 차단
