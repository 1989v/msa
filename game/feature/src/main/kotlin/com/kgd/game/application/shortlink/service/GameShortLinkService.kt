package com.kgd.game.application.shortlink.service

import com.kgd.common.shortlink.ClickContext
import com.kgd.common.shortlink.ShortCode
import com.kgd.common.shortlink.ShortLinkPath
import com.kgd.common.shortlink.ShortLinkPrefix
import com.kgd.common.shortlink.ShortLinks
import com.kgd.game.application.catalog.port.GameRepositoryPort
import com.kgd.game.application.shortlink.port.GameShortLinkClick
import com.kgd.game.application.shortlink.port.GameShortLinkClickRepositoryPort
import com.kgd.game.application.shortlink.usecase.PurgeGameShortLinkClicksUseCase
import com.kgd.game.application.shortlink.usecase.RecordGameShortLinkClickUseCase
import com.kgd.game.application.shortlink.usecase.ResolveGameShortLinkUseCase
import com.kgd.game.application.shortlink.usecase.ResolveGameShortLinkUseCase.Outcome
import com.kgd.game.application.shortlink.usecase.ResolveGameShortLinkUseCase.Resolution
import com.kgd.game.domain.catalog.model.Game
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

/**
 * 게임 단축 주소 `/g/{code}` (ADR-0106).
 *
 * 열 수 있는지는 [Game.isPlayable] 이 정한다 — 공개 상세(`GameQueryService`)와 같은 판정이다.
 * 목적지는 `game.1989v.com/games/{slug}` 이고, 코드는 id 에서 나오므로 슬러그가 바뀌어도 같은 게임으로 간다.
 *
 * 트랜잭션 관리자를 전부 명시한다 — content 호스트의 기본 TM 은 place 것이라, 빠지면 game 쓰기가 조용히 사라진다.
 */
@Service
class GameShortLinkService(
    private val gameRepository: GameRepositoryPort,
    private val clickRepository: GameShortLinkClickRepositoryPort,
    private val shortLinks: ShortLinks,
) : ResolveGameShortLinkUseCase, RecordGameShortLinkClickUseCase, PurgeGameShortLinkClicksUseCase {

    @Transactional(transactionManager = "gameTransactionManager", readOnly = true)
    override fun execute(path: String): Resolution {
        val code = when (val parsed = ShortLinkPath.parse(path)) {
            ShortLinkPath.Home -> return home(Outcome.HOME)
            ShortLinkPath.Invalid -> return home(Outcome.MALFORMED)
            is ShortLinkPath.Code -> parsed.value
        }
        val gameId = ShortCode.decode(code) ?: return home(Outcome.MALFORMED)
        val game = gameRepository.findByIds(listOf(gameId)).firstOrNull()
            ?: return home(Outcome.NOT_FOUND, gameId)
        if (!game.isPlayable()) return home(Outcome.NOT_PUBLIC, gameId)
        return Resolution(Outcome.RESOLVED, gameId, shortLinks.destination(ShortLinkPrefix.GAME, GAMES_PATH, game.slug))
    }

    /** 조회 트랜잭션과 분리해 실패가 302 로 번지지 않게 한다. */
    @Transactional(transactionManager = "gameTransactionManager", propagation = Propagation.REQUIRES_NEW)
    override fun execute(command: RecordGameShortLinkClickUseCase.Command) {
        clickRepository.record(
            GameShortLinkClick(
                gameId = command.gameId,
                clickedAt = LocalDateTime.now(),
                referrerHost = ClickContext.referrerHost(command.referrer),
                uaFamily = ClickContext.uaFamily(command.userAgent),
            ),
        )
    }

    @Transactional(transactionManager = "gameTransactionManager")
    override fun olderThan(days: Long): Int = clickRepository.purgeOlderThan(LocalDateTime.now().minusDays(days))

    private fun home(outcome: Outcome, gameId: Long? = null) =
        Resolution(outcome, gameId, shortLinks.home(ShortLinkPrefix.GAME))

    companion object {
        /** game FE 의 상세 경로 첫 세그먼트 */
        private const val GAMES_PATH = "games"
    }
}
