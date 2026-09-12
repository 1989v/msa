# Specification: Skybound

상태: **T02B 캐릭터·이동 연결 및 T02C-2 PC/터치 입력 검증 완료**. 제품 정본은 [PRD](PRD.md)다.
T03A-2 활공·이동 코어는 검사26/26을 통과했으며, T03A-3 진단 돛과 데모 활공도 활성화했다. T03A-4 양팔·손 접촉을 보완했으며 T03B-1 기류 하나를 연결했으며 T03B-2a 첫 공중 착지대를 추가했으며 T03B-2b 두 착지점 이동 경로를 검증했으며 T04A-1 순수 조작 규칙7/7을 검증했으며 다음은 데모 선택·운반 연결이다. 활공·퍼즐·전투와 최종 아트/게임/배포는 미완료다.

## 행동과 요구사항 추적

| 행동 | 요구사항 | 작업 |
|---|---|---|
| 멀리 보이는 유적까지 직접 이동 | PRD SR-1 | T01/T02 |
| 상승 기류로 높이를 얻어 활공 | PRD SR-2 | T03 |
| 돌을 옮겨 장치 작동 | PRD SR-3 | T04 |
| 공격 예고를 읽고 전투 | PRD SR-4 | T05 |
| 유적을 깨우고 결말 도달 | PRD SR-5 | T06 |
| 지도와 힌트로 목적 파악 | PRD SR-6 | T06/T07 |
| 저장·터치·키보드·안전한 복귀 | PRD SR-7 | T02/T07 |

## 소스 경계 제안

최종 위치: `portal-fe/public/games/skybound/`. 구현 단계에서 생성한다.

| 파일 제안 | 책임과 계약 |
|---|---|
| `src/world.mjs` | 고정 seed/worldVersion, 지형·안전 지점·유적 정의 |
| `src/simulation.mjs` | DOM/Three.js/스토리지 의존 없음; 입력 명령과 dt로 상태 갱신 |
| `src/puzzles.mjs`, `src/quests.mjs` | 상태 전이와 이벤트, 저장 가능한 최소 상태 |
| `src/combat.mjs` | 피해/무적/AI 전이, 렌더러 의존 없음 |
| `src/scene.mjs`, `src/character.mjs` | 상태를 읽어 표현; 퀘스트 완료 상태 직접 변경 금지 |
| `src/input.mjs` | 물리 키/터치 → 행동 명령; 포커스 상실 시 clear |
| `src/save.mjs` | 검증·버전·안전 복원과 저장소 오류 격리 |
| `index.html`, `style.css`, `src/main.mjs` | 부팅·메뉴·HUD·오류 표시와 의존성 조립 |
| `build.mjs`, `tests/*.test.mjs` | 재현 가능한 정적 번들, node:test |

파일은 계획이며 불필요한 추상화를 만들기 위한 할당량이 아니다.
공개 계약을 바꾸면 `context/key-decisions.md`에 이유와 호출부 영향을 기록한다.

## 재사용 경계

기존 **게임 코드/아트/레벨은 사용하지 않는다**. Three.js/esbuild는 설치된
버전의 도구 의존성으로만 사용한다. 정적 호스팅 경계(ADR-0059)와 루트
DESIGN.md의 UI 토큰 역할만 참고한다. 공통 입력은 T09에서 어댑터로 연결한다.
새 서비스/스키마를 만들지 않는다. 별도 공개 승인 없이 배포하지 않는다.

## 범위·미결

범위와 후속 기능은 PRD §9–10, 이미지 해석은 [아트 디렉션](art-direction.md),
열린 결정은 [open-questions.yml](context/open-questions.yml)을 따른다.
원화를 실제 모델/재질로 제작하는 방식과 모바일 성능은 P1에서 검증한다.
