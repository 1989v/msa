---
parent: 18-grpc
seq: 17
title: proto 파일 monorepo 전략 — 위치 / 빌드 / 거버넌스
type: deep
created: 2026-05-01
---

# 17. proto monorepo 전략

> proto 파일이 흩어지면 **silent breaking** 의 온상. msa 는 monorepo 라 자연스러운 정착 위치가 있다.

## 1. proto 파일 어디에 둘까 — 4 옵션

| 옵션 | 위치 | 빌드 |
|---|---|---|
| A | **각 서비스 내** (`order/proto/`, `product/proto/`) | 서비스마다 자체 생성 |
| B | **전용 모듈** (`:proto-commerce`, `proto/` 디렉토리) | 한 곳에서 생성, jar 로 배포 |
| C | **별도 git repo** (`msa-proto.git`) | 외부 의존성 |
| D | **Buf Schema Registry (BSR)** | 외부 registry, 버전 pin |

msa 의 monorepo 구조에서 **B (전용 모듈)** 가 균형점.

## 2. 옵션 비교

### 옵션 A — 각 서비스 내

```
order/proto/order.proto
product/proto/product.proto
order/proto/product.proto   ← 복제됨 (위험)
```

- 장점: 단순, 서비스 자치
- 단점: **proto 복제 + drift 위험**, 의존성 그래프 불명확
- ⇒ 비추천 (msa 의 통합 가치 손실)

### 옵션 B — 전용 모듈 (`:proto-commerce`) — 추천

```
proto/
  src/main/proto/
    commerce/
      product/v1/product.proto
      product/v1/product_service.proto
      order/v1/order.proto
      order/v1/order_service.proto
      inventory/v1/inventory_service.proto
    common/
      error/v1/error_details.proto
      pagination/v1/page.proto
  build.gradle.kts
buf.yaml
buf.gen.yaml
```

- 장점: monorepo 의 강점 활용, 빌드 캐시, 단일 진실
- 단점: proto 변경 시 의존 모듈 재빌드
- gradle 의존: `implementation(project(":proto-commerce"))`

### 옵션 C — 별도 git repo

- 장점: proto 가 *완전히 분리된 라이프사이클*
- 단점: 변경 시 proto repo + 사용 repo 양쪽 PR, 버전 pin 필요
- ⇒ 다수 회사 / 다수 monorepo 가 공유할 때만 의미

### 옵션 D — BSR

- Buf Schema Registry (`buf.build`) 에 proto 패키지 게시
- npm 처럼 의존성 관리 + breaking detection
- 장점: 거버넌스 강함
- 단점: 외부 의존, 비용
- ⇒ 큰 회사 / 외부 공개 API 가 있을 때

## 3. 추천 구조 (msa)

### 3-1. Gradle 모듈

```
settings.gradle.kts:
  include(":proto-commerce")
  include(":order:domain", ":order:app")
  ...

proto-commerce/build.gradle.kts:
  plugins { id("com.google.protobuf") }
  dependencies {
    api("com.google.protobuf:protobuf-kotlin")
    api("io.grpc:grpc-protobuf")
    api("io.grpc:grpc-stub")
    api("io.grpc:grpc-kotlin-stub")
  }
  protobuf { /* 생성 설정 */ }

order/app/build.gradle.kts:
  dependencies {
    implementation(project(":proto-commerce"))
  }
```

핵심:
- `api(...)` 로 protobuf / grpc 라이브러리 export → 의존 모듈은 추가 의존성 선언 불필요
- 생성 코드도 같이 jar 에 포함

### 3-2. proto 디렉토리

```
proto/
├── src/main/proto/
│   ├── commerce/
│   │   ├── product/v1/
│   │   │   ├── product.proto              # 메시지
│   │   │   └── product_service.proto       # service ProductService
│   │   ├── order/v1/
│   │   │   ├── order.proto
│   │   │   └── order_service.proto
│   │   ├── inventory/v1/
│   │   │   └── inventory_service.proto
│   │   └── auth/v1/
│   │       └── auth_service.proto
│   └── common/
│       ├── error/v1/error_details.proto
│       └── pagination/v1/page.proto
├── buf.yaml
├── buf.gen.yaml
└── build.gradle.kts
```

### 3-3. 패키지 컨벤션

| 항목 | 컨벤션 |
|---|---|
| proto package | `commerce.<domain>.v1` (예: `commerce.product.v1`) |
| Java package | `com.kgd.proto.commerce.<domain>.v1` |
| 파일명 | `<domain>.proto` (메시지) + `<domain>_service.proto` (RPC) |
| 메시지 / 서비스 | PascalCase + `<domain>Service` |
| 디렉토리 | proto package 와 일치 |

## 4. Buf 통합

### 4-1. `buf.yaml` (lint + breaking)

```yaml
version: v2
modules:
  - path: src/main/proto
lint:
  use:
    - STANDARD
  except:
    - PACKAGE_NO_IMPORT_CYCLE   # 필요시 예외
breaking:
  use:
    - FILE
deps:
  - buf.build/googleapis/googleapis
  - buf.build/grpc/grpc
```

### 4-2. `buf.gen.yaml` (코드 생성 — 선택, gradle 도 가능)

```yaml
version: v2
plugins:
  - remote: buf.build/protocolbuffers/java
    out: gen/java
  - remote: buf.build/protocolbuffers/kotlin
    out: gen/kotlin
  - remote: buf.build/grpc/java
    out: gen/grpc-java
  - remote: buf.build/grpc/kotlin
    out: gen/grpc-kotlin
```

→ gradle protobuf 플러그인을 쓸지 Buf CLI 를 쓸지 선택. msa 의 gradle 통일성을 살리려면 **gradle 플러그인 + Buf 는 lint/breaking 만**.

### 4-3. CI 통합

```yaml
# .github/workflows/proto-validation.yml
name: proto validation
on:
  pull_request:
    paths: ['proto/**']
jobs:
  buf-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: bufbuild/buf-setup-action@v1
      - run: buf lint
        working-directory: proto
      - run: buf breaking --against ".git#branch=main"
        working-directory: proto
      - run: buf format --diff --exit-code
        working-directory: proto
```

→ PR 단계에서 silent breaking 차단.

## 5. 빌드 흐름

```
proto/src/main/proto/*.proto
        │
        │ ./gradlew :proto-commerce:generateProto
        ▼
proto/build/generated/source/proto/main/{java,kotlin,grpc,grpckt}/
        │
        │ ./gradlew :proto-commerce:jar
        ▼
proto-commerce-X.Y.jar (gradle module)
        │
        │ implementation(project(":proto-commerce"))
        ▼
order/app, product/app 등에서 사용
```

### 빌드 시간

- proto 생성: 5-10s (메시지 수에 비례)
- jar 빌드: 1-2s
- 의존 모듈 incremental: proto 변경 시만 재빌드

→ gradle 캐시 잘 동작. 모든 서비스가 proto 생성 반복하는 옵션 A 보다 훨씬 빠름.

## 6. 버전 관리 전략

### 6-1. Major 변경 = 패키지 변경

```protobuf
// v1 (호환 변경만)
package commerce.product.v1;

// v2 (호환 깨지는 변경)
package commerce.product.v2;
```

- `commerce.product.v1` 과 `commerce.product.v2` 는 별도 Java 패키지 → 의존 모듈은 양쪽 stub 코드 모두 보유
- 클라이언트는 자기 속도로 v1 → v2 마이그레이션
- **deprecated v1 6개월 유지 후 제거** 같은 정책 운영

### 6-2. Minor 변경 = optional / oneof / reserved

호환 가능한 변경은 v1 내에서:
- 새 필드 (optional)
- enum 값 추가
- 새 RPC 추가 (서비스 인터페이스 확장)

### 6-3. CI 보장

- Buf breaking 이 호환 깨지는 PR 차단
- 의도된 깨짐은 `buf-breaking-ignore.yaml` 또는 v2 패키지 신설로 처리

## 7. 도메인 / 서비스 경계

| 원칙 | 의미 |
|---|---|
| proto 패키지 = 서비스 도메인 1:1 | `commerce.order.v1` 은 order 서비스만 정의 |
| Cross-domain 메시지 import | `import "commerce/product/v1/product.proto";` 가능 |
| 그러나 cross-domain 의존은 신중 | order 가 product proto 를 import 하면 product 변경에 order 영향 |
| common (공유) | error_details, pagination 같은 진짜 공통만 |

⇒ msa 의 **"서비스 간 cross-reference 금지"** (CLAUDE.md) 와 일치.

## 8. proto 변경 워크플로우

```
1. PR 작성: proto/src/main/proto/commerce/product/v1/product.proto 수정
2. CI: buf lint + buf breaking 실행
   - lint 실패 → 컨벤션 위반
   - breaking 실패 → 의도 확인 (v2 분리 or ignore)
3. 코드 리뷰: 양쪽 도메인 owner approve
4. merge → proto-commerce 모듈 빌드 → 의존 서비스 자동 재빌드
5. 의존 서비스가 새 stub 으로 컴파일됨 (코드 변경 없으면 호환 OK)
6. 사용 측이 새 필드를 활용하려면 별도 PR
```

## 9. 흔한 실수

| 실수 | 결과 |
|---|---|
| proto 를 서비스마다 복제 | drift, silent breaking |
| `commerce.product` (버전 없음) | major 변경 시 마이그레이션 어려움 |
| Buf 미적용 | breaking 검출 누락 |
| `option java_multiple_files = false` 그대로 | wrapper 클래스 거대화, IDE 느림 |
| common 에 도메인 메시지 (order, product) | "공통" 의 의미 흐려짐 |
| proto 파일에 비즈 로직 주석 | proto 는 schema, 의도/제약은 ADR / 코드 |

## 10. POC / 단계별 도입 시나리오

### Phase 0 (POC)

- `:proto-commerce` 모듈 신설
- product 의 1 endpoint (`getProduct`) 만 proto 정의
- order 가 의존성 추가 + stub 사용
- Buf lint 만 (breaking 은 변경 없으므로 의미 X)

### Phase 1

- product / order / auth / member 의 4 RPC proto 화
- Buf breaking CI 추가
- `commerce.<domain>.v1` 컨벤션 정착

### Phase 2

- search-batch, inventory 등 확산
- common 메시지 (error, pagination) 표준화
- BSR 도입 검토 (외부 공개 API 가 있을 때)

## 11. 면접 핵심

> Q: monorepo 에 proto 를 어디 두나?

A: 전용 모듈 (`:proto-commerce`). 모든 서비스가 의존성으로 참조 → 단일 진실 + 빌드 캐시. 각 서비스에 복제하면 drift / silent breaking 위험. polyglot / 외부 공유 시 BSR (Buf Schema Registry) 검토.

> Q: proto 파일 변경 시 호환성 검증?

A: Buf breaking detection — `buf breaking --against '.git#branch=main'`. CI 에서 PR 단계 자동 실행. 호환 깨지는 변경 = `v2` 패키지 신설 + 양립 운영 후 deprecated v1 제거.

> Q: 도메인 간 proto 의존?

A: 메시지 import 는 가능하나 신중히. `commerce.order.v1` 가 `commerce.product.v1` 의 ProductId 를 import 하면 product proto 변경에 order 영향. msa 의 "서비스 간 cross-reference 금지" 와 일치 — 정말 공통 (error, pagination) 만 common 에. 가능한 ID 만 전달, 객체 전체 전달은 피한다.

## 다음 학습

- [18-virtual-migration-product.md](18-virtual-migration-product.md) — 실제 코드 시안
- [19-improvements.md](19-improvements.md) — ADR 초안
