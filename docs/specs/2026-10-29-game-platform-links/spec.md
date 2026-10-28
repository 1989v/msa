<!-- source: game/CLAUDE.md, game/domain/src/main/kotlin/com/kgd/game/domain/catalog/model/Game.kt, game/feature/src/main/kotlin/com/kgd/game/application/catalog/dto/GameDtos.kt, game/feature/src/main/kotlin/com/kgd/game/application/catalog/service/GameQueryService.kt, portal-fe/src/api/gameApi.ts, portal-fe/src/pages/games/GameCard.tsx, portal-fe/src/pages/games/GameDetailPage.tsx -->

# 게임별 외부 플랫폼 버전 — 데이터·노출 설계

상태: 2026-10-29 사용자가 이 설계의 구현과 배포까지 승인했다. 별도 원격 최신 worktree에서 구현·검증·배포한다.

## 목적과 기준

- 기존 웹게임의 상세 페이지에서 같은 게임의 Roblox판으로 이동한다. 웹 플레이는 현재 위치에서 계속 제공한다.
- 한 게임씩 플랫폼 출시 정보를 등록한다. 주소가 없는 게임은 기존 화면 그대로이며 빈 영역이나 준비 중 버튼을 표시하지 않는다.
- 게임별 `robloxUrl` 하드코딩이나 프런트엔드 별도 목록 대신 기존 `game_db` 카탈로그를 정본으로 한다.
- 초기 지원 플랫폼은 `ROBLOX` 하나다. 이후 플랫폼을 추가하면 해당 플랫폼의 식별자 검증·링크 생성·표시 문구도 함께 구현한다.
- 첨부된 본인 인증용 주소는 카탈로그나 로그·샘플 데이터에 저장하지 않는다. Roblox 게임 페이지 주소만 등록한다.

## 모델

기존 `game` 1 : N `game_platform_release`. `(game_id, platform)`당 현재 배포 정보 하나를 유지한다. 게임의 웹 `status`, `entry_url`, 랭킹·저장·계정은 그대로이며 플랫폼판의 출시 상태와 분리한다.

| 필드 | 타입/기본값 | 의미 |
|---|---|---|
| id | BIGINT PK | 내부 행 ID |
| game_id | BIGINT NOT NULL | 기존 게임 ID. 도메인/JPA에서 ID로 참조 |
| platform | VARCHAR(32) | 초기 `ROBLOX` |
| platform_ref | VARCHAR(64), nullable | Roblox **시작 Place ID**. 정수 문자열이며 Universe ID와 구분 |
| release_status | VARCHAR(16), `DRAFT` | `DRAFT`, `BETA`, `RELEASED`, `DISABLED` |
| audience | VARCHAR(16), `INVITE_ONLY` | `PUBLIC`, `INVITE_ONLY`. 링크 접근 가능성을 운영자가 확인 후 지정 |
| created_at / updated_at | DATETIME(6) | 생성/수정 일시 |

임의 URL은 저장하지 않는다. Roblox는 검증된 Place ID로 `https://www.roblox.com/games/{placeId}`를 생성한다. ID는 JavaScript 정밀도 손실을 피하도록 API에서도 문자열이다. 운영자 입력은 게임 URL 또는 Place ID를 받을 수 있지만, URL은 HTTPS·정확한 Roblox 호스트·`/games/{양의 정수}` 경로를 검증한 뒤 ID만 추출한다. 쿼리·인증 토큰·초대 코드·리디렉션은 저장하지 않으며 외부 URL을 서버에서 따라가지 않는다.

이전 구현 파일 경로·Studio 설치 경로·Creator Hub 관리 주소·본인 인증 주소는 플레이 주소가 아니다. 짧은 공유 주소도 초기 입력 규격에서 제외하고 실제 게임 페이지 주소로 입력하도록 안내한다.

### DDL 제안 — 실행하지 않음

```sql
CREATE TABLE game_platform_release (
    id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    game_id        BIGINT NOT NULL,
    platform       VARCHAR(32) NOT NULL,
    platform_ref   VARCHAR(64) NULL,
    release_status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    audience       VARCHAR(16) NOT NULL DEFAULT 'INVITE_ONLY',
    created_at     DATETIME(6) NOT NULL,
    updated_at     DATETIME(6) NOT NULL,
    UNIQUE KEY uk_game_platform_release (game_id, platform),
    CONSTRAINT ck_game_platform_release_status
        CHECK (release_status IN ('DRAFT', 'BETA', 'RELEASED', 'DISABLED')),
    CONSTRAINT ck_game_platform_release_audience
        CHECK (audience IN ('PUBLIC', 'INVITE_ONLY')),
    CONSTRAINT ck_game_platform_release_ref
        CHECK (release_status NOT IN ('BETA', 'RELEASED')
            OR (platform_ref IS NOT NULL AND CHAR_LENGTH(platform_ref) > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

존재하는 game 검증·지원 platform·숫자 ID 검증은 도메인/쓰기 경계에서 수행한다. DB 외래키 추가 여부는 기존 game 카탈로그의 ID 참조 정책을 따른다. 기존 표 수정·데이터 backfill이 없어 기존 게임은 자연스럽게 링크 0개다. Flyway 버전은 구현 시점 최신 마이그레이션 다음 번호로 정한다.

## 공개 판정

부모 게임이 기존 공개 카탈로그 노출 대상이고 다음 조건을 모두 만족해야 한다.

```text
platform == ROBLOX
releaseStatus in [BETA, RELEASED]
audience == PUBLIC
platformRef가 유효한 Place ID
```

- 공개 베타는 노출 가능하다. `BETA`와 누구나 접속 가능한 `PUBLIC`은 서로 다른 축이다.
- 친구/초대 전용 베타는 관리자에게만 표시한다. 일반 방문자에게 접근 불가능한 링크를 홍보하지 않는다.
- 웹사이트 노출을 허용한다는 뜻이지 Roblox의 연령/지역/로그인 제한을 없애는 것은 아니다. Roblox 계정·앱이 필요할 수 있음을 안내한다.
- 자동 권한 확인이나 Roblox API 호출은 도입하지 않는다. 운영자가 실제 접근을 확인하고 audience를 갱신한다. 중단 시 `DISABLED`로 바꾸면 모든 공개 영역에서 제거한다.
- 인피니티 스탭은 현재 게시된 Place ID가 확인되지 않았으므로 `DRAFT`, `platformRef=null`, `INVITE_ONLY`가 초기 운영 상태다. 가짜 ID나 본인 인증 링크를 채우지 않는다.

## API 제안 — 기존 응답에 추가

공개 목록/컬렉션/유사 게임의 `GameSummaryDto`:

```ts
availablePlatforms: Array<'ROBLOX'>; // 위 공개 조건으로 계산, 없으면 []
```

공개 `GameDetailDto`:

```ts
platformLinks: Array<{
  platform: 'ROBLOX';
  url: string;                    // 서버가 생성한 정규 게임 URL
  releaseStatus: 'BETA' | 'RELEASED';
}>;                              // 없으면 []
```

두 필드는 같은 공개 판정 정책에서 파생한다. 목록 카드에는 URL을 싣지 않는다. 구버전 서버와 점진 배포할 때 FE는 필드 누락을 빈 배열로 처리한다. 기존 `entryUrl`을 플랫폼 링크로 바꾸지 않는다. 컬렉션/유사 게임의 ID를 모아 한 번에 조회해 N+1을 피한다.

관리 API 초안은 기존 관리자 카탈로그 경계 아래 `GET /api/v1/admin/games/{slug}/platform-releases`, `PUT /api/v1/admin/games/{slug}/platform-releases/{platform}`이다. 현재 관리자 카탈로그와 같은 slug 경로를 사용하고, 기존 관리자 권한 정책으로 보호한다. PUT은 `platformRef`, `releaseStatus`, `audience` 전체 교체이며 잘못된 ID/상태는 기존 ApiResponse 오류 규약을 따른다. 상태를 DRAFT로 바꾸면서 ID를 지울 수 있으나 BETA/RELEASED의 빈 ID는 거부한다. 일반 사용자·게스트 쓰기는 허용하지 않는다.

## 운영 입력 흐름

1. 게임 관리의 플랫폼 버전 항목에서 Roblox를 추가한다.
2. 게시 전에는 초안으로 저장한다. 공개 페이지에는 아무것도 추가되지 않는다.
3. 게시 후 게임 페이지 주소를 입력한다. Place ID 추출 결과와 정규 URL을 미리 보여 준다.
4. 출시 상태(베타/정식)와 접근 범위(누구나/초대 전용)를 별도로 선택한다.
5. 다른 계정에서 플레이 가능 여부를 확인한 뒤 PUBLIC으로 저장한다. 그때 카드 표시와 상세 링크가 나타난다.
6. 다음 게임도 같은 입력으로 추가한다. 코드에 slug 분기를 늘리지 않는다.

## 구현 경계와 확인 항목

- Domain: 플랫폼 출시 값·전이·공개 판정·Place ID 규칙. 외부 SDK/프레임워크 의존 없음.
- Application: 게임 존재 확인·관리 upsert·공개 batch 조회·DTO 조립.
- Infrastructure: 전용 game datasource/Flyway/JPA repository. Presentation: 관리자 입력 검증과 기존 관리자 권한 보호.
- Portal FE: 목록 배지, 상세 외부 링크 컴포넌트, KO/EN 문구. 화면 사양은 [노출 설계](ui.md)를 따른다.
- 계정 연결·점수/저장 공유·Roblox 로그인·자동 업로드·클릭 추적은 이번 범위에 넣지 않는다. 외부 링크 클릭으로 웹 플레이 세션/횟수를 증가시키지 않는다.
- 핵심 검증: 링크 없음·초안·중단·초대 전용 숨김, 공개 베타/정식 노출, 다른 게임 전파 없음, 정확한 URL 검증, KO/EN, 기존 웹 플레이·자동 시작·상세 fetch 회귀, 키보드 포커스·모바일44px·새 탭 속성, batch 조회.
- 구현은 `gpt-6.1-sol` 담당자 한 명에게 소유권을 정해 위임하고, 관련 JVM/FE 검사와 독립 리뷰를 수행한다. 기존 미커밋 GameDetailPage 변경은 보존한다.
