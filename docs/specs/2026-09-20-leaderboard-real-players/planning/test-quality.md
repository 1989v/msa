# Verification strategy

Critical path: 헤드리스/운영자 제출 → 서비스가 저장소를 부르지 않고 `excluded=true` → 위젯이 그 사실을 띄움 → 운영 보드에 닉이 없음.

- 단위(`GameScoreServiceTest`): `operator`/`automation` 각각과 둘 다 false. 판정 근거는 **`scoreRepository.submit` 호출 여부**(`verify(exactly = 0)`)와 반환값 — 응답 필드만 보면 저장이 새도 초록불이다.
- 단위(`CrawlerUserAgentsTest`): common 으로 옮긴 뒤 그대로 통과. 헤드리스 크롬 케이스는 실측 UA(HeadlessChrome/153)로.
- 조립(`GameScoreControllerTest`): Spring 없이 컨트롤러 + 실제 서비스 + 실제 판별기, 포트만 mock. 헤더(UA·X-User-Roles) → `submit` 호출 여부. 운영자 배선은 여기서만 재진다 — 운영 e2e 는 UA 에서 먼저 걸린다.
- 운영 회귀(`e2e-prod-score.mjs`): 판정을 뒤집어 「닉이 보드에 없다」가 통과 조건. 배포 전 같은 스크립트가 빨간불인 것을 먼저 본다(지금은 닉이 보드에 올라가므로 새 판정으로 실패해야 한다).
- 운영 로그: 제외 한 줄(`score excluded … operator=… automation=…`)이 파드 로그에 찍힌다 — 스크립트가 본 응답이 아니라 서버가 남긴 흔적.
- 운영 끝-끝(운영자): 사용자가 로그인한 일반 브라우저로 한 판 → 로그 `operator=true` + 그 닉의 행 수 무변화. 헤드리스로 대신하면 `automation=true` 로 나와 R2 를 증명하지 못한다.
- 데이터: 패턴으로 행을 **읽어** 목록을 남기고 id 로 지운다. 순서는 배포 → 빨간불/초록불 e2e → 운영자 프로브 → 정리(마지막). 미리보기 행 수 = 목록 길이일 때만 실행.
