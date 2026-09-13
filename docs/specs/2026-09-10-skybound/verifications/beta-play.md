# 베타 패키지 통합 점검

- `check-beta.mjs 9403 http://127.0.0.1:8768/release/dist/index.html`: **10 passed, 0 failed**.
- `check-platform.mjs 9403 http://127.0.0.1:8768/release/dist/index.html beta-flight`: **14 passed, 0 failed**.

퍼즐은 실제 CDP 키보드/마우스와 390×844 터치로 완료했다. 운반 중 완료 방지, 일시정지 보존, 완료 후 재집기 금지, PC·터치 reset을 확인했다. 비행은 기존 고정 시간 스텝 입력으로 두 착지대 완주·낙하·reset을 확인했으며 실제 연속 키보드/터치 완주나 기기 FPS 검사로 해석하지 않는다.

## 발견 및 수정

모바일 취소 버튼 너비42.234px → 조작 버튼 min-width 2.75rem 추가 후44px 확인. 가로 넘침 없음(390/390). 수정 후 옛 CSS가 남아 재실패했으나 검증 브라우저 캐시를 비활성화한 뒤 같은 코드에서44px로 통과했다. 재사용 세션의 터치 에뮬레이션도 PC 검사 시작 시 명시적으로 해제했다. 중간 실행에서 예고 유효 상태 timeout이 한 번 있었으며 재실행에서 재현되지 않았다. 별도 게임 원인 확정은 하지 않았다.

증거: [퍼즐 JSON](beta-play-browser.json), [모바일 화면](beta-play-mobile.png), [비행 JSON](beta-flight-browser.json), [경로 완료 화면](beta-flight-complete.png).

남음: 작은 가로 화면/운반 벽 경계·취소 겹침, 실기기 성능, 공개 URL 연결. 세로 화면 제목의 줄바꿈은 시각적으로 어색하지만 조작을 막지 않으며 다음 UI 정리에 포함한다. 외부 배포는 수행하지 않았다.
