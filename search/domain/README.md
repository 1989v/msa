# search:domain

검색(Search) 도메인의 순수 모델 및 포트 인터페이스 모듈.
Spring/JPA 의존성이 없다.

## 포함 요소

| 패키지 | 설명 |
|--------|------|
| `domain.product.model.ProductDocument` | ES 색인 문서 모델 (id, name, price, status, createdAt) |
| `domain.product.port.ProductSearchPort` | 검색 Outbound Port (Pageable 기반) |
| `domain.product.port.ProductIndexPort` | 색인 Outbound Port |

## 의존성

`spring-data-commons` (Page/Pageable 타입 사용)만 의존한다.
Spring Boot, JPA, Elasticsearch 클라이언트 의존성 없음.

## 테스트 실행

```bash
./gradlew :search:domain:test
```
