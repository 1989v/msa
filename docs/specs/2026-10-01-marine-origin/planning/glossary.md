# Feature glossary
| 용어 | ID / 수명 | 관계 |
|---|---|---|
| 캠페인 | campaignId / 새 원정~승패 | 맵·진행·경제를 담는 게임세계 |
| 소유자 | campaignOwnerId 0..1 / 캠페인 고정 | gold/upgrades/병력24/목수8/탑6을 소유, 계정아님 |
| 릴레이 좌석 | relaySeat / 방접속 동안 | 서버가 붙인 송신자;복구시 소유자와 일치하지 않을 수 있음 |
| 제어자 | controllerId / 접속 또는solo fork | 허용된 소유자집합에 명령;지갑·정원 합병과 다름 |
| 프로필 | platform playerId / 플랫폼계정 | 닉네임 주체;캠페인 소유권의 인증값으로사용하지않음 |
| 원정대 | owner+commandGroup / 유닛구성 변동 | 함께이동/진입하는 전투병력;목수와주둔자제외 |
| 주둔 슬롯 | towerId+slot0..3 / 입장~퇴각 | 유닛ID참조,월드중복개체를생성하지않음 |
| 체크포인트 | epoch+id+tick / 완전복구본 | 검증된전체실행상태;표시delta와별도 |
| epoch | 새온라인시작마다생성 | 과거명령·과거호스트패킷차단 |
| solo fork | forkId / 협동분기~종료 | 원래coop난이도와소유자2개보존,통합/합병없음 |

<!-- source: portal-fe/public/games/lib/relay.js -->
<!-- source: portal-fe/public/games/marine-command/js/sim.js -->
