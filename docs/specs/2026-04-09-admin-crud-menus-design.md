# Admin CRUD Management Menus Design — Spec 2

**Date**: 2026-04-09
**Status**: Approved
**Author**: AI-assisted

---

## 1. Overview

Admin 백오피스의 CRUD 관리 메뉴를 구현한다. Spec 1에서 구축한 프레임워크(레이아웃, 인증, 라우팅) 위에 각 도메인별 관리 화면을 추가한다.

### 대상 메뉴

| 메뉴 | API 서비스 | 핵심 기능 |
|------|-----------|----------|
| 회원 관리 | member + auth | 목록/검색, 역할 변경(RBAC) |
| 상품 관리 | product | 목록/검색, 등록/수정/삭제 |
| 주문 관리 | order | 목록/검색, 상세, 상태 변경 |
| 코드 사전 | code-dictionary | 개념 CRUD, 인덱스 관리, 동기화 |
| 프로필 | admin BFF 또는 code-dictionary | About 섹션 데이터 CRD |

---

## 2. 공통 패턴

### 2.1 목록 페이지

모든 목록 페이지는 동일한 패턴:
- TanStack Table 기반 데이터 테이블
- 검색/필터 바 (상단)
- 페이지네이션 (하단)
- 행 클릭 → 상세/편집 모달 또는 페이지
- TanStack Query로 서버 상태 관리

### 2.2 폼 (생성/수정)

- 모달 다이얼로그 방식 (페이지 이동 없음)
- 유효성 검증: 클라이언트 사이드
- 저장 후 목록 자동 리페치

### 2.3 API 호출 패턴

```typescript
// 모든 API는 Gateway 경유
GET  /api/v1/{domain}?page=0&size=20&search=keyword
GET  /api/v1/{domain}/{id}
POST /api/v1/{domain}
PUT  /api/v1/{domain}/{id}
DELETE /api/v1/{domain}/{id}
```

---

## 3. 회원 관리

### 3.1 목록

| 컬럼 | 소스 |
|------|------|
| ID | member.id |
| 이메일 | member.email |
| 이름 | member.name |
| SSO 제공자 | member.ssoProvider |
| 상태 | member.status |
| 역할 | auth roles API |
| 가입일 | member.createdAt |

- 검색: 이메일, 이름
- 필터: 상태(ACTIVE/WITHDRAWN), 역할(USER/SELLER/ADMIN)

### 3.2 역할 변경

- 회원 행의 역할 컬럼 클릭 → 드롭다운
- ROLE_USER / ROLE_SELLER / ROLE_ADMIN 선택
- `POST /api/auth/roles/{memberId}` (역할 부여)
- `DELETE /api/auth/roles/{memberId}/{role}` (역할 제거)

### 3.3 API

- `GET /api/members?page=&size=&search=` (member 서비스, 현재 없으면 추가 필요)
- `GET /api/auth/roles/{memberId}` (auth 서비스, 기존)
- `POST /api/auth/roles/{memberId}` (auth 서비스, 기존)
- `DELETE /api/auth/roles/{memberId}/{role}` (auth 서비스, 기존)

---

## 4. 상품 관리

### 4.1 목록

| 컬럼 | 소스 |
|------|------|
| ID | product.id |
| 상품명 | product.name |
| 가격 | product.price |
| 카테고리 | product.category |
| 상태 | product.status |
| 재고 | product.stockQuantity |
| 등록일 | product.createdAt |

- 검색: 상품명
- 필터: 카테고리, 상태

### 4.2 CRUD

- 등록: 모달 폼 (상품명, 가격, 카테고리, 설명, 재고)
- 수정: 행 클릭 → 모달 폼 (기존 값 pre-fill)
- 삭제: 확인 다이얼로그 후 DELETE

### 4.3 API

- `GET /api/v1/products?page=&size=&search=&category=` (기존)
- `GET /api/v1/products/{id}` (기존)
- `POST /api/v1/products` (기존)
- `PUT /api/v1/products/{id}` (기존)
- `DELETE /api/v1/products/{id}` (기존)

---

## 5. 주문 관리

### 5.1 목록

| 컬럼 | 소스 |
|------|------|
| 주문 ID | order.id |
| 주문자 | order.memberId (→ member API로 이름 조회) |
| 총 금액 | order.totalAmount |
| 상태 | order.status |
| 주문일 | order.createdAt |

- 검색: 주문 ID, 주문자 ID
- 필터: 상태(PENDING/PAID/SHIPPED/DELIVERED/CANCELLED)

### 5.2 상세

- 행 클릭 → 상세 모달:
  - 주문 정보 (ID, 일시, 상태)
  - 주문 상품 목록 (상품명, 수량, 가격)
  - 상태 변경 버튼

### 5.3 API

- `GET /api/v1/orders?page=&size=&status=` (기존)
- `GET /api/v1/orders/{id}` (기존)
- `PATCH /api/v1/orders/{id}/status` (상태 변경, 기존 또는 추가 필요)

---

## 6. 코드 사전 관리

### 6.1 개념 목록

| 컬럼 | 소스 |
|------|------|
| Concept ID | concept.conceptId |
| 이름 | concept.name |
| 카테고리 | concept.category |
| 난이도 | concept.level |
| 인덱스 수 | indexCount |
| 동의어 | concept.synonyms |

- 검색: 이름, conceptId
- 필터: 카테고리, 난이도

### 6.2 CRUD

- 등록: 모달 폼 (conceptId, 이름, 카테고리, 난이도, 설명, 동의어)
- 수정: 행 클릭 → 모달 폼
- 삭제: 확인 다이얼로그

### 6.3 인덱스 관리

- 개념 상세 모달 내에 "코드 인덱스" 탭
- 해당 개념의 인덱스 목록 표시 (파일, 라인, Git URL)
- OpenSearch 동기화 버튼: `POST /api/v1/index/sync`

### 6.4 API

- `GET /api/v1/concepts?page=&size=&category=&level=` (기존)
- `GET /api/v1/concepts/{id}` (기존)
- `POST /api/v1/concepts` (기존)
- `PUT /api/v1/concepts/{id}` (기존)
- `DELETE /api/v1/concepts/{id}` (기존)
- `POST /api/v1/index/sync` (기존)

---

## 7. 프로필 관리

### 7.1 프로필 데이터

code-dictionary FE의 About 섹션에 표시되는 데이터:

| 필드 | 설명 |
|------|------|
| name | 이름 |
| title | 직함 (e.g., Backend Engineer) |
| tagline | 한줄 소개 |
| linkedinUrl | LinkedIn URL |
| githubUrl | GitHub URL |
| email | 이메일 |
| openToWork | 이직 중 여부 (boolean) |

### 7.2 저장소

code-dictionary 서비스에 프로필 API 추가:
- `GET /api/v1/profile` — 현재 프로필 조회
- `PUT /api/v1/profile` — 프로필 수정

DB: code_dictionary_db에 `profile` 테이블 추가 (단일 행)

### 7.3 Admin 화면

- 폼 형태 (목록 불필요, 단일 레코드)
- 각 필드 편집 → 저장 버튼

---

## 8. File Map

### 공통 컴포넌트 (신규)

| File | Responsibility |
|------|---------------|
| `admin/frontend/src/components/ui/dialog.tsx` | 모달 다이얼로그 |
| `admin/frontend/src/components/ui/input.tsx` | 입력 필드 |
| `admin/frontend/src/components/ui/select.tsx` | 셀렉트 드롭다운 |
| `admin/frontend/src/components/ui/table.tsx` | 테이블 래퍼 |
| `admin/frontend/src/components/ui/pagination.tsx` | 페이지네이션 |
| `admin/frontend/src/components/common/DataTable.tsx` | TanStack Table 공통 래퍼 |
| `admin/frontend/src/components/common/SearchFilter.tsx` | 검색/필터 공통 바 |

### 페이지별 (신규)

| File | Responsibility |
|------|---------------|
| `src/pages/MembersPage.tsx` | 회원 관리 |
| `src/pages/ProductsPage.tsx` | 상품 관리 |
| `src/pages/OrdersPage.tsx` | 주문 관리 |
| `src/pages/CodeDictionaryPage.tsx` | 코드 사전 관리 |
| `src/pages/ProfilePage.tsx` | 프로필 관리 |
| `src/api/members.ts` | 회원 + 역할 API |
| `src/api/products.ts` | 상품 API |
| `src/api/orders.ts` | 주문 API |
| `src/api/codeDictionary.ts` | 코드 사전 API |
| `src/api/profile.ts` | 프로필 API |

### 수정 파일

| File | Changes |
|------|---------|
| `src/App.tsx` | 5개 라우트 추가 |
| `src/components/layout/Sidebar.tsx` | 비활성 메뉴 → 활성으로 변경 |
