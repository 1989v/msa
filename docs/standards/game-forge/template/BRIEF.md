# BRIEF — {{NAME}}

| 항목 | 값 |
|---|---|
| 장르 | {{GENRE}} |
| 모티브 | {{MOTIF}} — **장르와 핵심 루프의 재미만** 참고. 캐릭터·세계관·명칭·그래픽·UI·연출·사운드는 독자 제작. 원작 에셋 사용·특정 디자인 재현 금지 |
| 플랫폼 | {{PLATFORM}} |
| 아트 프로바이더 | {{ART}} (`assets/providers/{{ART}}/README.md`) |
| 언어 | 한국어 UI |

## 벤치마크 — 규모의 기준

{{BENCHMARK}}

벤치마크는 **하한선**이다. 전 축(맵 범위·해상도·플레이타임·진행 깊이·적 종·스킬 수)에서 동급 이상이어야 한다.
`forge/thresholds.json` 은 그 하한을 기계가 재는 형태다 — 벤치마크가 더 크면 그만큼 간다.

## 품질 4축 (우선순위 순)

1. **정확성과 안정적인 프레임** — 입력이 씹히지 않고 60fps
2. **장르 특유의 판단과 보상** — 이 장르를 하는 이유가 되는 손맛·긴장·쾌감·연계
3. **캐릭터·소리·화면의 완성도** — 무음·정적 화면은 미완성
4. **콘텐츠 양** — 스테이지·적·보스·스킬·숨김 요소

## 게이트 축 ↔ 문턱 (forge/thresholds.json)

| 축 | 재는 것 | 기본 하한 |
|---|---|---|
| BOOT · CONSOLE | `__forge` 존재, 콘솔 에러 | 에러 0 |
| CONTROLS_KEY · MOBILE_TOUCH | 선언한 모든 키/터치가 플레이어를 바꾸는가(같은 seed 비교) | 죽은 입력 0 |
| FPS_DESKTOP · MOBILE_FPS | 실시간 난타 중 평균·1% low (헤드리스 소프트웨어 렌더) | 55 / 30 · 모바일(DPR 2) 30 — 실기기 예측이 아니라 회귀 스모크 |
| DIFF_IDLE · DIFF_MASH | 가만히 → 15초 내 피격·45초 내 사망 / 난타 90초 → 1스테이지 미클리어 | 봇이 잰다 |
| CONTENT_* | 스테이지 5+(화면이 서로 다름) · 적 6종+ · 보스 1+(2페이즈) · 스킬 4+ | warp/spawn 으로 실증 |
| HIT | 사거리 안 적에게 공격 → hp 감소 + 3연속 스크린샷 | 닿아야 한다 |
| AUDIO | 6초 난타 중 실제 소리 start > 0 · sfx 8+ · music 1+ | 무음 = 미완성 |
| FEEL | hitstop 40ms+ · shake 2px+ · telegraph 200ms+ (자기 보고) | hit-*.png 로 사람이 확인 |
| MOBILE_PORTRAIT · LANDSCAPE | 플레이어 40 CSS px+ · overflow 없음 · 터치 조작 화면 안 | 두 방향 다 |

## 문턱 변경

문턱을 바꾸면 `node forge/seal.mjs --reason "<왜>"` 가 `verifications/seal-log.md` 에 남긴다. 낮춘 것은 `DONE.md` 에도 적는다.
