package com.kgd.game.application.party.port

/**
 * 방·좌석의 진실을 묻는다 (ADR-0092).
 *
 * **방장이 선언한 명단을 받으면 안 된다** — 좌석 토큰 옆에 옆문을 내는 셈이다. 진실은 릴레이만
 * 알고, 릴레이는 `infrastructure.ws` 에 있어서 채점·투표 서비스가 직접 읽으면
 * application → infrastructure 가 되어 레이어 게이트에 걸린다. 그래서 포트를 여기 세우고
 * 릴레이가 구현한다 — 같은 JVM 직접 호출이라 홉은 0 이다.
 *
 * 투표 마감 · 채점 마감 · 판 파기 셋이 이 포트를 공유한다.
 */
interface PartySeatQueryPort {

    /** 방 코드로 현재 판의 상태를 본다. 없는 방이면 null */
    fun findRoom(code: String, gameSlug: String = PARTY_SLUG): PartyRoomView?

    companion object {
        /** 파티 방은 게임에 묶이지 않는다 — 슬러그 하나로 연다 */
        const val PARTY_SLUG = "party"
    }
}

/**
 * 릴레이가 아는 것만 담는다. 참가자 별칭은 **싣지 않는다** — 채점·투표는 좌석 번호로만 판정하고,
 * 별칭은 어떤 서버 기록에도 남기지 않는다.
 */
data class PartyRoomView(
    val code: String,
    /** 방 코드와 함께 판을 가리킨다. 좌석 토큰의 서명 대상이기도 하다 */
    val roundNo: Int,
    /** 판이 도는 중인가 — 닫힌 판에 들어온 제출은 거부한다 */
    val roundOpen: Boolean,
    /**
     * 사람이 앉아 있는 좌석 → 그 좌석의 점유 세대. 관전자는 좌석이 없어 여기 없다.
     * 세대까지 내주는 이유는 좌석 토큰 검증이 그 값을 요구하기 때문이다 — 안 내주면
     * 검증하는 쪽이 「몇 세대인지」를 스스로 정하게 되어 검사가 자기 근거를 만든다.
     */
    val occupiedSeats: Map<Int, Int>,
    /** 방이 열린 시각 — 같은 코드로 다시 열린 방에서 옛 토큰이 살아나지 않게 서명에 섞는다 */
    val createdMs: Long,
)
