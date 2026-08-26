# Member Service

회원 식별 및 프로필 관리 서비스. **이메일·실명을 저장하지 않는다** (ADR-0078).

## Modules

| Gradle path | 역할 |
|---|---|
| `:member:domain` | Pure Kotlin 도메인 (Member, MemberStatus, SsoProvider, Nickname) |
| `:member:feature` | 비-bootable 라이브러리 — **commerce:app 이 폴드** (ADR-0058 round 2). 전용 datasource `member_db` |

## 구조 상태 (ADR-0083)

표준 준수 — UseCase 인터페이스 4 · `MemberRepositoryPort` · adapter. 부채: **`feature` 에 테스트 소스셋이 없다** (플랜 P6).

## Commands

```bash
./gradlew :member:feature:build   # 빌드
./gradlew :member:domain:test     # 도메인 테스트 (Spring context 없음)
./gradlew :commerce:app:build     # 배포 단위(폴드 앱) 빌드
```

## Key Rules

- **최소 개인정보**: 제공자 구분 + **해시된** 소셜 식별값 + 표시 이름만 저장 (ADR-0078).
  이메일은 컬럼째 없앴고, 표시 이름은 가입 시 `Nickname.generate()` 가 만든다 — 소셜 계정의 실명이 아니다
- Auth 서비스가 OAuth 로그인 시 `/api/members/sso`를 호출하여 회원 조회/생성
- 탈퇴 시 `member.withdrawn` Kafka 이벤트 발행 (향후)
- Member DB 독립, 다른 서비스 직접 DB 접근 금지

## API Endpoints

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/members/sso` | SSO 기반 회원 조회/생성 (auth 내부 호출). 본문은 `ssoProvider` + `subjectHash` 뿐 |
| GET | `/api/members/me` | 내 프로필 조회 |
| PATCH | `/api/members/me/name` | 이름 수정 |
| DELETE | `/api/members/me` | 회원 탈퇴 |
