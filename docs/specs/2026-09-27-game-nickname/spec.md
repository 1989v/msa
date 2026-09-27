# Specification: 게임 공통 닉네임

## Goal
게임 플랫폼에서 회원과 게스트 계정마다 닉네임 하나를 서버에 저장하고 전역 모달에서 설정·변경한다. 다른 계정과 중복되는 이름을 허용하지 않는다.

## User Stories
- 회원은 모든 게임과 기기에서 같은 닉네임을 사용한다.
- 회원은 사이트 공통 메뉴 또는 게임 랭킹 위젯에서 이름을 변경하고 기존 기록을 유지한다.

## Specific Requirements
- SR-1: game_player_profile에 opaque UUID player_id PK, nullable member_id UNIQUE, nullable guest_token_hash UNIQUE, nickname_key UNIQUE. 닉네임은 NFKC 정규화/trim 후 2~16자 문자·숫자·공백·._-만 허용한다. key는 Locale.ROOT 소문자화한 값, binary collation으로 앱/DB 중복 규칙을 일치시킨다. 동시 생성·변경은 DB 유일성으로 방어하고 사용자에게 중복 오류를 돌려준다.
- SR-2: GET/PUT /api/v1/games/profile/me. GET 미설정은 data=null, PUT body={nickname}, 성공 data={playerId,nickname}. 게임 전용 optional 인증 설정이 신원 헤더를 검증·대체한다. Authorization이 없을 때 portal_access_token 쿠키도 같은 JWT 검증기로 검증한다. 어떤 인증 수단이든 제공됐는데 유효하지 않으면 401이며 guest로 다운그레이드하지 않는다. 다른 라우트 기본 인증 설정은 유지한다. 게이트웨이에서 profile PUT/score POST의 Origin이 있으면 scheme/host/port를 요청 origin과 정확히 대조한다. 로그인은 member_id, 비로그인은 서버 발급 256-bit 랜덤 guest 인증 쿠키로 소유자를 찾는다. 서버는 SHA-256 hash만 저장한다. 쿠키는 HttpOnly, SameSite=Lax, production Secure, Path=/api/v1/games, host-only. 게스트 프로필 최초 PUT 성공 시 발급. 쿠키를 잃으면 기존 이름을 주장할 수 없음을 UI에 안내한다. 쓰기 API는 Origin이 제공되면 동일 origin만 허용한다.
- SR-3: 신규 점수는 별도 game_player_score / game_player_score_daily 테이블에 player_id로 소유자를 저장한다. 유일 키는 (game_id, track, board, player_id), daily는 play_date 추가. 닉네임 문자열을 요청에서 신뢰하지 않으며 현재 프로필 이름으로 조회한다. 프로필 행의 write lock으로 점수 제출을 직렬화한다.
- SR-4: 기존 game_score / game_score_daily 전체는 읽기 전용 과거 기록으로 보존한다. 기존 member_id도 과거 nickname 기반 claim의 결과이므로 소유권 증명으로 사용하지 않는다. 공개 랭킹에 구분 표시하여 함께 제공하며 신규 기록과 합치지 않는다. 순위 계산은 동일한 combined 보드 기준. legacy는 playerId=null, 새 기록은 opaque playerId 제공. 내 기록 판정은 이름이 아니라 playerId다. 개인 회원 기록 요약의 최고점도 새 player 점수를 사용한다.
- SR-5: 사이트 공통 닉네임 버튼과 접근 가능한 모달(레이블·포커스 트랩·원래 포커스 복구·Escape·오류·저장 중 중복 제출 방지)을 제공한다. DESIGN.md 토큰 사용. 서버 실패와 미설정을 구분한다. guest와 member의 cache owner를 분리하고 계정 전환 중 지연 응답은 무시한다.
- SR-6: 공용 rank.js/platform.js는 서버 프로필을 읽고 저장한다. iframe에서는 부모 전역 모달을 열고 독립 실행에서는 자체 DOM 모달을 사용한다. postMessage는 정확한 origin 및 게임 iframe source를 검사한다. 성공한 변경을 현재 화면·다른 탭에 반영하고 랭킹을 다시 읽는다. localStorage는 표시 캐시이며 권한/소유권 근거가 아니다. 사용자 정의 이름 없이 점수를 올린 경우 현재 계정에 한정한 pending 점수를 두고 설정 성공 시 재시도한다. 계정 전환 시 pending은 버린다. pending에 slug/track/board/score/detail/owner를 고정한다. 서버 실패 시 pending을 유지하고 실패를 표시한다. 전체화면에서는 fullscreen element 안에 모달을 렌더하거나 먼저 전체화면을 나간다. 부모 acknowledgement가 없으면 standalone 모달로 폴백한다.
- SR-7: 로그인 회원에게 프로필이 없고 유효한 게스트 쿠키가 있으면 해당 프로필을 회원에 귀속시켜 기존 playerId/닉네임/기록을 유지하고 guest hash를 제거한다. 회원 프로필이 이미 있으면 회원 프로필이 우선이며 게스트 기록은 합치지 않는다. profile의 member_id/guest_token_hash는 정확히 하나만 존재한다. 귀속은 profile 행 잠금 후 member_id가 없고 guest hash가 일치함을 다시 확인하여 두 필드를 원자적으로 바꾼다. PUT의 이름 변경과 귀속은 한 트랜잭션이며 중복 실패 시 모두 rollback한다. 최초 조회는 쓰기를 하지 않고, 명시 PUT에서 귀속한다. UI는 조회 결과가 없는 회원에게 게스트 이름을 자동 표시/클레임하지 않는다. 신규 게임 제안 작성자 이름도 서버의 회원 프로필을 사용하고 과거 작성 당시 이름은 보존한다.
- SR-8: 공개 플레이·랭킹 조회와 게스트 닉네임/점수 제출 모두 허용. 각 쓰기에서 서버가 profile 소유권을 확인한다. 프로필 미설정은 INVALID_INPUT(닉네임 설정 필요)로 거부하고 설정 성공 후 재시도한다. game submodule은 쿠키 인증 전환이 앞서 있지만 root gateway는 Bearer 인증이므로 클라이언트는 읽을 수 있는 portal_access_token이 있으면 Bearer도 보내고, HttpOnly 환경에서는 same-origin 쿠키를 보낸다. 인증 토큰 자체를 캐시하거나 메시지로 전파하지 않는다.

## Verification
- Domain: normalization, invalid character/length, case/fullwidth duplicates.
- Service: member/guest ownership, cookie hash lookup, rejected spoofed nickname, rename keeps playerId, guest claim and existing member precedence.
- MySQL: full Flyway + schema validate; nickname race, player-board uniqueness, score race, rollback, legacy preservation, combined ranking and current-name projection. Docker skip는 통과로 보고하지 않는다.
- Gateway: forged headers stripped for anonymous profile/score; authenticated member is derived by filter.
- UI: 실제 sandbox iframe/standalone/fullscreen/parent ACK timeout, guest→member claim/existing member priority/logout pending discard, modal submit/error/Escape/focus, pending save retry, wrong-origin/source messages, nickname rename across views, logout/account switch with delayed replies, legacy never highlighted as mine.

## Existing Code to Leverage
- GameScoreService / GameScoreRepositoryAdapter, GameScoreJpaEntity / GameScoreDailyJpaEntity
- GatewayRouteConfig의 userConfig 및 기존 API 응답/예외 처리
- portal-fe/src/components/GNB.tsx, src/api/gameApi.ts, public/games/lib/rank.js

## Out of Scope
member 서비스 표시 이름, 파티 참가자 별칭, 채팅·실시간 릴레이 이름, 별도 arcade Redis MVP 계정 체계, 점수 진위 검증, 배포.

## Open Questions
없음. 2026-09-27 사용자 답변: “비로그인도 별도 게스트 계정으로 닉네임·랭킹 사용”.

## Terminology
GamePlayerProfile: 회원 또는 guest 자격 증명 하나가 소유하는 게임 프로필. GuestAccount: 서버 cookie로 인증하는 익명 계정. LegacyScore: 전환 이전 소유권 확인 불가능 점수. ScoreBoard: game_id/track/board 축의 순위표.
