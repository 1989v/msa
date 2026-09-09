package com.kgd.game.application.party.usecase

/**
 * 참여형 채점 (ADR-0092 · SR-7) — 아케이드 채점 스택의 확장이다.
 *
 * **제출에 점수 필드가 없다.** 클라이언트가 계산한 값을 받을 자리 자체를 두지 않는 것이
 * 「실패해도 클라이언트 점수로 폴백하지 않는다」의 실질 방어선이다 — 폴백할 값이 없으면
 * 폴백하는 코드를 쓸 수 없다.
 */
interface SubmitPartyPlayUseCase {
    fun execute(command: Command): RoundStanding

    sealed interface Payload {
        /**
         * 7초 맞추기 — 클라이언트 시각을 안 받는다. 서버가 판 시작을 스탬프하고 이 요청이
         * 도착한 시각을 잰다. 네트워크 지연(수십 ms)이 오차로 들어오지만 7초 게임의 변별력이
         * 그보다 크다.
         */
        data object StopNow : Payload

        /**
         * 원그리기 — 궤적 점열. 서버가 재현할 수 없으므로 **개연성 검사가 상한**이다.
         * 완전한 방어는 없고 캐주얼 조작만 막는다.
         */
        data class Trace(val points: List<TracePoint>) : Payload
    }

    data class TracePoint(val x: Double, val y: Double, val atMs: Long)

    data class Command(
        val roomCode: String,
        val seat: Int,
        val token: String,
        val payload: Payload,
    )
}

/** 방장이 판을 열 때 서버가 시작 시각을 스탬프한다 — 7초를 서버 시계로 재기 위해 */
interface StartPartyPlayUseCase {
    fun execute(command: Command): RoundStanding

    data class Command(val roomCode: String, val seat: Int, val token: String, val game: String)
}

/** 제한 시간이 지났다 — 미제출자를 최하위로 놓고 마감한다 */
interface ClosePartyPlayUseCase {
    fun execute(roomCode: String): RoundStanding
}

/**
 * @param ranking 좌석 번호의 순위. **별칭은 없다** — 채점은 좌석으로만 판정하고 이름은
 *                화면이 자기 명부에서 붙인다. 서버가 이름을 알 이유가 없다.
 */
data class RoundStanding(
    val game: String,
    val open: Boolean,
    val submitted: Int,
    val eligible: Int,
    val ranking: List<Int>,
    val rejected: Map<Int, String>,
    val voided: Boolean,
)
