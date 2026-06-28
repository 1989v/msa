# ADR-0057 검색 A/B 변형 할당의 식별자 전략 — anonymousId 도입 + 데이터 레이어 그루핑

## Status
Accepted (2026-06-21) — search/gateway 구현 반영. 클라이언트 SDK 의 `anonymousId` 발급은 별도 작업.

## Context

`search` 의 온라인 A/B 변형(variant) 할당은 현재 **로그인 사용자만** 실험에 넣는다.

- `SearchProductUseCase.Query` 의 식별자는 `userId: String?` 단일 필드이며,
  주석상 "null 이면 실험 미참여(기본 ranking)" 이다
  (`search/app/src/main/kotlin/com/kgd/search/product/usecase/SearchProductUseCase.kt:8-14`).
- `SearchProductService.resolveVariant(userId)` 는 실험 비활성이거나 `userId` 가
  null/blank 이면 즉시 `null` 을 반환한다
  (`search/app/src/main/kotlin/com/kgd/search/product/service/SearchProductService.kt:62-65`).
- `userId` 는 컨트롤러에서 **쿼리 파라미터**(`@RequestParam(required = false)`) 로 받는다
  (`search/.../controller/SearchController.kt:27-36`).
- gateway 의 검색 라우트는 **public** 이라 인증 필터를 타지 않으며 `X-User-Id` 헤더도 주입되지 않는다
  (`gateway/.../config/GatewayRouteConfig.kt:131-137`, 대비:
  `gateway/.../filter/AuthenticationGatewayFilter.kt:65-68` 은 보호 라우트에서만 `X-User-Id` 주입).
- 버킷팅 자체는 `BucketAssigner.assign(id, experimentId, weights)` — MurmurHash3 32-bit, 10000 버킷의
  결정적 해시로, **식별자 타입에 무관하게** 동작한다 (`common/.../analytics/BucketAssigner.kt`).
  experiment 서비스의 할당 엔드포인트도 단일 `id` 문자열만 요구한다
  (`experiment/.../usecase/AssignBucketUseCase.kt`).

이 구조의 한계:

1. **모집단 편향 (selection bias)** — 검색 트래픽 상당 비중이 비로그인이다. 로그인 유저만 실험에
   넣으면 이미 구매 의향이 높은 집단에만 측정한 결과가 되어 전체 트래픽으로 일반화할 수 없다.
2. **할당 불안정 (sticky 불가)** — 같은 사람이 로그인 전후로 다른 버킷에 들어간다. 비로그인 시 null →
   로그인 시 variant A. 세션 내 노출 일관성이 깨진다.
3. **식별자 신뢰성 부재** — `userId` 가 쿼리 파라미터라 임의 값 주입이 가능하다. 클라이언트가 남의
   userId 를 넣어 실험군을 조작하거나 측정을 오염시킬 수 있다.

버킷팅 함수(`BucketAssigner`)는 입력 식별자만 안정적이면 로그인 여부와 무관하게 잘 동작한다.
병목은 **입력 식별자가 로그인 유저로 한정**되어 있는 점과 **전달 경로가 신뢰 불가(쿼리 파라미터)** 인 점이다.
현재 실험은 기본 비활성(`search.experiment.enabled=false`) 이라 라이브 영향 전, 즉 식별자 설계를 고치기 좋은 시점이다.

## Decision

### 1. 익명 식별자 `anonymousId` 도입

로그인 여부와 무관한 **안정적 익명 식별자** `anonymousId` 를 도입한다.

- **발급 주체: 클라이언트**. 최초 방문/실행 시 식별자가 없으면 1회 생성한다.
- **생성 방식: 랜덤 ULID/UUIDv4**. 디바이스 하드웨어 속성(시리얼·MAC·광고 식별자 등)에서
  **유도하지 않는다** (§Legal & Privacy 참조).
- **저장: 클라이언트 영속 저장소** — 웹은 쿠키, 앱은 로컬 영속 스토리지. 저장소가 비워지면
  새 식별자가 발급된다(= "디바이스 단위"의 실제 경계는 저장소 스코프이지 하드웨어가 아님).
- **전달: 요청 헤더 `X-Anonymous-Id`**. 쿼리 파라미터 금지.

### 2. 버킷팅 키 일반화 — `assignmentKey = userId ?: anonymousId`

할당 식별자를 `userId` 단일에서 **coalesce** 형태로 일반화한다.

```
assignmentKey = userId ?: anonymousId      // 둘 다 없으면 실험 미참여(기존 동작 유지)
```

- 로그인 유저: `userId` 로 버킷팅 (기존과 동일).
- 비로그인 유저: `anonymousId` 로 버킷팅 (신규 — 실험 모집단에 포함).
- `BucketAssigner`(MurmurHash3, 10000 버킷)는 **변경 없이 그대로 사용**. 키 문자열만 바뀐다.

### 3. 식별자는 헤더로, gateway 가 정규화

- 검색 라우트에 **optional 인증**을 적용한다. JWT 가 있으면 gateway 가 `X-User-Id` 를 주입한다
  (`AuthenticationGatewayFilter` 의 기존 주입 경로 재사용). JWT 가 없어도 검색은 계속 public 으로 동작한다.
- gateway 는 클라이언트의 `X-Anonymous-Id` 를 **포맷 검증 후 그대로 forward** 한다.
  형식 불일치는 폐기한다(주입된 신뢰 헤더만 downstream 이 신뢰).
- (웹 fallback) `X-Anonymous-Id` 가 없는 웹 요청에 한해 gateway 가 식별자를 1회 mint 하여
  `Set-Cookie` (HttpOnly) 로 내려주고 같은 요청에 forward 할 수 있다. 앱은 클라이언트 발급을 원칙으로 한다.
- search 컨트롤러는 `userId`/`anonymousId` 를 **헤더에서** 바인딩한다. 쿼리 파라미터 `userId` 는 폐기한다.

### 4. identity resolution 은 데이터 레이어 책임 — 서비스에 매핑 테이블 금지

동일 인물의 웹/앱 식별자 그루핑(userId ↔ anonymousId stitching)은 **서비스가 할당 시점에 하지 않는다**.

- search 의 exposure(impression/click) 이벤트 페이로드에 **`userId` 와 `anonymousId` 를 둘 다 태깅**한다
  (ADR-0043 의 이벤트에 `anonymousId` 필드 추가).
- 같은 이벤트에 두 식별자가 함께 쌓이므로, 분석/데이터 웨어하우스 레이어에서 join 으로
  동일 인물의 식별자를 묶는다(identity resolution = 데이터 레이어 책임).
- search 서비스 안에 identity graph / alias 테이블 / 실시간 매핑 캐시를 **만들지 않는다** (오버엔지니어링 회피).

### 5. 노출 일관성(cross-device sticky)은 Non-Goal

- 비로그인(anonymousId 버킷) 사용자가 로그인하면 `userId` 버킷으로 바뀌어 **다른 변형을 볼 수 있다**.
  마찬가지로 같은 사람의 웹/앱 식별자가 다르면 서로 다른 변형을 볼 수 있다.
- 이는 본 ADR 의 **명시적 비목표**다. 분석 단계에서 식별자가 묶이므로 실험 측정 자체는 성립한다.
- 노출 일관성 보장(= 버킷팅 전 canonical id 정규화)은 로그인 시점 실시간 매핑 인프라를 요구하므로,
  실제로 실험 신뢰도 문제가 입증될 때 **별도 ADR** 로 다룬다.

## Legal & Privacy

> 일반 가이드. 적용 전 개인정보보호 담당 검토 권장.

- **하드웨어 유도 식별자 금지** — 단말 시리얼/통신 식별자/광고 식별자에서 파생한 값을 식별자로 쓰지 않는다.
  `anonymousId` 는 순수 랜덤 생성값이다.
- **리셋 가능성 보장** — 클라이언트 저장소를 비우면(쿠키 삭제/앱 재설치) 새 식별자가 발급된다 →
  사용자의 식별자 초기화 권리를 실질 보장한다.
- **처리 목적 한정** — `anonymousId` 는 **서비스 개선(검색 품질 실험)** 목적으로만 처리한다.
  마케팅/광고 타겟팅으로 목적을 확장하려면 별도 동의 설계가 필요하다.
- `anonymousId` 가 `userId` 또는 행동 데이터와 결합되면 개인정보 처리에 해당할 수 있으므로,
  처리방침 고지 범위 안에서 운용한다.

## Alternatives Considered

| 대안 | 평가 |
|---|---|
| **현행 유지 (userId 단일, 쿼리 파라미터)** | 비로그인 실험 제외(편향) + 식별자 spoofing. 명시적 기각. |
| **할당 시점 userId↔anonymousId 매핑(서비스 내 identity graph)** | 노출 일관성은 얻지만 로그인 시 실시간 매핑 조회 인프라(매핑 저장소/캐시) 필요. 비용 대비 효용 낮음 → Non-Goal 로 분리. |
| **하드웨어 기반 디바이스 지문** | 단말 식별자 수집 규제 + 리셋 불가로 프라이버시 리스크. 기각(§Legal). |
| **BucketAssigner 교체(다른 해시)** | 현 MurmurHash3 + 10000 버킷이 분포·식별자 타입 자유도 모두 충분. 변경 불필요. |
| **익명 식별자도 쿼리 파라미터로 전달** | 신뢰성 동일 문제(조작 가능). 헤더 + gateway 정규화로 기각. |

## Consequences

### Positive
- 비로그인 트래픽이 실험 모집단에 포함 → 측정 편향 해소, 전체 트래픽 일반화 가능.
- 식별자가 헤더 + gateway 정규화 경로 → 쿼리 파라미터 spoofing 차단.
- 두 식별자 동시 로깅 → 데이터 레이어에서 웹/앱 그루핑 가능(서비스 부담 0).
- `BucketAssigner` 무변경 — 키 문자열만 교체하는 최소 침습 변경.

### Negative / Risk
- **노출 일관성 미보장** — 로그인 전후/디바이스 간 변형이 달라질 수 있음(Non-Goal 로 수용).
- **클라이언트 의존** — `anonymousId` 발급/저장은 클라이언트 책임. 웹 fallback(gateway 쿠키 발급)으로 일부 완화.
- **gateway 변경 필요** — 검색 라우트 optional 인증 + `X-Anonymous-Id` 검증/forward.
- **anonymousId 도 개인정보 취급 가능** — 처리방침 고지·목적 한정 운영 필요(§Legal).

### 영향받는 코드 (구현 시)
| 위치 | 변경 |
|---|---|
| `SearchProductUseCase.Query` | `userId: String?` → `userId`/`anonymousId` 두 필드, usecase 에서 `userId ?: anonymousId` coalesce |
| `SearchProductService.resolveVariant` | 인자를 `assignmentKey` 로 일반화 (둘 다 null 이면 기존대로 null) |
| `SearchController` | `@RequestParam userId` 제거 → `@RequestHeader X-User-Id`/`X-Anonymous-Id` 바인딩 |
| `GatewayRouteConfig` 검색 라우트 | optional 인증 적용, `X-Anonymous-Id` 검증/forward, (옵션) 웹 fallback 쿠키 |
| exposure 이벤트(ADR-0043) | impression/click 페이로드에 `anonymousId` 필드 추가 |

## 관련 문서
- `docs/adr/ADR-0043-search-online-bandit-thompson.md` — exposure 이벤트(impression/click) 페이로드에 `anonymousId` 추가 지점
- `search/CLAUDE.md` — 검색 서비스 개요
- `gateway/CLAUDE.md` — 인증 필터 / 헤더 주입 정책
