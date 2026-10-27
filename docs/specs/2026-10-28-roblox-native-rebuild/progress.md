<!-- source: docs/specs/2026-10-28-roblox-native-rebuild/spec.md -->

# 현재 진행

- 사용자 지시: 웹 UI·입력·카메라 복제 지양, 게임 재미와 구성은 보존하면서 Roblox 플랫폼·배경/에셋을 자연스럽게 활용. 기존 infinity-step 전체 폐기 후 새로 개발 승인.
- 메모리: 기존 feedback_roblox_port_principle.md를 보강하고 Codex 메모리 인덱스에 연결. 프로젝트 자동 진입점은 `roblox/AGENTS.md`, 정본 설명은 개발 정리§0.
- 소유권: 새 구현 담당자는 `roblox/infinity-step/`만. `roblox/archer-command/`는 다른 작업이므로 절대 삭제/수정/스테이징하지 않는다. 개발 정리·포팅 프롬프트에는 다른 작업자의 미커밋 변경이 있어 보존하며 통합한다.
- 기존 구현의 최종 기준 커밋:96cf980db. 되돌릴 필요가 있으면 git 이력을 참고하며 기존 코드를 새 구현에 복사하지 않는다.
- 화면 도구는 이전에 명시적 거절. 새 우회 시도 없음. 실제 Studio/물리/모바일/시각 검증은 아직 할 수 없으며 코드 완료와 구분한다.
- 현재: 기존 프로젝트 삭제 후 새 기본 캐릭터·건축 월드·서버 규칙과 초기 place 생성 완료. `gpt-6.1-sol` 구현 담당 `/root/native_rebuild`가 회귀 검사와 마지막 부활 회차 수정을 진행 중이다. 독립 검토의 월드 형상 검사는 종료했고 엔진 플레이는 계속 미검증이다.
- 동시 작업: Archer Command 담당자의 c3fe0df59 커밋으로 HEAD가 이동했고 공유 개발 문서 변경도 포함됐다. 해당 게임은 수정하지 않았다.

## 최종 코드·패키지 검사

부모가 최종 소스에서 직접 다음 명령을 실행해 모두 exit0을 확인했다.

```text
python3 roblox/infinity-step/tools/verify.py
WORLD OK: 42 transitions; 24 immediate-power / 18 charged rises
PACKAGE OK: 7 exact embedded sources; deterministic sha256 49a7525ca1c755b43e78d5af63331bcdce9ca8034c3ae4d2d442c57605f081b0
/private/tmp/roblox-infinity-step-tools/luau roblox/infinity-step/tests/rules.spec.luau roblox/infinity-step/tests/store.spec.luau
RULES OK: 41 meaningful assertions (copy-isolated transaction adapter)
STORE CORE OK: 17 assertions against actual StoreCore.update; Roblox service adapter remains engine-unverified
```

순수 Rules/StoreCore/테스트의 luau-analyze와 전체 src/테스트의 luau-compile --null도 exit0이었다. 독립 검토의 기존 결함 수정 및 실제 StoreCore 분리 후 추가 blocking 소스 결함을 발견하지 못했다. 검사 상세/한계는 프로젝트 README와 review.md를 따른다.

산출물은 `roblox/infinity-step/dist/InfinityStep.rbxlx`(1,984,485 bytes)다. 실제 Studio import·API·물리·기기 입력·시각·성능 및 실영수증은 미검증이다. 이는 게임 경험 검증 완료를 뜻하지 않는다. 다음 작업은 studio-checks.md의 실제 엔진 검사이며, 앞선 도구 접근 거절을 우회하지 않았다.
