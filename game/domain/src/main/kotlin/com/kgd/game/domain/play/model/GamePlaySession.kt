package com.kgd.game.domain.play.model

import com.kgd.game.domain.play.exception.SessionAlreadyEndedException
import java.time.Duration
import java.time.Instant

/**
 * 플레이 세션 — 게스트 허용(memberId null). 세션 row 는 MySQL,
 * 상세 인게임 이벤트는 Kafka(game.session.*) → analytics (설계 §4.2).
 */
class GamePlaySession private constructor(
    val id: Long? = null,
    val sessionKey: String,
    val gameId: Long,
    val memberId: Long?,
    val deviceType: DeviceType,
    val startedAt: Instant,
    var endedAt: Instant?,
    var durationSec: Long?
) {
    companion object {
        /**
         * 「열어만 봤다」와 「한 판 했다」의 경계.
         *
         * 목록에서 눌러 들어와 로딩을 보고 아니다 싶어 나가는 데 걸리는 시간의 상한이다.
         * 가장 짧은 게임(사다리·카드 뒤집기)도 한 판이 이보다 길어서, 한 판을 마친 사람은
         * 넘는다. 값을 올리면 짧은 게임이 통째로 빠지고, 내리면 스쳐 간 것이 섞인다.
         */
        const val ENGAGED_MIN_SEC = 20L

        fun start(
            sessionKey: String,
            gameId: Long,
            memberId: Long?,
            deviceType: DeviceType,
            startedAt: Instant
        ): GamePlaySession {
            require(sessionKey.isNotBlank()) { "sessionKey는 비어있을 수 없습니다" }
            return GamePlaySession(
                sessionKey = sessionKey,
                gameId = gameId,
                memberId = memberId,
                deviceType = deviceType,
                startedAt = startedAt,
                endedAt = null,
                durationSec = null
            )
        }

        fun restore(
            id: Long?,
            sessionKey: String,
            gameId: Long,
            memberId: Long?,
            deviceType: DeviceType,
            startedAt: Instant,
            endedAt: Instant?,
            durationSec: Long?
        ): GamePlaySession = GamePlaySession(id, sessionKey, gameId, memberId, deviceType, startedAt, endedAt, durationSec)
    }

    fun end(at: Instant) {
        if (endedAt != null) throw SessionAlreadyEndedException(sessionKey)
        val effectiveEnd = if (at.isBefore(startedAt)) startedAt else at
        endedAt = effectiveEnd
        durationSec = Duration.between(startedAt, effectiveEnd).seconds
    }

    fun isEnded(): Boolean = endedAt != null

    /**
     * 인기 점수에 얹을 만큼 실제로 놀았는가.
     *
     * **끝나지 않은 세션은 언제나 거짓이다** — 탭을 그냥 닫으면 종료가 오지 않으므로
     * 이 값은 「논 사람 전부」가 아니라 「논 것이 확인된 사람」이다. 그래서 점수는 이것만으로
     * 세우지 않고 연 횟수 위에 더한다.
     */
    fun isEngaged(): Boolean = (durationSec ?: -1) >= ENGAGED_MIN_SEC
}
