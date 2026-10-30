# Progress

- Workspace `/Users/gideok-kwon/IdeaProjects/msa`. 범위 `roblox/amp-arena/`(신규), 이 스펙 폴더, 하네스 원장(워킹트리만 — 다른 세션의 스테이지 hunk 때문), 메모리 `project_roblox_amp_arena.md`. 공유 워킹트리 — 경로를 좁혀 add 한다. `roblox/archer-command/` 는 다른 세션이 작업 중이라 읽기만.
- Done(2026-10-30): 첫 플레이 피드백 반영 — 자판 Z/X/C/V/Shift/F · flatLook 버그(타격 전부 실패) 수정 · 봇 교전 거리·잡기 거리·봇 던지기 · 스타일별 포즈 고유·대기 자세·Trail·내딛기 · 스모크 하네스(tests/roblox-shim.luau + tools/smoke.py, 31건) · 게이트 41 · 주입 46/46.
- Done: 리서치(로블록스에 겟앰프드 없음) → 명세(자율, assumed 결정 OQ1~7) → 구현 전부(공유 7·서버 7·클라이언트 4·빌더·검증기·테스트) → 스펙 리뷰 1차 6/6 REVISE 반영 → verify 38 PASS → 게이트 증명 24/24 RED → README/ASSETS/status → 2차 리뷰 디스패치.
- Next: 사용자 Studio 재확인(자판·타격 들어감·스타일별 동작·대기 자세·궤적) → 피드백. 포즈 축 부호가 틀리면 `Poser.client.luau` 의 r6() 부호만.
- Tools: luau CLI `/private/tmp/roblox-infinity-step-tools/luau`(재부팅 시 사라질 수 있음), Studio `/Applications/RobloxStudio.app`. 게이트 증명 스크립트는 세션 스크래치패드 `gate_proof.py`(레포 밖).
- 함정: luau CLI 는 모듈마다 환경 격리 → 전역 주입 불가(스모크는 한 청크로 이어 붙인다) · 쉼의 Attachment 와 LinearVelocity 가 같은 이름이면 FindFirstChild 가 Attachment 를 준다(클래스로 찾는다) · 정적 게이트는 `flatLook(root)` 같은 nil 인덱스를 못 잡는다 · Terrain 은 맵 모델에 못 담는다(Part Sand) · 빌더의 NumberValue 는 `double` 태그라 검증기는 float 로 비교 · luau CLI 엔 Vector3 가 없어 공유 모듈은 {X,Y,Z} 성분 셈만 · R6 관절 축(Right Shoulder C0 Ry(90°) → 로컬 Z 회전 = 앞으로 들기, 왼쪽 부호 반대)은 문서로만 확인.
