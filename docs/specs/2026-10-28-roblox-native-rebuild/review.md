<!-- source: roblox/infinity-step/src/server/Game.server.luau, roblox/infinity-step/src/server/Store.luau, roblox/infinity-step/src/shared/Rules.luau, roblox/infinity-step/src/client/Feedback.client.luau, roblox/infinity-step/tools/build.py -->

# 독립 검토

읽기 전용 검토 담당 `/root/native_rebuild_review`가 새 구현을 검사했다. 실제 Studio 실행은 하지 않았다.

## 1차 검토와 수정 인계

| 발견 경로 | 필요한 수정 | 상태 |
|---|---|---|
| 최고 발판 착지 후 자동저장 전에 추락 | current와 별도로 최고 기록을 원자 병합 | 소스 재검토에서 수정 확인 |
| 상층에서 비등록 Terrain 착지 후 종료 | 실제 안정 착지와 일치하는 current만 저장 | 소스 재검토에서 수정 확인 |
| 부활 거절 직후 같은 추락에서 재제시 | 추락 회차의 거절 상태 유지 | 소스 재검토에서 수정 확인 |
| 안정 판정 전 빠른 정상 재점프 | 기본 지상 점프를 공중 중복으로 오인하지 않음 | 소스 재검토에서 수정 확인 |
| 클라이언트 소유 캐릭터의 체력 소진 | 클라이언트에서도 현재 Climbing 상태 이탈 | 소스 재검토에서 수정 확인 |
| 빌더 발판 이름과 서버 LandingId 계약 누락 | 서버 초기화에서 대상 식별자 부여, 산출물과 통합 검사 | 소스 재검토에서 수정 확인 |

CLI 검사와 모델 수는 실제 플레이 품질 검증을 대신하지 않는다. 최종 판정은 수정 재검토 및 [엔진 확인표](studio-checks.md)와 구분해 기록한다.

## 월드 형상 소스 검토

7구역별 건물 몸체/옥상·물탱크·첨탑·비계/크레인·궤도 골조/태양판·블랙홀을 실제 생성한다. 경로 중앙을 막는 확정 형상 결함은 발견하지 못했다. 상승5~9stud, 폭14~22stud의 갑판과 접근 데크/Truss가 있으며 장식 충돌물은 주로 뒤편에 배치됐다. 출발 복귀점과 첫 건물은 분리됐다. Terrain 하위 Clouds와 Sky/Atmosphere/내장 재질 사용을 확인했다. 외부 Creator Store 에셋을 가져온 구현은 아니다.

이 결과는 실제 도달·시야·게임의 풍부함·기기 조작 합격 판정이 아니다.

## 최종 소스 재검토

같은 발판의 새 안정 착지를 추락 회차 종료로 처리하고, 사망에서도 거절 상태를 존중하도록 수정됐다. 검토자는 남은 blocking 소스 결함을 발견하지 못했다.

초기 테스트는 실제 Rules만 로드하고 저장 adapter는 모형이었다. 이 검사를 Store 모듈 실행 증거로 보고하지 않는다. 실제 StoreCore.update를 운영 Store 어댑터에서 사용하도록 분리하고 주입 백엔드로 실패/취소/중복을 검사했다. 검토자가 운영 호출과 테스트의 같은 모듈 사용을 재확인했고 추가 blocking 결함을 발견하지 못했다. 실제 Store.luau의 엔진 서비스 연결은 미검증이다. 최종 실행 결과는 progress에 남겼다.
