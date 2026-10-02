> 완료 업데이트: 2026-10-03 사용자 무손실 저장 최적화 승인 후 games `0292929d`에 구현·검증·커밋 완료. 아래 보류 기록은 당시 진단 이력이며 현재 상태가 아니다. 최종 근거는 status.md의 피드백7차 참조.

# 적 주둔지 증원 작업 인계 — 미완료 / 사용자 결정 대기

2026-10-03. 구현 담당 gpt-6.1-sol. 작업 위치: `portal-fe/public/games` submodule, `feature/marine-command-rpg`. 직전 완료 커밋 `5aa6c935`; 아래 변경은 **미커밋**. 부모 세션이 사용자에게 저장/협동 보완 범위 확대 또는 증원 보류를 질문한 상태다. 답변 전 구현·검증 반복·프로토콜 재설계·커밋 금지. 개발 서버가 현재 미완료 변경을 읽을 수 있음에 주의한다.

## 승인 범위와 현재 변경

- `js/origin/map.js`: 경사로 폭192→160 (16.7% 축소), 길이160 유지. 이미지 밴드와 충돌 경계 모두 새 폭을 사용한다. 맵 버전 `origin-se-southwest-4`; 새 원정 필요.
- `js/origin/campaign.js`: 현재 실제5개 거점의 기존2/8/10/10/12명을20/80/100/100/120명(총420명)으로 확대. 첫 시뮬레이션 tick에 실제 배치하며 거점 대기열이 남지 않는다. 각 거점20%역병 원거리·20%박쥐 비행·60%기존 계급 보병. 고유32px 지형 슬롯에 배치, 자기 슬롯을 복귀 위치로 사용, 재생성도 같은 총원을 회복.
- `js/origin/enemy-limits.js` (신규): 전체680/필드600/일반 필드180/던전각40. 증원은 실제 거점 병력 공간에 배정하고 일반 웨이브 한도180 유지.
- `js/origin/save.js`: 검증기의 적 총수 한도를 공유680으로 변경. 압축/저장29KiB·두 슬롯60KiB 제한은 그대로.
- `js/origin/sim.js`: 실제 적 첨탑과 소굴 모두0.55초 지면 예고 후 가시 분출 시점에12 기본 피해를 한 번 적용. 분출 잔상0.28초 유지. 기존 방어/사거리·경제·승패 규칙 유지. 지면효과 본진 피해도 HUD 기록.
- `js/origin/view.js`: 기존 raster terrain/tower/crypt 유지. 가시 지면 표시/분출 표시, 박쥐32px+14px 비행 높이 표현.
- `tests/camp-defense.test.mjs` (신규): 실제 병력 수·유형·고유 슬롯·재생성, 폭/경로/이미지 정렬, 예고→피해 시점, 현실적인680개체 저장/협동 검증.
- `tests/{view,opening-fixes}.test.mjs`: 경사로 새 폭 기대값 변경.
- `tests/max-payload.test.mjs`: 기존 최대 부하 fixture(아군64·탑12·적·전체 탐험·대기열128·효과40·무작위 정밀 전투 좌표/메타데이터)를680적/필드600/던전각40으로 확대. **이 검증은 현재 실패**한다.

## 검증 근거

한 번의 국소 검증:
`node --experimental-vm-modules --test marine-command/tests/camp-defense.test.mjs marine-command/tests/view.test.mjs marine-command/tests/opening-art.test.mjs`
결과: **tests9 / pass9 / fail0**. 실제 병력20/80/100/100/120 확인. 현실적인 주둔 상태680개체 fixture의 lossless checkpoint **18,020bytes /7chunks**, 표시 상태 **8,140bytes /3chunks**. PNG3개는 실제1254×1254 RGBA, 투명도 확인. syntax와 `git diff --check` 통과.

상한 변경 때문에 추가로 필요한 최대 부하 검증:
`node --test marine-command/tests/max-payload.test.mjs`
결과: **tests1 / pass0 / fail1**, `decompressed-too-large` (`packSnapshot`의 압축 출력29KiB 제한 초과). 테스트를 약화하지 않았다.

원인 측정은 저장 구현을 변경하지 않고 `/tmp/marine-save-measure.mjs`의 임시 측정본에서만 제한을 올려 수행했다. `/tmp/marine-max-measure.test.mjs` 출력:
-680개체 최대 부하 lossless checkpoint **56,904bytes**.
- 기존 packed/transport 예산 **29,696bytes**.
- 두 슬롯 단순 합계 **113,808bytes** (메타데이터 전), 기존 총 저장 예산 **61,440bytes**.
- 기존 `encodeCheckpoint`가 `Checkpoint exceeds29KiB`로 거부.

따라서 단순 실제 개체 수 확대만으로 모든 상태의 저장·협동이 보장되지 않는다. **싱글 저장도 동일 압축/두 슬롯 예산을 사용**하므로 협동만 비활성화하는 방안 역시 완전한 해결이 아니다. 무손실 정밀값/병력 데이터를 버리거나 보이지 않는 대기열로 증원을 대체하지 않았고, 예산 상한을 임의 확대하지 않았다.

브라우저 조작이 이전에 거절되어 우회하지 않았다. 실제 화면/GPU 픽셀·플레이 난이도 미검증. 국소 로직/Canvas 호출 검증을 시각 완성 확인으로 표현하면 안 된다.

## 다음 단계

부모 세션에서 사용자 결정 수신 후 작업 범위를 재전달한다. 저장/협동 보완 확대를 승인하면 정확한 데이터 보존·전체 최대 부하·표시 전송률을 함께 만족하는 별도 최소 설계를 먼저 정한다. 증원 보류이면 승인된 폭/가시 이펙트 변경과 병력/상한/검증기 변경을 분리하여 적용한다. 부모 세션의 root staged submodule pointer와 관련 없는 staged 파일은 수정하지 않는다. 결정 전 추가 캠페인 봇/전체 회귀/코덱 실험 반복 금지.
