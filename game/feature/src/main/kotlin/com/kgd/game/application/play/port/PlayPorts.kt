package com.kgd.game.application.play.port

import com.kgd.game.application.play.dto.GameSessionEndedEvent
import com.kgd.game.application.play.dto.GameSessionStartedEvent
import com.kgd.game.domain.play.model.GamePlaySession
import com.kgd.game.domain.play.model.GameRating

interface PlaySessionRepositoryPort {
    fun save(session: GamePlaySession): GamePlaySession
    fun findBySessionKey(sessionKey: String): GamePlaySession?
}

interface GameRatingRepositoryPort {
    fun findByGameIdAndMemberId(gameId: Long, memberId: Long): GameRating?
    fun findByGameIdAndDeviceId(gameId: Long, deviceId: String): GameRating?
    fun save(rating: GameRating): GameRating
}

interface GameEventPort {
    fun publishSessionStarted(event: GameSessionStartedEvent)
    fun publishSessionEnded(event: GameSessionEndedEvent)
}

/**
 * 개인 기록 조회 — 세션·점수·저장을 한 회원 기준으로 모은다.
 *
 * 세 저장소에 흩어져 있지만 화면에서는 한 패널이라, 포트도 하나로 둔다.
 * 나눠 두면 상세 화면 하나가 포트 셋을 알아야 한다.
 */
interface MemberGameRecordPort {
    fun summarize(gameId: Long, memberId: Long): com.kgd.game.application.play.dto.MyGameRecordDto

    /** 최근 세션 길이 표본 — 예상 플레이타임 계산용. 끝난 세션만, 최신 순 */
    fun recentDurations(gameId: Long, limit: Int): List<Int>
}
