# game-forge — 클린룸 게임 제작 프롬프트 + 하네스 키트

프롬프트 한 번으로 브라우저 게임 하나를 **상한 없이** 끝까지 밀어붙이는 세트. 장르만 바꿔 재사용한다.
msa·hns·기존 게임 하네스에 의존하지 않는다 — `template/` 를 빈 폴더에 복사하면 그 폴더가 세계의 전부다.

```
new.sh ─┬─ template/ 복사 ─→ ~/games/<name>/   (CLAUDE.md · BRIEF.md · forge/ · assets/ · .claude/settings.json)
        ├─ 슬롯 채우기 (장르·모티브·벤치마크·플랫폼·아트)
        ├─ git init + 게이트 봉인
        └─ PROMPT.txt 출력(+클립보드)  ─→  cd <dir> && claude --dangerously-skip-permissions  ─→  붙여넣기
```

## 사용

```bash
docs/standards/game-forge/new.sh \
  --name thunder-edge --genre "2D 벨트스크롤 액션" --motif "던전앤파이터" \
  --benchmark "원작 초반 5개 던전 분량: 방 5개 구조, 적 6종, 보스 2페이즈, 스킬 6개, 첫 클리어 20분" \
  [--dir ~/games/thunder-edge] [--art procedural|comfyui]
cd ~/games/thunder-edge && claude --dangerously-skip-permissions     # 프롬프트 붙여넣고 기다린다
```

시작 전에 손댈 곳은 둘뿐이다: `BRIEF.md` 의 벤치마크 문장과 `forge/thresholds.json` 의 숫자(하한). 세션 중엔 답하지 않는다 —
프롬프트가 "질문은 답을 받지 못한다" 고 못 박는다. 끝나면 `verifications/DONE.md` · `gate-report.md` · `visual-review.md` · `seal-log.md` 를 본다.

## 왜 이 모양인가 — 규칙은 세 층에 나눠 박는다

| 층 | 어디 | 성격 |
|---|---|---|
| **프롬프트** | `PROMPT.md`(점화) · `template/CLAUDE.md`(지속) · `BRIEF.md`(목표) | *읽히길 바라는 것.* 역할·상한 금지·품질 순서·리듬 |
| **게이트** | `forge/gate.mjs` + `thresholds.json` = **완성의 정의** | 17축을 헤드리스 크롬에서 **실제 입력**으로 잰다. 미달이면 완성이 아니다 |
| **집행** | `.claude/settings.json` 훅 3종 — PostToolUse 린트 · **Stop 훅** · SessionStart 복구 | *지켜지는 것.* 게이트 미통과·옛 리포트·봉인 훼손·스크린샷 미검토면 **세션이 끝나지 않는다** |

근거는 이전 제작의 실측 둘이다. ① 기존 맥락을 아는 세션은 그 관습에 앵커링돼 낮은 품질에 수렴한다 — 그래서 클린룸.
② 클린룸은 **게이트에 없는 축을 통째로 빠뜨린다**(모바일이 그랬다) — 그래서 "중요하다" 는 문장이 아니라 판정에 넣는다.

판정 근거는 게임의 주장이 아니라 **게임이 내놓은 값**이다: 키·터치는 CDP 로 실제 이벤트를 넣고 같은 seed 의 무입력과 비교(죽은 입력),
난이도는 봇 둘(가만히 → 죽나 / 난타 → 못 깨나), 콘텐츠는 `warp`/`spawn` 으로 실증 + 화면 축소본이 서로 다른지, 소리는 드라이버가
심은 계측기가 `start()` 를 센다. 자기 보고(FEEL·스킬 수·보스 페이즈)는 `basis: self-reported` 로 따로 표시하고, 그래서 **스크린샷 눈검사**가 완성의 정의에 별도로 있다.

## 파일

| 경로 | 역할 |
|---|---|
| `PROMPT.md` | 마스터 프롬프트 원본. 슬롯 `{{NAME}} {{GENRE}} {{MOTIF}} {{BENCHMARK}} {{PLATFORM}} {{ART}}` |
| `new.sh` | 폴더 생성 · 슬롯 · git init · 봉인 · 프롬프트 출력 |
| `template/CLAUDE.md` | 게임 폴더의 지속 하네스 — 루프 · 완성의 정의 · 증거 규칙 · 기술 계약 · 실측 함정 |
| `template/BRIEF.md` | 목표의 원본(슬롯) + 축↔문턱 표 |
| `template/forge/` | 집행 도구 — `README.md` 참조. `step-api.md` 가 게임이 붙여야 하는 `window.__forge` 계약 |
| `template/assets/` | `STYLE.md` 스타일 바이블 · `manifest.json` 원장 · 프로바이더 2종(`procedural` 기본 / `comfyui` 골격) |
| `test/fixture-game/` | 계약을 만족하는 최소 게임. **template 에 넣지 않는다**(클린 세션이 앵커링한다) |
| `test/prove-gate.sh` | 게이트 증명 — 기준선 초록 → 회귀 10종 주입 → 각 축 빨간불 · Stop 훅 8상황 · 린트 4종 |

## 검증된 것 / 안 된 것 (2026-09-15)

| | 상태 |
|---|---|
| 게이트 17축이 픽스처에서 전부 PASS (통과 가능한 게이트) | ✅ `test/prove-gate.sh` 기준선, 전체 실행 약 22초 |
| 회귀 10종이 **기대한 축을 정확히** FAIL 시킴 (BOOT·키·터치·버튼·무피해·너무 쉬움·같은 화면·무음·예외·헛스윙) | ✅ 23/23 OK |
| Stop 훅 8상황 (리뷰 없음 block · 완비 allow · 소스 변경 block · 부분 실행 block · 봉인 훼손 block · 재봉인 allow · 3회 막힘 valve · BLOCKED.md allow) | ✅ |
| 린트 F 3종 + 정상 파일 통과, 훅 stdin 경로 | ✅ |
| `play.mjs` 5명령 · SessionStart 복구 출력 · 크롬 잔류 0 | ✅ |
| 실제 클린 세션에 마스터 프롬프트를 넣어 게임을 끝까지 만든 드라이런 | ❌ **미실행** — 다음 단계. 첫 회차의 진짜 시험은 이것이다 |
| ComfyUI 프로바이더 실연동(서버·모델·생성 1장) | ❌ 골격만. `py_compile` 통과. README 의 사다리 STEP 1 부터 |
| 실기기(폰) 성능 | ❌ 헤드리스 소프트웨어 렌더 수치는 회귀 스모크다. 모바일 fps 문턱 30(DPR 2)은 그 기준 |

`MOBILE_FPS` 는 처음 50 이었는데 픽스처가 헤드리스에서 42 를 내 30 으로 낮췄다(통과 불가능한 축은 게이트를 낮추라는 압력이 된다).

## 알려진 한계

- 봇은 "가만히 / 난타" 둘뿐이다. 퍼즐·리듬처럼 가만히 있어도 안 죽는 장르는 `thresholds.json` 의 `idle_*` 를 0 으로 끄고 BRIEF 에 이유를 적는다(봉인 로그에 남는다).
- 화면 구별은 32×18 축소본의 평균 색차다 — 팔레트가 같고 배치만 다른 스테이지는 "같다" 고 판정될 수 있다. 그때는 팔레트를 갈라라(그게 맞다).
- 결정론(`reset(seed)`)이 깨진 게임은 죽은 입력 감사가 **거짓 통과**만 낼 수 있다(거짓 실패는 없다).
- WebGL 캔버스의 축소본은 `preserveDrawingBuffer: true` 또는 `__forge.canvas()` 가 필요하다.
- 하네스는 사후적이다. 다음 제작에서 새 사고가 나면 `template/CLAUDE.md` 의 함정 절이 아니라 **`gate.mjs` 의 축이나 `lint.mjs` 의 규칙**을 늘리고 `prove-gate.sh` 에 회귀를 하나 더한다.
