# forge/ — 집행 층

문서는 읽히길 바라는 것이고 여기 있는 것만 지켜진다. 규칙을 하나 더하려면 문장을 늘리지 말고 **여기에 축이나 린트를 더한다.**

| 파일 | 언제 | 하는 일 |
|---|---|---|
| `gate.mjs` | 완성을 주장하기 전, 큰 변경 뒤 | 헤드리스 크롬에서 실제 입력으로 17축을 재고 `verifications/gate-report.{json,md}` + 스크린샷. `--only A,B` 로 부분 실행(완성 판정엔 불인정) |
| `play.mjs` | 만들면서 수시로 | `shot` / `keys` / `touch` / `fps` / `eval` — 장면 하나, 입력 시퀀스 하나를 파일·수치로 |
| `lint.mjs` | 파일을 고칠 때마다(PostToolUse 훅) | 실제 사고를 낸 패턴 F/W. F 는 막힌다 |
| `stop-hook.mjs` | 세션을 끝내려 할 때(Stop 훅) | BLOCKED.md → 봉인 → 리포트(전체·최신·PASS) → 스크린샷 눈검사 순으로 대조. 미달이면 사유와 함께 막는다. 같은 소스에서 3번 막히면 무한 루프 방지로 허용 |
| `session-start.mjs` | 세션 시작·컴팩션 뒤 | BRIEF · progress.md 꼬리 · 마지막 게이트 상태 · BLOCKED.md 를 다시 쥐어 준다 |
| `seal.mjs` | 게이트·문턱을 고쳤을 때 | `--reason` 을 `verifications/seal-log.md` 에 남기고 `.seal` 재봉인 |
| `cdp.mjs` · `hash.mjs` | (라이브러리) | 크롬 기동/CDP/정적 서버/계측기 · 소스 해시/봉인 |
| `thresholds.json` | BRIEF 가 정한다 | 하한. 봉인 대상 |
| `step-api.md` | 게임을 짜기 전에 | `window.__forge` 계약 |

크롬은 각 도구가 켜고 **같은 프로세스가 끈다.** 스크린샷은 파일로만 나간다 — Read 로 본다.

## 축 목록 (gate.mjs)

BOOT · CONSOLE · CONTROLS_KEY · FPS_DESKTOP · DIFF_IDLE · DIFF_MASH · CONTENT_STAGES · CONTENT_ENEMIES · CONTENT_BOSS ·
CONTENT_SKILLS · AUDIO · FEEL · HIT · MOBILE_PORTRAIT · MOBILE_TOUCH · MOBILE_LANDSCAPE · MOBILE_FPS

`basis` 열이 `self-reported` 인 축(FEEL · CONTENT_SKILLS · 보스 phases · 소리 목록)은 게임의 선언을 재는 것이다. 측정값과 같은 초록으로 읽지 않는다 — 그래서 스크린샷 눈검사가 완성의 정의에 따로 있다.
