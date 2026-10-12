# Test Quality

- Critical: last 모드 마지막 두세 개 경합 시 슬로모션, 단독 확정 시 즉시 결과, 모든 참가자 결과 유지, 같은 seed의 order 불변. VM 시뮬 unit/integration.
- Critical: root query/legacy 초대 및 직접 코드 입력 정규화, malformed/duplicate/expired가 host 생성으로 전환되지 않음. parser unit + route/component.
- Critical: /draw가 네트워크 방을 생성하지 않고 같은 roster/mode를 선택 게임에 handoff, storage 불가/목록 실패에서 recover. component.
- 후반 course 변경은 완주/출발자리 상관/재현을 simulation으로 확인.
- 실제 컴퓨터 사용 검증은 명시적 승인 후에만; 없으면 미실행을 기록. 테스트 결과와 빌드는 final-verification.md에 출력 근거 기록.

## Required cases
- 실제 Game.step으로 30/60/120Hz에서 완료 결과를 비교하고 수동 슬로모션/선택 변경과 fastForward 결과도 비교한다. 최소 고정 3시드 × 3코스 × 4모드; order 전체 길이/유일 marble ID/순위/done phase를 검사한다.
- 정확히 하나 남은 경우와 동일 owner의 둘이 남은 경우를 구분한다. 결승 입구 가까운 2/3개 경합, 서로 떨어진 경우, 연출 제한 시간/회복, 카메라/이름표의 관심 ID 일치를 검사한다.
- 초대 파싱은 대소문자/공백/하이픈/전체 링크, r 누락/빈/중복/잘못된 값, game/localhost와 다른 제품 host를 구분한다. 기존 ko/en 링크, 입장 수정 재시도, unknown/closed 오류, clipboard rejection/share AbortError를 검사한다.
- draw는 relay 미연결, catalog loading/failure/retry/empty/filter/<2, corrupt/storage-denied draft, handoff 실패 nav 방지, 실제 parser 소비, 결과 복사 실패와 명단 유지 재시작을 검사한다.
- 코스 검증: 각 코스 2/6/12명 × 고정 20시드(1..20의 7919배), 판별 최대 simulation 240초 내 완주/전체 유일 order/재현. 출발 x↔도착 rank Spearman 상관은 각 코스 6명 × 120 고정 시드로 baseline과 변경 후 비교 보고하며 |rho| > 0.20이면 원인 분석 후 변경 조정(공정성을 통계만으로 증명한다고 주장하지 않음).
