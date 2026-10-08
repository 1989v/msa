# 테스트 전략

★ = critical path. 판정 근거는 대상이 내놓은 값이다. 테스트 안에서 기대 코드를 따로 계산하지 않는다.

| SR | 시나리오 | 계층 |
|---|---|---|
| SR-2 ★ | **골든 벡터**: 고정 id 몇 개(0, 1, 62, 2^40−1 등)의 코드를 리터럴로 박아 인코딩·디코딩 양방향을 본다. 순열 상수를 바꾸는 회귀를 주입해 빨간불을 확인한 뒤에야 켰다고 본다 | unit (common) |
| SR-2 ★ | 왕복: 0 ~ 2^40−1 경계와 무작위 표본에서 `decode(encode(id)) == id`, 결과 길이 6~7자, base62 글자만 | unit |
| SR-2 | 충돌 없음: 표본 10만 id 의 코드가 모두 다르다 | unit |
| SR-2 | 거절: 2^40 인코딩, 길이 5·8자, base62 밖 글자, `list`, 디코드 값 ≥ 2^40 인 7자 코드, 비정규 표기(재인코딩 불일치) | unit |
| SR-3 ★ | 이력서 코드: 생성 시 10자 base62 자동 부여, 형식 위반은 도메인 생성·복원에서 거절, 유일 충돌 시 재생성, 대소문자만 바꾼 코드는 해석 실패(실제 MySQL 하네스) | unit (domain·application) |
| SR-3 | 백필 후 빈 행·형식 위반 없음 — 테스트가 아니라 마이그레이션의 `NOT NULL`·`UNIQUE`·`CHECK` 제약으로 막는다 | 스키마 |
| SR-3 | 어드민 링크 목록 응답에 `shortUrl` 이 있고, 폐기 링크의 코드는 해석 실패 | unit (application) |
| SR-4 ★ | 공개 판정: `GameStatus`·`PostStatus` 전수 × **유효한 코드**로, 리다이렉터가 여는 집합 == 도메인 판정 함수가 참인 집합 | unit (application) |
| SR-4 ★ | 리다이렉터 응답: 302 · `Location` · `no-store` · `noindex` — 도메인 넷 각각. 컨트롤러를 직접 생성해 호출하는 unit 테스트(deal 선례) | unit |
| SR-4 | 해석 실패(형식 오류·없음·공개 아님·폐기) → `/{접두사}/list` 목적지 302 — 도메인 넷 각각 | unit |
| SR-4 | 경로 엣지: 쿼리 무시, `/{접두사}` 와 `/` 는 list, 추가 세그먼트는 실패 | unit |
| SR-1/4 | `/p` 영문 행은 `/en/attractions/{id}`, ACTIVE 아닌 관광지는 목록으로 | unit |
| SR-1 ★ | `Host`·`X-Forwarded-Host` 를 바꾼 요청에도 `Location` 호스트가 설정값 그대로 | unit |
| SR-4 | 게이트웨이 라우트: `routeLocator` 로 `/r/**` uri 가 atlas, `/p,/g,/b/**` 가 content, 접두사 유지, 인증 필터 없음, 리미터 키가 `ipKeyResolver`(`X-User-Id` 를 바꾼 요청도 같은 키) | 게이트웨이 라우트 테스트 |
| SR-5 | 상세 응답의 `shortUrl` 이 리터럴 `https://1989v.com/{g|b|p}/` 로 시작하고, 코드를 디코딩하면 그 대상 id — game·blog·search 각각 | unit (application) |
| SR-5 | 공유 패널이 `shortUrl` 을 복사·공유하고, 없으면 현재 주소로 대신 | component (vitest) |
| SR-5 | `copyGameLink` 는 기존대로 현재 주소(`?room=…#join`)를 복사한다 — 기존 `browserHelp.test.ts` 유지 | component |
| SR-6 ★ | 클릭 기록 후 누적 수가 `was + 1` — game·blog·place·resume 각각. datasource 가 여럿 뜨는 호스트 하네스(`ContentContextLoadSpec`·`AtlasContextLoadSpec`, 실제 MySQL)에서 돌려 TM 한정자 누락을 잡는다. 한정자를 지우는 회귀를 주입해 빨간불을 확인한다 | integration (호스트) |
| SR-6 | 클릭 기록 저장소가 예외를 던져도 302 | unit (MockK) |
| SR-6 | 크롤러 분류: 실제 UA 문자열 표(카카오톡 스크랩, facebookexternalhit, Slackbot, Discordbot, 헤드리스 크롬, 일반 브라우저) | unit (common) |
| SR-6 | 이력서 원장 행에 리퍼러·UA 가 없다 | unit |
| SR-6 | 보존 러너: 원장 90일(이력서 365일) 초과 행 삭제 후 누적 수는 그대로 | unit |
| SR-7 | `/r` 로그에 코드·토큰이 나오지 않는다 | unit |
| SR-8 ★ | 새 컨트롤러가 `ContentContextLoadSpec`·`AtlasContextLoadSpec` 에서 빈으로 잡힌다 | context load |
| SR-8 | 새 러너가 `privacyRetention.test.ts` 의 대조 대상에 든다 | component (vitest) |
| SR-8 | `:common:test` 가 배포 게이트 로그에 실행된다 | CI |
| 운영 | apex 단축 주소 4종 + list 4종 실제 302, 공유 버튼에 단축 주소가 보인다(CDP) | e2e (배포 후) |
