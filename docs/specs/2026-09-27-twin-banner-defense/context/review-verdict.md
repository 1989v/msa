# Independent finding adjudication — round 1

Scope: pre-revision `spec.md` and all six engineer-review reports, 2026-09-27. Findings retained at REVISE; no BLOCK. Source statements and relay branches were independently read. No implementation or spec edited by this adjudication.

```json
[
  {
    "id": "A1",
    "verdict": "keep",
    "severity": "REVISE",
    "evidence": [{"file": "game/feature/src/main/kotlin/com/kgd/game/infrastructure/ws/GameRelayRegistry.kt", "line": 403, "quote": "if (room.doneSeats.containsAll(occupants.map { it.seat }))"}],
    "reason": "The actual relay requires all occupied humans to complete; host-only done does not reopen the room. Duplicate of the corresponding part of I-1; one fix closes both."
  },
  {
    "id": "D1",
    "verdict": "keep",
    "severity": "REVISE",
    "evidence": [{"file": "docs/specs/2026-09-27-twin-banner-defense/spec.md", "line": 15, "quote": "자신의 빈 칸에 선택한 편성에서 시드 기반 무작위 소환."}],
    "reason": "The chosen pool is not defined. A fixed all-ten unlocked pool is a sufficient routine implementation default."
  },
  {
    "id": "D2",
    "verdict": "keep",
    "severity": "REVISE",
    "evidence": [{"file": "docs/context-map.md", "line": 16, "quote": "| BC | Root | Glossary | 핵심 도메인 명사 (auto-extracted) |"}, {"file": "docs/specs/2026-09-27-twin-banner-defense/spec.md", "line": 17, "quote": "병종 강화와 동료에게 군량 50 지원."}],
    "reason": "The context map has no game entry and no root glossary exists. Retain the checklist's documentation finding; a small local glossary or explicit new-term flag is sufficient."
  },
  {
    "id": "SEC-1",
    "verdict": "keep",
    "severity": "REVISE",
    "evidence": [{"file": "game/feature/src/main/kotlin/com/kgd/game/infrastructure/ws/GameRelayRegistry.kt", "line": 479, "quote": "out.set(\"d\", opaque)"}, {"file": "docs/specs/2026-09-27-twin-banner-defense/spec.md", "line": 37, "quote": "닉네임 game_nickname, 최대16자, 채팅120자."}],
    "reason": "Opaque peer payloads bypass sender UI limits. Inbound type/length checks and escaped plain-text display address the actual trust boundary."
  },
  {
    "id": "U-1",
    "verdict": "keep",
    "severity": "REVISE",
    "evidence": [{"file": "docs/specs/2026-09-27-twin-banner-defense/planning/requirements.md", "line": 32, "quote": "초기 후보는 10종이며 편성 수와 해금 여부는 구현 명세에서 확정한다."}],
    "reason": "The unresolved preparation flow is the same omission as D1; fixed all-ten pool removes the need for an editor and closes both findings."
  },
  {
    "id": "TEST-1",
    "verdict": "keep",
    "severity": "REVISE",
    "evidence": [{"file": "docs/specs/2026-09-27-twin-banner-defense/tasks.md", "line": 30, "quote": "메시지 제한과 위조·중복 명령 테스트,2브라우저 일치/나가기/다시하기 검증."}],
    "reason": "Broad suite names do not identify coverage for explicit asset-retry, malformed save, snapshot assembly, five-entry-route and hidden-host promises. A compact SR-to-case matrix is sufficient."
  },
  {
    "id": "TEST-2",
    "verdict": "keep",
    "severity": "REVISE",
    "evidence": [{"file": "docs/specs/2026-09-27-twin-banner-defense/tasks.md", "line": 31, "quote": "node --test tests/network.test.mjs + node tools/e2e.mjs"}],
    "reason": "The named commands do not yet commit to real two-page WebSocket traffic or deterministic fixtures; defining these boundaries makes continuation and fragmentation tests meaningful."
  },
  {
    "id": "I-1",
    "verdict": "keep",
    "severity": "REVISE",
    "evidence": [{"file": "game/feature/src/main/kotlin/com/kgd/game/infrastructure/ws/GameRelayRegistry.kt", "line": 315, "quote": "if (room.started && !room.legacy && !room.manualStart)"}, {"file": "game/feature/src/main/kotlin/com/kgd/game/infrastructure/ws/GameRelayRegistry.kt", "line": 357, "quote": "if (!room.manualStart && occupants.size == room.capacity) startRoom(room, occupants)"}],
    "reason": "The no-server-change spec cannot rely on ROOM_STARTED for two-seat/manual rooms or a legacy readiness/countdown gate. Retain explicit quick-start, all-seat done, busy admission refusal, leave-before-offline-continuation, and stale session/round event fencing."
  },
  {
    "id": "I-2",
    "verdict": "keep",
    "severity": "REVISE",
    "evidence": [{"file": "docs/specs/2026-09-27-twin-banner-defense/spec.md", "line": 48, "quote": "hidden 탭 불필요 렌더 중단, 온라인 호스트 시뮬 진행 정책 명시."}],
    "reason": "The spec asks for a policy without choosing one while requiring authoritative host state and fixed-step accumulation. A bounded suspension/catch-up policy with a visible guest indication resolves the implementation ambiguity."
  }
]
```

SUMMARY: keep 9 / demote 0 / dismiss 0

NOTES: I-1's existing stale-event finding must include unsolicited `start`: legacy admission can trigger a new start before busy-handshake rejection is processed. Review findings are historical; re-review amended documents before declaring SHIP.
