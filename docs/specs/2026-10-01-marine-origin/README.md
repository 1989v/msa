# 궁수 키우기 — 기본판 설계
**상태: 베타 공개 중. [현재 결과](status.md) · [플레이](https://game.1989v.com/games/marine-command/index.html). 추가 설계안의 작성은 구현 완료를 의미하지 않습니다.**

1. [이어받기 실행 계획](../../plans/2026-10-01-marine-origin-handoff.md)
2. [기능 사양](spec.md) · [경제/유닛/몬스터 수치](planning/gameplay.md) · [맵/시야](planning/world.md) · [용어](planning/glossary.md)
3. [플랫폼/온라인/저장 계약](planning/platform.md) · [구현 작업 순서](tasks.md)
4. [화면·캐릭터·몬스터 시안](design/README.md) · [디자인 규격](design/DESIGN.md) · [에셋 제작 규격](design/asset-manifest.md)
5. [출처와 사실/가정 구분](planning/research.md) · [검증 계획](planning/test-quality.md)
6. [유닛 고용·승급·영웅 스킬 미리보기](planning/unit-progression-preview.md) — 고용·합성 구조와 구현된 영웅 Q/E 스킬
7. [몬스터 도감·적 정보·강화 판단](planning/monster-info.md) — 정찰형과 일반형 구분, 실제 피해·처치 타수·방어 강화 비용
8. [치유 거점 수비·아군 능력치](planning/healer-defense-balance.md) — 공격11·힐50%, 실제 생존 관찰과 미해결 정지 수비 목표

전작 프로토타입의 초기 목수·거액 자원·유료 1기 승급·수동 환전 구조를 계승하지 않는다.
원작의 사냥→경제 확장→주둔 거점→병력 성장→지역 공략 흐름을 기준으로 다시 설계한다.
사용자가 승인한 것은 이전 화면의 미술 톤이다. 미술 톤을 유지하고 확인한 SCM의 지형을 확대했다. 전투 수치·던전·스킨은 이 구현의 재해석이며 영상판의 완전 복제라고 주장하지 않는다.

<!-- source: portal-fe/public/games/marine-command/js/sim.js -->
