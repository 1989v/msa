# 하네스 변경 원장

이 레포의 하네스(CLAUDE.md · auto memory · `.claude/rules/` · 훅 · permissions · 스킬 · 리뷰어 체크리스트)에
가한 변경을 기록한다. `/hns:evolve` 와 `/hns:diet` 가 여기에 쓴다.

**채택만 적는 원장은 절반이다.** 기각과 되돌림을 같이 적는다 — 안 적으면 같은 제안이 몇 달 뒤에
다시 올라오고, 그때는 왜 안 받았는지 아무도 모른다.

## 규칙 넷

1. **판정을 적는다** — `채택` / `기각` / `되돌림` / `보류`. 기각과 보류도 행을 갖는다.
2. **되돌릴 때 옛 규칙의 이유를 지우지 않는다.** 규칙 문장은 덮어써도, 그 규칙이 왜 있었는지는
   이 원장에 남긴다. 규칙은 되돌아가도 지식은 남는다.
3. **근거는 사건이다** — "무엇이 터져서" 또는 "무엇이 반증했는지". 취향이면 취향이라고 적는다.
4. **반증할 수 없는 규칙은 그렇게 표시한다.** 빨간불을 만들 수 없으면 금지문이 아니라 표기 의무다
   (hns `/hns:evolve` §「막을 수 없으면 금지하지 말고 드러내라」).

플러그인 자체의 변경은 여기가 아니라 `ai/plugins/hns/docs/changelog/harness-changelog.md`.

---

| 날짜 | 판정 | 대상 | 변경 | 근거 |
|---|---|---|---|---|
| 2026-09-07 | 채택 | auto memory `MEMORY.md` | 모듈 구조표 오류 4건 정정 — `:order:app` → `:order:feature`, 없는 `order/app/build.gradle.kts`·`docker/docker-compose.yml` 제거, "모든 서비스가 `:domain`/`:app`" → 실제 48 모듈 | `./gradlew :order:app:build` → `project 'app' not found in project ':order'`. 항상 로드되는 색인이 거짓을 싣고 있었다 |
| 2026-09-07 | 채택 | auto memory `MEMORY.md` | `Known Fixes`(코틀린 스마트캐스트)·`Build Commands` 절 삭제 | 앞은 모델이 이미 아는 일반 지식, 뒤는 루트 `CLAUDE.md` §Commands 와 **갈라진** 중복 |
| 2026-09-07 | 채택 | auto memory `feedback_skill_routing` | "Claude Teams + hns 조합"을 1순위에서 내림 | Agent 도구가 `team_name` 을 `Deprecated; ignored. The session has a single implicit team.` 로 문서화 — 지목한 메커니즘이 사라졌다 |
| 2026-09-07 | 채택 | 전역 `~/.claude/CLAUDE.md` | Session Wrapup 트리거 3·4 를 "세션 첫 턴 / 3턴마다" → "범위가 정해졌을 때 / 작업 단위가 끝날 때" | 턴 카운터에 매인 케이던스. 트리거 1·2 는 사건 기반인데 3·4만 형태가 달랐고, 3이 왜 3인지 근거가 없다 |
| 2026-09-07 | 채택 | 전역 `~/.claude/CLAUDE.md` | `No closing recap …` → `Close with what the reader can't see in the diff …` | 과다 서술하던 모델을 겨냥한 억제 규칙. 지금은 방향이 반대라 원했던 마무리까지 지운다 |
| 2026-09-08 | **되돌림** | auto memory `feedback_skill_routing` | 전날 넣은 "서브에이전트 분할은 사용자가 요청했을 때만" 을 철회하고 **병렬 분할**(요청 시에만) / **검증 분리**(파이프라인이 부르면 부르고, 못 부르면 멈춘다)로 분리 | hns 0.16.0(ADR-007)이 `spec-review:17`·`agent-behavior:35` 에서 검증 에이전트를 필수로 요구한다. 원인은 두 종류를 한 단어로 뭉갠 것. **옛 규칙이 있었던 이유는 유효하다** — 요청 없는 병렬 분할은 지금도 금지다 |
| 2026-09-08 | 채택 | 루트 `CLAUDE.md` | 훅 서술 4개 → 6개 (`commit-scope`·`edit-lint` 추가, `HNS_LINT_CMD=""` 무동작 명시) | hns 0.16.0 이 `commit-scope.sh` 를 추가했고 이미 설치·배선돼 있었는데 문서가 안 따라갔다 |
| 2026-09-08 | 채택 | 루트 `CLAUDE.md` | 카드 디스펜서 문서 포인터를 `portal-fe/src/lib/…/README.md` → `github.com/1989v/card-dispenser` | 한 줄 안에서 자기모순 — npm 분리를 적어 놓고 분리 전 경로(없음)를 가리켰다 |
| 2026-09-08 | **기각** | 루트 `CLAUDE.md` | "`review-verdict` 호출은 사용자 요청 없이도 허용" 예외 한 줄을 파자는 제안 | 세션 레벨 지시(`Do not call the AgentTool unless the user requested it`)를 레포 규칙으로 덮으려는 모양. **이길지 질지 확인할 방법이 없는 규칙**이 하나 더 생긴다. 근본(계정 커스텀 인스트럭션에서 원문 제거)으로 간다 |
| 2026-09-08 | **보류** | 전역 하네스 프로필 5종 | 활성 `~/.claude/CLAUDE.md`(12,525 B)와 `origin`·프로필 4종(2,739 B 등)이 갈라져, 토글 한 번에 하드 룰 7종(Session Wrapup·최소 수정·증거 규칙 5줄·검증 브라우저·공유 워킹트리·옵시디언 라우팅·볼트 라우팅)이 사라진다 | 5개 파일을 어떻게 구성할지의 **구조 결정**이라 단독 판단하지 않는다. 선택지 둘 — ① 하드 룰을 공통 블록으로 6개에 전부 주입(`Design Principles` 가 이미 그 방식, 6/6 확인) ② 프로필은 Style/Workflow 만 갈고 나머지는 활성 파일이 이기게 |
| 2026-09-08 | 채택 | `docs/changelog/` | 이 원장 신설 | `/hns:evolve` 절차 6이 `docs/changelog/harness-changelog.md` 에 쓰라고 하는데 **이 레포엔 그 파일이 없어 기록 단계가 무동작**이었다. 위 10행은 그래서 소급 기입한 것 |
| 2026-09-09 | 채택 | `blog-writing.md` §2.0.1 · 메모리 `transliterate-established-tech-terms` | 기술 용어는 현업 발음 표기로 — 쿼리 언더스탠딩 · 리랭킹 · 스파스/덴스 · 스톱워드. 한국어가 표준인 말(색인 · 형태소 분석기 · 사전 · 융합)은 그대로 | 발행한 글에 「질의 이해」 · 「재순위」 를 썼는데 **그 말로 검색하는 사람이 없다**. 번역어는 읽는 사람이 아는 말과 달라 매번 되번역을 시키고, 그 용어로 더 찾아볼 수도 없다 (사용자 지적) |
| 2026-09-09 | 채택 | auto memory `MEMORY.md` 색인 + `feedback_gh_active_account_shared` | 색인 줄을 본문에 맞춘다 — 「기본은 전환 요청」 → **「계정 전환은 묻지 않는다」**. 상세 파일에는 「이 규칙이 한 번 안 탔다」 경고 한 항 추가 | 상시 승인이 **상세 파일에 이미 있었는데도** 사용자에게 푸시 여부를 물었다. 규칙이 없어서가 아니라 매 세션 로드되는 색인 줄이 본문과 **반대**로 적혀 있어서다. 색인은 항상 읽고 상세는 필요할 때만 읽으므로 색인이 이긴다 — 문구를 늘리는 대신 「왜 안 탔는지」를 고친 사례 |
| 2026-09-11 | 채택 | `k8s/CLAUDE.md` · `docs/conventions/transactional-usage.md` §5 · `docs/standards/new-domain-checklist.md` | 폴드 하네스 세 줄 — ① 파드 이름 하나가 **다섯 곳**이다(라우트·health 프록시·어드민 `SERVICES`·NetworkPolicy 라벨·매니페스트 URL) ② 비-primary 도메인은 `@Transactional("{svc}TransactionManager")` ③ 폴드 호스트의 API 문서는 `GroupedOpenApi` 로 가른다 | 전부 이번에 터진 것. ②는 deal 클릭 수가 며칠 0이었고(예외·로그 없음), ①은 blog 셸 페치 정책이 `atlas` 를 가리켜 모든 글이 **200 인 채 SPA 없이** 나갔다. ③은 `/api/docs/specs/product` 가 Order 스펙을 냈다. **셋 다 문서에 이미 비슷한 경고가 있었고 안 지켜졌다** — 그래서 문구를 늘리는 대신 `verifyTransactionQualifiers` 와 `verifyPodTopology` 확장으로 내렸다(전부 회귀 주입으로 빨간불 확인) |
| 2026-09-12 | 채택 | 루트 `CLAUDE.md` 백업 항목 · `docs/specs/2026-04-06-backup-management-design.md` | 「XtraBackup + Binlog PITR」 한 줄을 **운영 실제(MySQL 논리 백업, RPO 24h, 노드 로컬)** 로 바꾸고 설계안은 미배선이라고 명시. spec 머리에도 같은 표기 | 그 한 줄을 근거로 백업이 있다고 믿고 옛 테이블 삭제 조건을 「풀백업 직후」로 잡으려다, **운영에 백업이 하나도 없다**는 것을 발견했다. 문서가 목표치를 현재형으로 적고 있으면 그것을 읽은 사람이 없는 안전장치를 있다고 센다 |
| 2026-09-13 | 채택 | auto memory `bot-balance-is-held-distribution` + 색인 줄 · `amp-arena/tools/balance.mjs` | 「봇 판 성적을 읽기 전에 그 표의 이벤트 원인부터 쪼개 **같은 출력에** 찍는다」. 밸런스 도구가 사망을 타격사·밀려서 낙사·자멸로 나눠 찍고 자멸 15% 초과면 경고한다 | 규칙(「봇 이동 결함부터 본다」)이 2026-09-03 부터 있었는데 amp-arena 에서 또 안 탔다. 봇이 스스로 떨어져 죽어 판당 사망 34 중 크레딧 KO 가 10.5 뿐이었고, **자멸 1·2위가 그대로 「약한 무기·직업」으로 찍혀** 하마터면 멀쩡한 값을 버프할 뻔했다. 봇을 고치자 이상치 넷이 전부 사라졌다(값 변경 0). 문구가 아니라 「왜 안 탔는지」를 고친 사례 — 사람이 기억해서 확인하는 규칙은 안 지켜지므로 표 옆에 붙였다(옛 봇으로 회귀 주입해 경고 발생 확인) |
