package com.kgd.game.application.party.usecase

/**
 * 익명 투표 (ADR-0092 · SR-5) — `[참여형] → [하나 픽]` 경로에서만 쓴다.
 *
 * **릴레이를 지나지 않는다.** 릴레이는 중계 메시지마다 발신 좌석을 박으므로, 전체로 뿌리면
 * 전원이 남의 표를 보고 방장에게만 보내면 방장이 본다. 집계 주체가 있어야 익명이 성립한다.
 */
interface OpenVoteUseCase {
    fun execute(command: Command): VoteView

    data class Command(
        val roomCode: String,
        val seat: Int,
        val token: String,
        /** 후보 게임 슬러그. 화면이 참여형 목록에서 골라 보낸다 */
        val candidates: List<String>,
    )
}

interface CastBallotUseCase {
    fun execute(command: Command): VoteView

    data class Command(
        val roomCode: String,
        val seat: Int,
        val token: String,
        val choice: String,
    )
}

interface ViewVoteUseCase {
    fun execute(command: Command): VoteView

    data class Command(val roomCode: String, val seat: Int, val token: String)
}

/**
 * 화면에 나가는 전부.
 *
 * **(좌석 → 선택)이 여기 없다.** 방장 응답도 같은 타입이라 「방장에게만 상세를 준다」는
 * 구현이 애초에 불가능하다 — 「잡히게」가 아니라 「쓸 수 없게」 만드는 쪽이다.
 *
 * @param submitted 제출한 사람 수. **진행 중에는 이것만 보인다** — 실시간 득표를 흘리면
 *                  제출 순서와 증분을 대조해 누가 무엇을 골랐는지 역산할 수 있다.
 * @param tally     마감 뒤에만 채워진다. 그전에는 빈 맵
 */
data class VoteView(
    val open: Boolean,
    val candidates: List<String>,
    val submitted: Int,
    val eligible: Int,
    val tally: Map<String, Int>,
    val winner: String?,
)
