# 게이트 증명 — 회귀 주입 결과

검사는 스크래치 사본(`/private/tmp/.../scratchpad/inj_<행>/`)에 주입하고 `tests/run.luau` 또는 `tools/verify.py` 를 돌렸다. 공유 워킹트리는 건드리지 않았다. 스크립트 요지: 행마다 프로젝트를 복사 → 한 줄 치환(치환 대상이 없으면 실패) → 실행 → 종료 코드로 RED/GREEN.

1차 주입에서 4행(1·7·9·16)이 초록이었다 — 검사가 Sim 경로를 안 보거나(1), 창이 느슨하거나(7), 거부 경로 하나만 보거나(9), 손상 사례가 약했다(16). 검사를 조인 뒤 재주입해 전부 빨강을 봤다.

| 행 | 주입 | 1차 | 재주입 | 빨간불 메시지 |
|---|---|---|---|---|
| 1 | Sim.attackDamage 가 관통을 무시 | GREEN | RED | `tests/run.luau:8: Sim 피해식: 장궁수 관통 4 vs 철갑 5 → ` |
| 2 | 공업 slope 20→21 | RED | — | `tests/run.luau:8: 강화 비용 30+20L · 25+25L · 상한 근` |
| 3 | 첫 웨이브 2/3 → 1 | RED | — | `tests/run.luau:8: 첫 웨이브 8초 80마리 전초기지 입구` |
| 4 | 무리 안 간격 0.13→0.30 | RED | — | `tests/run.luau:8: 행렬 예정 간격 안 0.13~0.21 / 사이 0.` |
| 5 | 전초 적 생존 판정 제거 | RED | — | `tests/run.luau:8: 첫 웨이브 8초 80마리 전초기지 입구` |
| 6 | 방출 완료 시 타이머 재설정 제거 | RED | — | `tests/run.luau:8: 둘째 웨이브 = 방출 완료 36.97 + 15초 (` |
| 7 | 숲 작업 6→9초 | GREEN | RED | `tests/run.luau:8: 첫 반납 ≈ 왕복 4.7 + 6초 (실제 14.50` |
| 8 | 취소 환급 0.75→1 | RED | — | `tests/run.luau:8: 취소 환급 floor(220×(1−p)×.75)` |
| 9 | UPGRADE_CAP 거부 전 금화 −1 | GREEN | RED | `tests/run.luau:8: UPGRADE_CAP 거부도 무변경` |
| 10 | NODE_FULL→NODE_BUSY | RED | — | `tests/run.luau:8: 노드 4번째 거부 · 무차감` |
| 11 | 협동 나머지 분배 제거 | RED | — | `tests/run.luau:8: 협동 보상 15 → 8/7 (낮은 id 가 나머지` |
| 12 | 경제 패배 경계 ≥500→>500 | RED | — | `tests/run.luau:8: 유닛 0·500G → 계속` |
| 13 | 리더 허용 이동 ∞ | RED | — | `tests/run.luau:8: 한 틱 20 스터드 점프 → 미변경 + corre` |
| 14 | 리더 없음 시 700G 차감 | RED | — | `tests/run.luau:8: 리더 사망·병력 0 → 리더 없음, 자동 차감 없` |
| 15 | 난수에 os.clock | RED | — | `tests/run.luau:8: 복원본 둘 90틱 동일` |
| 16 | 스냅샷 버전 검사 제거 | GREEN | RED | `tests/run.luau:8: 손상 스냅샷(버전·모드·필드 결손) nil` |
| 17a | 좀비 공격 11→4 | RED | — | `tests/run.luau:8: still 봇 리더 사망 -1.00~-1.00 ` |
| 17b | 첫 웨이브 8→20초 | RED | — | `tests/run.luau:8: 첫 웨이브 8초 80마리 전초기지 입구` |
| 18 | 클라이언트가 Campaign require | RED | — | `    assert mod in allowed_shared, f'{path.name} requires shared.{mod}; allowed: {sorted(allowed_shared)}'` |
| 19a | CliffNorth 파트 삭제 | RED | — | `GRID MISMATCH:` |
| 19b | CliffWest 한 셀(4) 밀기 | RED | — | `GRID MISMATCH:` |

전체 21행 빨강. 1차 원시 출력은 스크래치패드 `gate_proof.txt`·`gate_proof_rerun.txt` 에 있었고 요지는 위 표다.

검사 조임 내용: ① `Sim.attackDamage` 로 장궁수(관통 4) vs 철갑(방 5) = 33 ② 첫 반납 창 +2.5초 ③ `UPGRADE_CAP` 거부 뒤 `Sim.canonical` 동일 ④ 유효 스냅샷의 version/mode 만 바꿔도 nil.
