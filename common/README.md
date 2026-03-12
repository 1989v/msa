# common

모든 서비스가 공유하는 공통 라이브러리 모듈.
실행 가능한 JAR이 아니며, 각 서비스 모듈의 의존성으로만 사용된다.

## 포함 요소

| 패키지 | 설명 |
|--------|------|
| `response.ApiResponse<T>` | 표준 HTTP 응답 래퍼 |
| `exception.BusinessException` | 도메인 예외 기반 클래스 |
| `exception.ErrorCode` | 에러 코드 enum |
| `exception.GlobalExceptionHandler` | 전역 예외 → ApiResponse 변환 |
| `security` | JWT 파싱 유틸리티 |
| `webclient` | WebClient 공통 설정 |
| `redis` | Redis 공통 설정 |

## ApiResponse 형식

```kotlin
// 성공
ApiResponse.success(data)
// → {"success": true, "data": {...}, "error": null}

// 실패
ApiResponse.error(errorCode)
// → {"success": false, "data": null, "error": {"code": "NOT_FOUND", "message": "..."}}
```

## 서비스에서 사용하는 방법

```kotlin
// build.gradle.kts
implementation(project(":common"))
```

컨트롤러에서 응답 래핑:

```kotlin
return ResponseEntity.ok(ApiResponse.success(result))
return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(result))
```

## 빌드 (JAR만 생성, bootJar 없음)

```bash
./gradlew :common:build
```
