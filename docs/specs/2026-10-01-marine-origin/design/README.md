# Image concepts
**실제 게임 캡처가 아니라 imagegen으로 제작한 설계 시안.**

## 사용자 승인 미술 톤
![승인 톤](images/00-approved-tone.png)
원화톤만 승인. 당시 그림의 목재 통화·초기 목수는 최신 규칙과 다르므로 채택하지 않는다.

## 새 원정 시작
![활잡이 한 기로 시작](images/04-gameplay-start.png)
활잡이1·목수0·금화0. 초기 숲/광산은 존재하지만 목수가 없어 수입이 없다. 먼저 몬스터를 사냥한다.

## 고용과 거점 확보 이후
![성장 후 게임 화면](images/01-gameplay-established.png)
활잡이 전투, 숲/광산 목수, 건설 중 탑, 주둔 탑. 실제 새 게임은 활잡이1·목수0·금화0이다.
시안의 HUD 인원은 예시이며 정확한 스냅샷이 아니다. 금화 하나가 통화이고 목수3은 인원수다.
하단 minimap의 미탐색 적 점/화면 위쪽 fog 묘사는 컨셉상의 오류 가능성이 있어 최종 정보표시의 근거로 쓰지 않는다.
맵/LOS/숨은 적 표시의 최종 기준은 world.md.

## 아군과 주둔 시설
![아군과 탑](images/02-allies-and-tower.png)
활잡이 / 영웅 활잡이 / 장궁수 / 목수. 합성3→1, 목수 건설, 빈탑/주둔탑 구분.
확대 그림은 원화 확인용. 작은 thumbnail도 실제32CSS px를 보장하지 않는다. 실전 크기는 DESIGN.md로 고정.

## 몬스터와 보스
![적과 보스](images/03-enemies-and-bosses.png)
일반6종·중간2종·최종1종. 이 페이지의 문구는 시안 장식이며 공격 동작/수치는 gameplay.md 우선.

## 제작 기록
built-in image_gen 사용, CLI/API fallback 없음. 2026-10-01. 기준 이미지00을 시각 참조로3회 생성하고 성장 후 화면을 참조해 시작 화면1회 편집.
최종 프롬프트 원문은 prompts/01-gameplay.txt,02-allies.txt,03-enemies.txt,04-gameplay-start.txt.
각 PNG는 문서 안에 영구 보관. 실행 게임의 assets를 바꾸지 않았다.

<!-- source: portal-fe/public/games/lib/relay.js -->
<!-- source: portal-fe/public/games/lib/platform.js -->
