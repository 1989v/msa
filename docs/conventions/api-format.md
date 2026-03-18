# API Response Format Convention

모든 HTTP 응답은 `ApiResponse<T>` (common 모듈)로 래핑한다.

## Success Response

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

## Error Response

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "NOT_FOUND",
    "message": "상품을 찾을 수 없습니다"
  }
}
```

## Usage

### Controller

```kotlin
@PostMapping
fun create(@RequestBody request: CreateProductRequest): ResponseEntity<ApiResponse<ProductResponse>> {
    val result = createProductUseCase.execute(command)
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(ApiResponse.success(ProductResponse.from(result)))
}
```

### Error Handling

- `GlobalExceptionHandler` (common 모듈)가 최종 에러 변환 담당
- `BusinessException` 기반 에러 코드 매핑

## HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | 조회/수정 성공 |
| 201 | 생성 성공 |
| 400 | 잘못된 요청 (입력 검증 실패) |
| 401 | 인증 실패 |
| 403 | 권한 없음 |
| 404 | 리소스 미존재 |
| 500 | 서버 내부 오류 |
