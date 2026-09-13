# T05A-1 · 타격 대상 연결

직접 실행 `node --test implementation/t05a/tests/target.test.mjs` → tests4, pass4, fail0. `node release/build-beta.mjs` 성공.

타격시점 건너뛰기/한공격한피해/0dt중복방지, 앞쪽방향/거리/높이/실제메시 가림, pause/빗나감 소비/공격취소/reset, 실제초원 view초기화와 피격·쓰러짐 표시를 확인했다. 추가 게임 플레이 검사 없이 베타에 반영한다.

연습대상은 정지한 표적이며 플레이어에게 피해를 주지 않는다. 대상의 몸체 이동충돌·적AI·보상·세이브는 미연결이다.
