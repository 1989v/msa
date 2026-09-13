# Skybound — 바람의 유적

**현재: 기존 섬에서 키보드 이동·달리기·점프와 우클릭 시야 회전·휠 줌이 가능한 연결 프로토타입을 저장했습니다. 터치 이동·시야와 점프/달리기도 추가했습니다. 사물 충돌·전체 게임·최종 아트는 미완료입니다.**

[PC 이동 프로토타입 실행 안내](implementation/t02b/traversal/README.md) — 로컬 서버에서 `http://127.0.0.1:8768/implementation/t02b/traversal/index.html`.

**전체 구축 추정: 약 35%** — [범위와 산정 근거](context/completion-estimate.md).

1. [전체 PRD](PRD.md): 경험, 세계, 시스템, 범위와 완료 기준
2. [아트 디렉션](art-direction.md): 원화의 읽는 법, 토큰과 제작 규격
3. [디자인 에셋](assets/manifest.md): 월드 원화와 캐릭터/소품 보드
4. [구현 작업 목록](tasks.md): 작은 단위별 입력·산출물·검증
5. [이어받기](context/progress.md): 현재 상태와 다음 세션 시작 문장
6. [T01A 제작 실험](implementation/t01a/report.md): GLB 모델·뷰어·검증 결과
7. [T01B 절벽 장면](implementation/t01b/report.md): 지형·경관·검증과 남은 아트 차이
8. [T01C 검증](verifications/t01c.md): 카메라·WebGL 복구·화면비
9. [T02A 이동 규칙](implementation/t02a/README.md): 입력/지형/낙하 복구와 연결 계약
10. [T02B-1 리깅 검증](implementation/t02b/rig-check/README.md): 표준 GLB 스킨·애니메이션 왕복, 테스트 4/4
11. [T02B-2 텍스처 검증](implementation/t02b/texture-check/README.md): 1K PNG·UV·sRGB 왕복, 브라우저 12/12

창작 구현은 기존 게임 소스를 읽지 않는 새 세션/에이전트에서 진행합니다.
구현은 **9개 그룹 / 24개 실행 단위**로 나뉩니다. T02B는 한도에 맞춰 [4개 소단위](planning/t02b-small-steps.md)로 세분화했습니다. 다음은 **T04A-2b: 배치 지지·장애물 경계 검증**입니다.
[주인공 모델 스튜디오](implementation/t02b/character/README.md)와 [최신 실제 캡처·검수](verifications/t02c-2.md)를 저장했습니다. 캐릭터 화면은 로컬 서버의 `implementation/t02b/character/index.html`에서 볼 수 있습니다. 장면은 로컬 서버에서
`http://127.0.0.1:8768/implementation/t01b/index.html`로 볼 수 있습니다.
원화 2장은 디자인 참고 이미지이며 리깅된 모델이나 동작하는 게임 화면이 아닙니다.

[T03A-1 활공 순수 규칙](implementation/t03a/README.md) · 규칙과 이동 코어 검사26/26 통과. 데모에서 Space 공중 재누름 활공이 활성화됐습니다. 돛·자세는 기술 초안입니다.

[최신 기류 검증](verifications/t03b-1.md) — 단위16/16, 브라우저11+19 통과. 앞쪽 지면 원 안에서 돛을 펼치면 상승·기력 회복.

[첫 공중 착지대 검증](verifications/t03b-2a.md) — 기류에서 오른쪽 착지대로 이동 가능. 단위45/45, 브라우저10/10.

[두 착지점 경로 완료 검증](verifications/t03b-2b.md) — 단위48/48, 브라우저14/14. 이동 진단 경로이며 게임 전체 완주는 아닙니다.

[물체 조작 순수 규칙](implementation/t04a/README.md) — 7/7 통과. 데모 연결은 다음 단계입니다.
