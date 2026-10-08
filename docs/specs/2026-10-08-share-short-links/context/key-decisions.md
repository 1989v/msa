# 핵심 결정

### 2026-10-08 — 단축 경로 파싱은 common 에 둔다
그룹 1 구현자의 열린 질문. `/{접두사}`·`/`·`/list` → 홈, 세그먼트 1개 → 코드, 2개 이상 → 실패 규칙을 네 컨트롤러가 각자 구현하면 같은 지식이 네 벌이 된다.
스펙 SR-1 의 "common 헬퍼 한 곳" 범위를 경로 분류까지 넓힌다. 파서는 세그먼트만 가르고 코드 형식은 판정하지 않는다(이력서 코드는 형식이 다르다).

### 2026-10-08 — 순열 상수 (변경 금지)
SEED=0x5A3C96E1F0, M1=0xC2B2AE3D27, M2=0x165667B19F, xorshift20 3회. 골든: 0→5mZiq85, 1→HGWKKUQ, 62→CQy78OF, 2^40−1→FOBkmEh.

### 2026-10-08 — 302 응답 조립은 상태 없는 함수, UseCase 는 목적지 문자열만
그룹 2 구현자의 열린 질문. 레이어 게이트 ⑤ 가 컨트롤러에 `com.kgd.common.shortlink` 타입 주입을 막아, 첫 구현은 UseCase 가 `ResponseEntity` 를 반환했다(application 이 웹 타입에 의존 — 레이어 위반).
302 조립을 상태 없는 함수(`ShortLinkRedirects`)로 내려 컨트롤러가 주입 없이 부르고, UseCase 는 목적지 주소만 돌려준다. 그룹 3·4·5 가 같은 모양을 쓴다.

### 2026-10-08 — UA 계열·리퍼러 호스트 추출을 common 으로 (Rule of Three)
그룹 3·4 구현자의 열린 질문. deal·game·blog 에 같은 함수가 세 벌, place 가 네 번째. 그룹 5 에서 common 에 올리고 game·blog 는 그것을 쓰게 바꾼다. deal 은 이번 범위 밖이라 그대로 두고 통합 후보로 보고한다.

### 2026-10-08 — 게이트웨이 리미터 키는 `@Qualifier("ipKeyResolver")` 로 고정
`KeyResolver` 후보가 둘(ipKeyResolver, @Primary userKeyResolver)이면 생성자 인자 이름보다 @Primary 가 먼저 이긴다. 한정자 없이 `ipKeyResolver` 인자를 두면 조용히 userKeyResolver 가 주입되어 헤더 우회가 열린다. ShortLinkRouteSpec 이 실제 요청으로 이를 잡았다.

### 2026-10-08 — shortUrl 이 없을 때의 대신 주소는 canonical
스펙은 「현재 페이지 주소」였다. 게임 화면 주소에 방 초대(`?room=…#join`)가 섞일 수 있고 블로그는 원래 canonical 을 공유했으므로 canonical 로 바꿨다. 아무 주소도 넘기지 않으면 컴포넌트가 현재 주소를 쓴다.

### 2026-10-08 — origin 재기반·번호 재지정
origin/main 이 강제 푸시로 갈라져 내 커밋을 별도 워크트리에서 origin 위로 옮겼다. 마이그레이션은 각 DB 의 origin 최신 다음 번호(V31·V106·V4·V33), ADR 은 0106. 관광지 상세 응답은 origin 의 엣지 캐시(ADR-0105)를 그대로 두고 본문에만 shortUrl 을 싣는다 — shortUrl 은 id 로 결정되는 값이라 캐시돼도 맞다.
게이트웨이에 origin 이 `adsClientIpKeyResolver`(CF-Connecting-IP)를 추가했다. 단축 경로는 그대로 `ipKeyResolver` — CF 헤더는 우회 호스트에서 위조되므로 Host 허용 목록과 함께 써야 하고, 그 배선은 이번 범위 밖. 후속 후보.

### 2026-10-09 — 크롤러 판정은 기존 `com.kgd.common.web.CrawlerUserAgents` 하나로
그룹 1 에서 같은 판정의 사본 `com.kgd.common.crawler.CrawlerUserAgents` 를 만들었다(스펙이 출발점으로 지목한 analytics 파일이 이미 common.web 으로 옮겨져 있던 것을 놓쳤다). fresh verifier 가 SR-6 「분류기 하나」 위반으로 잡았다. 미리보기 봇 마커 5개를 기존 클래스에 더하고 사본을 지웠다 — analytics 원장과 game 랭킹도 미리보기 봇을 거르게 된다(봇이므로 맞다).

### 2026-10-09 — 이력서 코드 충돌 재시도는 「저장 전 존재 확인」
스펙은 「유일 제약에 걸리면 다시 뽑는다」였다. 같은 트랜잭션에서 UNIQUE 위반을 잡으면 rollback-only 가 되어 재시도할 수 없어, `existsByShortCode` 로 확인한 뒤 최대 5회 다시 뽑는다. 확인과 저장 사이의 경합은 UNIQUE 가 막고 링크 생성이 실패한다(59비트 공간이라 확률 무시 수준).
