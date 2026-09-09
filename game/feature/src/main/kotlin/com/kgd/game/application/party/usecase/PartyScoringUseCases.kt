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
         * 원그리기 — 궤적 점열. **목표 원을 따라 그린 것**이라 서버가 이탈을 직접 잰다.
         * 다만 궤적 자체를 재현할 수는 없으므로 위조 방어는 개연성 검사가 상한이다.
         *
         * 좌표는 1000×1000 정규 공간이다 — 화면 크기가 기기마다 달라도 같은 잣대로 잰다.
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

/**
 * 따라 그릴 목표 원 (ADR-0092 · OQ-2). 1000×1000 정규 공간의 좌표다.
 *
 * **서버가 낸다.** 클라이언트가 고르게 두면 작은 원을 골라 쉽게 만들 수 있다 — 시드를
 * 방장에게 안 맡기는 것과 같은 이유고, 한 판의 전원이 **같은 목표**를 받아야 비교가 성립한다.
 */
data class CircleTarget(val cx: Double, val cy: Double, val r: Double)

/**
 * 화면이 판을 열 때 받는 것 — **목표는 여기로만 나간다.**
 *
 * 방장 화면이 이 값을 릴레이 시작 신호의 `cfg` 에 실어 방 전원에게 나른다. 릴레이는 `cfg` 를
 * 열어보지 않으므로 무권위 원칙은 그대로다 — 서버가 정한 것을 릴레이가 나르기만 한다.
 */

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
    /** 원그리기일 때만 채워진다 — 화면이 이 원을 그리고 사람이 그것을 따라 그린다 */
    val target: CircleTarget?,
    val open: Boolean,
    val submitted: Int,
    val eligible: Int,
    val ranking: List<Int>,
    /**
     * 좌석 → 0~100 점. **원그리기에서만, 마감 뒤에만** 채워진다.
     *
     * 서버가 변환까지 하는 이유는 화면이 자기 식으로 바꾸면 서버와 다른 숫자를 보이기
     * 때문이다. 7초는 점수 대신 오차 초를 그대로 보이므로 여기 안 담는다.
     */
    val scores: Map<Int, Double>,
    val rejected: Map<Int, String>,
    val voided: Boolean,
)
