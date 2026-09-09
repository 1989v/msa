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
