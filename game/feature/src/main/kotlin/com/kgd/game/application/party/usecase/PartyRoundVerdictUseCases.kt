package com.kgd.game.application.party.usecase

/**
 * 결과 해시 판정 (ADR-0092 · SR-6).
 *
 * 비참여형은 각 기기가 스스로 결과를 계산한다. 그것이 갈리면 안 되는데, 「하나라도 다르면 무효」로
 * 두면 **결과가 마음에 안 드는 참가자가 거짓 해시 하나로 재추첨을 만든다**(다시 하면 시드가 새로
 * 뽑히므로). 그래서 다수결로 판정하고 소수는 이탈로 처리한다.
 *
 * **제출에 좌석 토큰이 필요하다.** 관문이 없으면 이 다수결이 뒤집힌다 — 외부인·관전자가 해시를
 * 채워 다수를 쥐면 결과를 무르는 정도가 아니라 **어느 결과를 방의 결과로 만들지 고른다.**
 */
interface SubmitRoundHashUseCase {
    fun execute(command: Command): RoundVerdict

    data class Command(
        val roomCode: String,
        val seat: Int,
        val token: String,
        /** 각 기기가 판 끝에 계산한 결과의 해시. 릴레이는 이 값을 안 본다 */
        val hash: String,
    )
}

/**
 * @param agreed  다수 해시. 이것이 방의 결과다
 * @param diverged 다수와 다른 해시를 낸 좌석 — 「내 화면이 방과 달라졌다」를 띄운다
 * @param voided  다수가 없어 무효. 2회 연속이면 그 게임을 방에서 잠근다
 */
data class RoundVerdict(
    val settled: Boolean,
    val submitted: Int,
    val eligible: Int,
    val agreed: String?,
    val diverged: List<Int>,
    val voided: Boolean,
    val consecutiveVoids: Int,
    val gameLocked: Boolean,
)
