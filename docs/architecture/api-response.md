# API Response Format

모든 HTTP 응답은 `ApiResponse<T>` (common 모듈)로 래핑.

```json
{ "success": true,  "data": { ... }, "error": null }
{ "success": false, "data": null,    "error": { "code": "NOT_FOUND", "message": "..." } }
```
