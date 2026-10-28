# Progress

- Workspace `/Users/gideok-kwon/IdeaProjects/msa`. 범위 `roblox/archer-command/`(전면 재개발), 이 스펙 폴더, `docs/research/2026-10-26-roblox-development/{reference-analysis.md,README.md,porting-prompt.md}`, 하네스 원장. 공유 워킹트리 — 경로를 좁혀 add 한다. 하네스 원장은 다른 세션의 스테이지 삭제 hunk 때문에 워킹트리에만 둔다.
- Done: 에셋·인기 게임 코드 조사(reference-analysis.md) → 사용자 결정 4건(기본 3인칭 + 쿼터뷰 전환 · 전면 재개발 · 적 수 축소 · 이 세션 직접) → 구현 전부 → verify.py 전부 PASS → 게이트 증명 16/16 RED.
- 1차 이식이 그대로 옮긴 느낌이 된 이유: 목표가 「수치·좌표·리듬 원작과 동일」이었고 검증기가 원작 오라클 일치만 쟀다 → 게이트가 복제를 보상했다. 이번 verify.py 는 네이티브 조건(카메라 기본값·거리 · 캐릭터 광원 · 화살 Trail/파티클/소리 · 키 안내 없음 · Humanoid 리그 · 적 상한 · 점프 없음 · 밤 조명)을 잰다.
- 2차(2026-10-29): 사용자 Studio 피드백 4건(공격 모션 없음·좀비 한 줄·초반 과난이도·치료사 식별 불가) 반영. 공격 트랙(toolslash, NPC 서버/플레이어 클라이언트) · 웨이브 입구 4곳+SWARM 흔들림 · START.gold 300/첫 웨이브 75초 6마리/hint 튜토리얼 · 치료사 NPC(Rigs.makeHealer)+20hp/s. 게이트 4종 추가(Q~T 4/4 RED — R 은 문자열 존재만 보던 게이트를 목적지 식으로 고친 뒤).
- Next: 사용자 Studio 재확인(공격 모션이 활처럼 읽히는지 · 산개 체감 · 첫 웨이브 생존 · 치료사 NPC 위치) → 밸런스 → 동쪽 원정로 너머.
- Tools: luau CLI `/private/tmp/roblox-infinity-step-tools/luau`(재부팅 시 사라질 수 있음 — 공식 릴리스 zip 재추출), Studio 0.745 `/Applications/RobloxStudio.app`.
- 함정: 2012년 Roblox Zombie 모델엔 HumanoidRootPart 가 없다(빌더가 HRP+RootJoint 를 더한다). 에셋 XML 의 `PrimaryPart` Ref 가 `null` 로 이미 있어 같은 이름 Ref 를 덧붙이면 앞의 null 이 이긴다(ref() 가 갱신하도록 고침). luau CLI 는 모듈마다 전역이 분리돼 테스트의 전역 shim 이 require 된 모듈에 안 보인다(Config 가 `vec()` 로 Vector3 유무를 스스로 본다).
