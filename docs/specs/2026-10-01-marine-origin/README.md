# 전초선: 활잡이 원정 — 기본판 설계
**상태: 계획·시안만 작성. 실행 코드 변경 없음. 2026-10-01 최신 사용자 지시가 기준.**

1. [이어받기 실행 계획](../../plans/2026-10-01-marine-origin-handoff.md)
2. [기능 사양](spec.md) · [경제/유닛/몬스터 수치](planning/gameplay.md) · [맵/시야](planning/world.md) · [용어](planning/glossary.md)
3. [플랫폼/온라인/저장 계약](planning/platform.md) · [구현 작업 순서](tasks.md)
4. [화면·캐릭터·몬스터 시안](design/README.md) · [디자인 규격](design/DESIGN.md) · [에셋 제작 규격](design/asset-manifest.md)
5. [출처와 사실/가정 구분](planning/research.md) · [검증 계획](planning/test-quality.md)

전작 프로토타입의 초기 목수·거액 자원·유료 1기 승급·수동 환전 구조를 계승하지 않는다.
원작의 사냥→경제 확장→주둔 거점→병력 성장→지역 공략 흐름을 기준으로 다시 설계한다.
사용자가 승인한 것은 이전 화면의 미술 톤이다. 이번 수치·전체 맵·새 디자인 보드는 제안이며 원본 수치 복제나 추가 승인으로 표기하지 않는다.

<!-- source: portal-fe/public/games/marine-command/js/sim.js -->
