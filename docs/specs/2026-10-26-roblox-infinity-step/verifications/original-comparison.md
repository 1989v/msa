# Original fidelity investigation — in progress

## 최신 사용자 의도 — 2026-10-28

사용자는 게임 구성과 아이디어를 유지하면서 로블록스에 최적화해 옮기기를 원한다. 발판 수·좌표·전체 높이를 그대로 복제하는 작업을 원하지 않는다. 아래 소스 차이는 이전 기술 샘플에서 빠진 구성과 의도를 이해하는 근거이며 숫자를 일치시키기 위한 요구사항이 아니다. 최종 기준은 spec.md의 최신 최우선 개정이다.

User correction: “너무 허접해 이거랑 내가 웹에 구현한건 완전 달라 너가 직접 플레이해봐도 돼”. The nine-platform technical sample and generated alley concept must not be treated as a faithful port. Compare the actual web original and Roblox runtime before choosing a replacement art direction or extending the prototype.

## 이전 9발판 기술 샘플의 소스 차이 (현재 구현 상태와 구분)

| Concern | Web source | Roblox prototype |
|---|---|---|
| Map | `Tower.cs`: summit 3000 source units; broad procedural spiral; varied slabs and altitude bands | `Course.luau`: nine fixed platforms, x=0..96, y=0..48 studs |
| Scale | Roblox conversion was four studs per source unit | Prototype top is only 12 source units equivalent; named regions do not correspond to original altitude progression |
| Camera | `GameEntry.cs`: FOV58, dedicated orbit camera initialized toward the upcoming route | Builder camera FOV70, default Roblox character camera thereafter |
| Walking/running | `Climber.cs`: walk5.5, run8.6, run-jump bonus18% | Server walk12studs/s (=3 source units); no running mechanic |
| Climbing | `Climber.cs`: ledge hang/pull, wall climbing, stamina | No ledge/wall/stamina system |
| Falling | Original allows walking-off drift and terminal fall40 source units/s | Prototype locks horizontal movement after walking off; no matching terminal-fall setting |
| World interactions | `WorldStep`: moving platforms, breakables, ice, slope sliding, altitude wind | Static flat platforms only |
| Feedback | Original charge-only gauge, altitude centerpiece, conditional stamina and fall/banner/SFX | English utility HUD; no matching sound/character/world presentation |
| Continuity | `GameEntry.cs`: day seed, saved difficulty/progress, restored altitude | Session course/best only; purchased-item persistence is a separate feature |

References are the actual current files in `portal-fe/public/games/_src/infinity-step/Assets/Scripts/`, not the older prose PRD alone.

## 직접 플레이 상태

에이전트가 직접 플레이하지 못했다. 사용자가 진행을 승인했으나 브라우저는 해당 사이트 접근 거절, 스튜디오는 앱 접근 미승인으로 도구에서 차단됐다. 다른 UI 기술로 우회하지 않는다. 2026-10-28에는 사용자 정정을 반영한 네이티브 맵과 조작·진행 연결을 구현 중이며, 실제 플레이 확인은 소스/CLI 검사와 별도로 남는다.

## Next evidence

- Web original starting camera/environment; actual walking, charge jump, falling and recovery/ledge behavior; screenshots taken during real play.
- Roblox Play startup, actual controls, camera and course; runtime errors if any.
- Record what was actually exercised versus code-inspected or blocked. Do not substitute another AI concept image for original-game evidence.
