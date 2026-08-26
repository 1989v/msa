# Gateway Service

Spring Cloud Gateway 기반 API Gateway. 인증 필터, 라우팅, Rate Limiting 담당.

## Module

단일 모듈 `:gateway` (port 8080)

## 구조 상태 (ADR-0083)

레이어 규칙 **비대상** — 인프라 단일 모듈 (WebFlux). 라우팅·필터·리밋만 있고 도메인이 없다.

## Commands

```bash
./gradlew :gateway:build     # 빌드
./gradlew :gateway:bootJar   # bootJar 생성
```

## Key Rules

- **비즈니스 로직 금지** — 라우팅, 인증, 로깅만 수행
- **직접 DB 접근 금지**
- WebFlux 사용은 Gateway에서만 허용 (다른 서비스는 WebMVC)
- JWT 검증 → `AuthenticationGatewayFilter` (`Config.required=false` 는 게스트 허용 라우트용 —
  토큰이 없으면 신원 헤더를 제거하고 익명 통과, 있으면 `X-User-Id` 주입)
- Redis 기반 Rate Limiting 적용 (ADR-0015)
- **★ 업스트림이 죽어도 게이트웨이는 200 + `content-length: 0` 을 내려보낸다** (보안헤더·vid 쿠키는
  붙어서 온다). curl 로 **상태코드만 보면 "정상"으로 오진한다 — 반드시 바디 길이까지 본다.**
  이 빈 200 이 FE 에서 `data: undefined` 로 흘러 failed 도 loaded 도 아닌 **영원한 "불러오는 중"**
  이 되고, 그걸 보고 "새 이미지가 빈 응답을 낸다"며 **깨진 이미지 → 깨진 이미지 횡롤백**이
  실제로 일어났다(2026-08-21 code-dictionary 6시간 장애). 빈 응답은 게이트웨이나 이미지 문제가
  아니라 **파드 CrashLoop 증상일 수 있다** — 롤백 전에 `kubectl get pods` 부터 본다.
  FE 쪽 방어는 portal-fe `displayApi.unwrap()`(빈/미성공 payload 는 throw)에 있다
- **좁은 경로를 먼저 선언한다.** 라우트는 인증 수준별로 갈리는데(admin → user → 게스트 → 공개),
  넓은 `**` 가 앞에 있으면 뒤의 좁은 라우트가 가려져 **인증이 조용히 약해진다**.
  게임 계열 7개 라우트가 그 순서로 선언돼 있다 (`game/CLAUDE.md` 게이트웨이 라우팅 절)

## Docs

- [서비스 상세](docs/service.md) — 필터 체인, 라우트 설정, 보안 구성
