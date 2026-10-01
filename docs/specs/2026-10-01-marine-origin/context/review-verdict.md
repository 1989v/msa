# Review verdict — REVISE

2026-10-01, 첫 설계 리뷰 6종의 발견15건을 판정했다. 계획·아트 범위이며 구현 부재를 결함으로 판정하지 않는다. 명세나 런타임은 수정하지 않았다.

```json
[
  {
    "id": "A1",
    "verdict": "keep",
    "severity": "REVISE",
    "evidence": [
      {
        "file": "docs/specs/2026-10-01-marine-origin/planning/platform.md",
        "line": 54,
        "quote": "방장은 어느 좌석을 본인이 맡는지 고르고 친구는 나머지를 맡는다."
      }
    ],
    "reason": "새 relay 좌석과 저장된 원정 소유자의 수명은 다르므로 명시적 매핑이 필요하다."
  },
  {
    "id": "A2",
    "verdict": "keep",
    "severity": "REVISE",
    "evidence": [
      {
        "file": "docs/specs/2026-10-01-marine-origin/planning/platform.md",
        "line": 48,
        "quote": "최신 완전 checkpoint+연속 delta로 solo fork 전환"
      }
    ],
    "reason": "표시 delta 병합과 실행 상태 복구의 일관성을 보장할 기준 tick·연속성 계약이 아직 없다."
  },
  {
    "id": "D1",
    "verdict": "keep",
    "severity": "REVISE",
    "evidence": [
      {
        "file": "docs/specs/2026-10-01-marine-origin/planning/gameplay.md",
        "line": 43,
        "quote": "모든 전투원0·모든 목수0·금화<180"
      }
    ],
    "reason": "목수 가격100G와 패배 경계가 충돌하고 독립 지갑 협동의 패배 단위도 미정이므로 유지한다."
  },
  {
    "id": "D2",
    "verdict": "keep",
    "severity": "REVISE",
    "evidence": [
      {
        "file": "docs/specs/2026-10-01-marine-origin/planning/gameplay.md",
        "line": 70,
        "quote": "가까운 협동 전투 기여자에게 균등 분배"
      }
    ],
    "reason": "가까움과 최근10초 기여 조건의 관계 및 solo/fork 분배 대상이 불명확하여 결과가 달라진다."
  },
  {
    "id": "D3",
    "verdict": "keep",
    "severity": "REVISE",
    "evidence": [
      {
        "file": "docs/specs/2026-10-01-marine-origin/planning/platform.md",
        "line": 49,
        "quote": "단독 제어권은 남은 사용자에게 이전"
      }
    ],
    "reason": "제어권 이전이 지갑·강화·인원 상한의 병합을 뜻하는지 분리해야 하며 A1과 함께 해결할 수 있다."
  },
  {
    "id": "D4",
    "verdict": "keep",
    "severity": "REVISE",
    "evidence": [
      {
        "file": "docs/specs/2026-10-01-marine-origin/planning/platform.md",
        "line": 54,
        "quote": "방장은 어느 좌석을 본인이 맡는지 고르고 친구는 나머지를 맡는다."
      }
    ],
    "reason": "용어 취향 문제가 아니라 owner/controller/relay seat의 식별자와 수명 구분 문제이므로 피처 범위 정의 요구를 유지한다."
  },
  {
    "id": "I1",
    "verdict": "keep",
    "severity": "REVISE",
    "evidence": [
      {
        "file": "docs/specs/2026-10-01-marine-origin/planning/platform.md",
        "line": 56,
        "quote": "두 명이 hash/contentVersion을 확인한 후 start"
      }
    ],
    "reason": "실제 일반2석 relay는 만석 자동 시작이므로 수동시작 또는 application-ready 장벽을 명시해야 한다."
  },
  {
    "id": "I2",
    "verdict": "keep",
    "severity": "REVISE",
    "evidence": [
      {
        "file": "docs/specs/2026-10-01-marine-origin/planning/platform.md",
        "line": 43,
        "quote": "확정 거래/완전 체크포인트 삭제 금지"
      }
    ],
    "reason": "송신 큐 제한 없이 생성 주기와 삭제 금지만 정했으므로 지속 지연의 유한한 처리 계약이 필요하다."
  },
  {
    "id": "S1",
    "verdict": "keep",
    "severity": "REVISE",
    "evidence": [
      {
        "file": "docs/specs/2026-10-01-marine-origin/planning/platform.md",
        "line": 30,
        "quote": "호스트는 relay가 붙인 sender seat를 신뢰 기준으로 삼고"
      }
    ],
    "reason": "호스트의 명령 검증만으로 게스트 수신 권위·epoch·재전송 결과 캐시의 유효성과 상한이 정해지지 않는다."
  },
  {
    "id": "S2",
    "verdict": "keep",
    "severity": "REVISE",
    "evidence": [
      {
        "file": "docs/specs/2026-10-01-marine-origin/planning/platform.md",
        "line": 43,
        "quote": "확정 거래/완전 체크포인트 삭제 금지"
      }
    ],
    "reason": "I2와 동일 원인의 유효한 발견이며 중복이라는 이유로 기각하지 않고 한 수정으로 함께 닫는다."
  },
  {
    "id": "T1",
    "verdict": "keep",
    "severity": "REVISE",
    "evidence": [
      {
        "file": "docs/specs/2026-10-01-marine-origin/planning/test-quality.md",
        "line": 23,
        "quote": "호스트 이탈·tab close·게스트 drop·양방향 단절·새 room resume, old epoch 거부"
      }
    ],
    "reason": "연결 시나리오 목록에 더해 자원·유닛과 checkpoint/delta 복원 동등성의 결과 기준이 필요하다."
  },
  {
    "id": "T2",
    "verdict": "keep",
    "severity": "REVISE",
    "evidence": [
      {
        "file": "docs/specs/2026-10-01-marine-origin/planning/test-quality.md",
        "line": 25,
        "quote": "server save2슬롯 전체UTF8≤60KiB"
      }
    ],
    "reason": "실제 두 슬롯 중첩 직렬화와 구버전·취소된 fork의 바이트 보존 경계 사례가 계약을 검증하도록 구체화해야 한다."
  },
  {
    "id": "U1",
    "verdict": "keep",
    "severity": "REVISE",
    "evidence": [
      {
        "file": "docs/specs/2026-10-01-marine-origin/planning/world.md",
        "line": 63,
        "quote": "진행중 이탈/저장으로 이미 얻은 보상과 리젠 보상을 무한 복제하지 않음."
      }
    ],
    "reason": "보상 중복 금지만으로 동료 잔류·전원 퇴각·재입장의 공유 인스턴스 상태 전이가 결정되지 않는다."
  },
  {
    "id": "U2",
    "verdict": "keep",
    "severity": "REVISE",
    "evidence": [
      {
        "file": "docs/specs/2026-10-01-marine-origin/planning/gameplay.md",
        "line": 51,
        "quote": "공사 취소: 소비 금화의 미진행 비율×75%를 내림하여 환급."
      }
    ],
    "reason": "차감 시점·건설체 HP·취소와 완공 경쟁의 terminal 처리 없이 환급값과 정원이 구현마다 달라진다."
  },
  {
    "id": "U3",
    "verdict": "keep",
    "severity": "REVISE",
    "evidence": [
      {
        "file": "docs/specs/2026-10-01-marine-origin/planning/world.md",
        "line": 59,
        "quote": "방1 잡몹6, 방2 혼합8, 방3 보스1+호위4."
      }
    ],
    "reason": "첫 목수 획득과 필수 진출을 재현할 배치·초기/리젠 구성·경로 해금이 후속 구현 전에 정해져야 한다."
  }
]
```

SUMMARY: keep 15 / demote 0 / dismiss 0

NOTES: I2/S2는 동일 수정으로 해결 가능하며 A1/D3/D4는 소유권 계약을 함께 보완할 수 있다. 발견을 합쳐 추적하더라도 각 원문 발견의 해소 근거를 남긴다. 전체 판정은 REVISE이며 BLOCK은 없다. 수정 후 해당 차원 재리뷰가 필요하다. 미술 승인이나 원본 지도 충실도 확인을 이 판정이 대신하지 않는다.

## Round 2 aggregation
Architecture / Domain / Implementation / Security / Test-strategy / Usecase 모두 SHIP. 유지한15건은 각 리뷰문서 Round2 근거에 따라 해소. 원본지도 근거·새 시안 승인·수치 튜닝은 별도 미결이며, 구현 완료 판정이 아님.

<!-- source: portal-fe/public/games/lib/relay.js -->
<!-- source: portal-fe/public/games/marine-command/js/sim.js -->
