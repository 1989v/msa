# search:app

상품 검색 전용 읽기 서비스.
Elasticsearch에서 상품을 검색하는 REST API를 제공한다. 색인 기능 없음 (읽기 전용).

## 포트: 8083

## 의존 인프라

| 인프라 | 용도 | 로컬 포트 |
|--------|------|-----------|
| Elasticsearch | 상품 검색 | 9200 |
| Eureka | 서비스 등록 | 8761 |

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/search/products` | 상품 키워드 검색 |

### 검색 예시

```bash
# 키워드 검색
curl "http://localhost:8083/api/search/products?keyword=노트북"

# 페이지네이션
curl "http://localhost:8083/api/search/products?keyword=노트북&page=0&size=20"
```

Gateway를 통한 요청 (JWT 인증 필요):

```bash
curl "http://localhost:8080/api/search/products?keyword=노트북" \
  -H "Authorization: Bearer {JWT_TOKEN}"
```

### 응답 형식

```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "1",
        "name": "노트북 A",
        "price": 1500000,
        "status": "ACTIVE"
      }
    ],
    "totalElements": 42,
    "totalPages": 3
  },
  "error": null
}
```

## 로컬 실행

```bash
# Elasticsearch 먼저 기동
docker compose -f docker/docker-compose.infra.yml up -d elasticsearch

./gradlew :search:app:bootRun
```

## 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `ELASTICSEARCH_URIS` | `http://localhost:9200` | ES 주소 |
| `EUREKA_DEFAULT_ZONE` | `http://localhost:8761/eureka/` | Eureka 주소 |

## 빌드

```bash
./gradlew :search:app:build
```
