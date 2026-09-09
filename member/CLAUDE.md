# Member Service

회원 식별 및 프로필 관리 서비스. **이메일·실명을 저장하지 않는다** (ADR-0078).

## Modules

| Gradle path | 역할 |
|---|---|
| `:member:domain` | Pure Kotlin 도메인 (Member, MemberStatus, SsoProvider, Nickname) |
| `:member:feature` | 비-bootable 라이브러리 — **commerce:app 이 폴드** (ADR-0058 round 2). 전용 datasource `member_db` |

## 구조 상태 (ADR-0083)

표준 준수 — UseCase 인터페이스 4 · `MemberRepositoryPort` · adapter. 테스트: `MemberServiceTest` (Port MockK, P6).

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
- **탈퇴 시 다른 서비스의 회원 데이터도 파기시킨다** (ADR-0092) — 친구 그룹이 `game_db` 에 있고
  그것은 **제3자의 이름**이라 방침 §6 「탈퇴 시 지체 없이 파기」가 그 행에도 걸린다.
  `RosterPurgePort` → `RestClient` 동기 호출이고, **실패해도 탈퇴는 성립한다**(서비스가 감싼다).
  놓친 행은 보존 정리 배치가 그물로 잡는다 — 두 겹이라야 「지체 없이」와 「빠짐없이」가 함께 선다.
  Kafka 를 안 쓴 이유는 member 에 outbox·브로커 배선이 없어서다. 소비자가 늘면 그때 옮긴다
- Member DB 독립, 다른 서비스 직접 DB 접근 금지

## API Endpoints

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/members/sso` | SSO 기반 회원 조회/생성 (auth 내부 호출). 본문은 `ssoProvider` + `subjectHash` 뿐 |
| GET | `/api/members/me` | 내 프로필 조회 |
| PATCH | `/api/members/me/name` | 이름 수정 |
| DELETE | `/api/members/me` | 회원 탈퇴 |
