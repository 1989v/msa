# Skybound — 바람의 유적

**현재: 절벽 장면·이동 규칙에 더해 리깅된 주인공 모델과 제자리 걷기·달리기 동작을 저장했습니다. 아트 검수와 게임 연결은 미완료입니다.**

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
구현은 **9개 그룹 / 24개 실행 단위**로 나뉩니다. T02B는 한도에 맞춰 [4개 소단위](planning/t02b-small-steps.md)로 세분화했습니다. 다음은 **T02B-4b: 점프·착지와 이동 상태 연결**입니다.
[주인공 모델 스튜디오](implementation/t02b/character/README.md)와 [최신 실제 캡처·검수](verifications/t02b-4a.md)를 저장했습니다. 캐릭터 화면은 로컬 서버의 `implementation/t02b/character/index.html`에서 볼 수 있습니다. 장면은 로컬 서버에서
`http://127.0.0.1:8768/implementation/t01b/index.html`로 볼 수 있습니다.
원화 2장은 디자인 참고 이미지이며 리깅된 모델이나 동작하는 게임 화면이 아닙니다.
