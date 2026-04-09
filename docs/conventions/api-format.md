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

컨트롤러는 `ApiResponse<T>`를 직접 반환한다. **`ResponseEntity<ApiResponse<T>>` 이중 래핑 금지.**
HTTP 상태 코드는 `@ResponseStatus`로 지정한다 (200은 기본값이므로 생략).

```kotlin
// 조회 (200 기본)
@GetMapping("/{id}")
fun getById(@PathVariable id: Long): ApiResponse<ProductResponse> {
    val result = productService.findById(id)
    return ApiResponse.success(ProductResponse.from(result))
}

// 생성 (201)
@PostMapping
@ResponseStatus(HttpStatus.CREATED)
fun create(@RequestBody request: CreateProductRequest): ApiResponse<ProductResponse> {
    val result = createProductUseCase.execute(request.toCommand())
    return ApiResponse.success(ProductResponse.from(result))
}

// 삭제 (204)
@DeleteMapping("/{id}")
@ResponseStatus(HttpStatus.NO_CONTENT)
fun delete(@PathVariable id: Long) {
    productService.delete(id)
}
```

> **금지 패턴**: `ResponseEntity<ApiResponse<T>>` — ResponseEntity는 이미 ApiResponse가 담당하는 응답 구조를 중복 래핑한다. HTTP 상태 코드 제어가 필요하면 `@ResponseStatus`를 사용한다.

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
