# Member Service

회원 식별 및 프로필 관리 서비스. 최소 개인정보 원칙 (email, name, SSO 제공자).

## Modules

| Gradle path | 역할 |
|---|---|
| `:member:domain` | Pure Kotlin 도메인 (Member, MemberStatus, SsoProvider) |
| `:member:app` | Spring Boot 앱 (port 8093) |

## Commands

```bash
./gradlew :member:app:build       # 빌드
./gradlew :member:domain:test     # 도메인 테스트 (Spring context 없음)
./gradlew :member:app:bootJar     # bootJar 생성
```

## Key Rules

- **최소 개인정보**: email, name, SSO 제공자/ID만 저장
- Auth 서비스가 OAuth 로그인 시 `/api/members/sso`를 호출하여 회원 조회/생성
- 탈퇴 시 `member.withdrawn` Kafka 이벤트 발행 (향후)
- Member DB 독립, 다른 서비스 직접 DB 접근 금지

## API Endpoints

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/members/sso` | SSO 기반 회원 조회/생성 (auth 내부 호출) |
| GET | `/api/members/me` | 내 프로필 조회 |
| PATCH | `/api/members/me/name` | 이름 수정 |
| DELETE | `/api/members/me` | 회원 탈퇴 |
