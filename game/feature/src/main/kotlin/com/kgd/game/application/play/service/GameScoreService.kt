package com.kgd.game.application.play.service

import com.kgd.game.application.catalog.port.GameRepositoryPort
import com.kgd.game.application.play.dto.LeaderboardBoardDto
import com.kgd.game.application.play.port.GameScoreRepositoryPort
import com.kgd.game.application.play.port.ScoreEntry
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.game.domain.catalog.exception.GameNotFoundException
import com.kgd.game.domain.play.model.GameDay
import com.kgd.game.domain.play.model.ScoreBoardKey
import com.kgd.game.domain.play.model.ScorePeriod
import com.kgd.game.domain.play.model.ScoreTrack
import com.kgd.game.application.play.usecase.GetActiveLeaderboardsUseCase
import com.kgd.game.application.play.usecase.GetGameLeaderboardUseCase
import com.kgd.game.application.play.usecase.SubmitGameScoreUseCase
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate

/** 게임별 랭킹 — 닉네임당 최고 기록. 게스트 제출 허용 (닉네임이 곧 신원) */
@Service
class GameScoreService(
    private val gameRepository: GameRepositoryPort,
    private val scoreRepository: GameScoreRepositoryPort,
) : SubmitGameScoreUseCase, GetGameLeaderboardUseCase, GetActiveLeaderboardsUseCase {
    companion object {
        private const val MAX_SCORE = 1_000_000_000_000L   // 명백한 조작값 상한
        private val NICK_REGEX = Regex("^[\\p{L}\\p{N} _.-]{2,16}$")
        private const val MAX_ACTIVE_BOARDS = 12
        private const val MAX_ACTIVE_ENTRIES = 10

        /**
         * 집계에서 넉넉히 긁어오는 배수 — 게임당 보드가 여럿일 수 있고(뒤 보드는 버려진다)
         * 공개 상태가 아닌 게임도 섞여 나오므로, 걸러낸 뒤에도 요청 수를 채우도록 여유를 둔다.
         * 모드를 나눈 게임이 생기면서 게임당 보드가 최대 3개가 됐다 — 배수를 그만큼 올린다.
         */
        private const val ACTIVE_FETCH_FACTOR = 6
    }

    /**
     * 점수 제출 — 역대 보드와 오늘 보드를 **한 트랜잭션에서** 함께 올린다.
     *
     * 날짜는 서버가 정한다(`GameDay`). 클라이언트가 실어 보내게 하면 기기 시계와 타임존만큼
     * 보드가 갈라지고, 게임 57종이 쓰는 공용 제출 코드(`lib/rank.js`)를 전부 고쳐야 한다.
     */
    @Transactional(transactionManager = "gameTransactionManager")
    override fun execute(command: SubmitGameScoreUseCase.Command): Pair<Boolean, Int> {
        // 위치 분해를 쓰지 않는다 — Command 에 필드를 하나 끼워 넣는 순간 값이 조용히 밀린다
        val gameId = resolveGameId(command.slug)
        val nick = command.nickname.trim()
        val score = command.score
        if (!NICK_REGEX.matches(nick)) throw BusinessException(ErrorCode.INVALID_INPUT, "닉네임은 2~16자 (문자/숫자/공백/._-)")
        if (score !in 0..MAX_SCORE) throw BusinessException(ErrorCode.INVALID_INPUT, "점수 범위 오류")
        // 보드 키는 카탈로그 선언과 대조하지 않는다 — 게임이 모드를 늘렸는데 시드가 아직
        // 안 따라온 순간에 기록을 버리게 된다. 선언은 사이트가 탭 이름을 짓는 데만 쓴다.
        return scoreRepository.submit(
            gameId, command.track, command.board, nick, command.memberId,
            score, command.detail?.take(64), GameDay.today(),
        )
    }

    /**
     * 보드 조회. `period` 를 생략하면 역대 보드 — 기존 호출자(게임 안 `lib/rank.js` 포함)의
     * 계약이 그대로 유지된다. `date` 는 DAILY 에서만 뜻이 있고, 생략하면 KST 기준 오늘이다.
     */
    @Transactional(transactionManager = "gameTransactionManager", readOnly = true)
    override fun execute(query: GetGameLeaderboardUseCase.Query): List<ScoreEntry> {
        val (slug, track, limit, board, period, date) = query
        val gameId = resolveGameId(slug)
        val size = limit.coerceIn(1, 50)
        return when (period) {
            ScorePeriod.ALL_TIME -> scoreRepository.top(gameId, track, board, size)
            ScorePeriod.DAILY -> scoreRepository.topDaily(gameId, track, board, date ?: GameDay.today(), size)
        }
    }

    /**
     * 허브 랭킹 레일 — 기록이 있는 보드만 한 번에.
     *
     * 카탈로그 60여 종에 각각 리더보드를 물으면 요청이 그만큼 나간다. 반대로 여기서는
     * `game_score` 에 행이 있는 보드(= 기록이 있는 보드)만 최근 갱신순으로 뽑는다 —
     * 지금처럼 기록이 세 게임에만 있으면 결과도 세 칸이고, 그게 정직한 화면이다.
     *
     * **게임당 한 보드**만 싣는다. 보드를 합치지는 않되(합치면 강화 기록이 무강화 순위를,
     * 쉬운 모드가 어려운 모드를 밀어낸다), 레일에서 같은 게임이 여러 칸을 차지하면 순회가
     * 반복으로 보이므로 최근에 갱신된 보드를 싣고 나머지는 상세 페이지에서 보게 한다.
     *
     * 보드마다 오늘 기록을 함께 실어 보낸다 — 레일이 "오늘의 1위"를 보여주려고 요청을 한 번 더
     * 하지 않게. 오늘 아무도 안 논 보드는 그 칸이 비고, 레일은 역대 기록으로 그린다.
     */
    @Transactional(transactionManager = "gameTransactionManager", readOnly = true)
    override fun execute(query: GetActiveLeaderboardsUseCase.Query): List<LeaderboardBoardDto> {
        val boards = query.boardLimit.coerceIn(1, MAX_ACTIVE_BOARDS)
        val entries = query.entryLimit.coerceIn(1, MAX_ACTIVE_ENTRIES)

        val refs = scoreRepository.activeBoards(boards * ACTIVE_FETCH_FACTOR).distinctBy { it.gameId }
        val games = gameRepository.findByIds(refs.map { it.gameId }).associateBy { it.id }
        val today = GameDay.today()

        return refs.asSequence()
            .mapNotNull { ref -> games[ref.gameId]?.takeIf { it.isPlayable() }?.let { ref to it } }
            .map { (ref, game) ->
                // 보드 이름은 카탈로그 선언에서 찾는다. 못 찾으면 이름 없이 내보낸다 —
                // 키를 그대로 화면에 띄우면 게임이 쓰는 낱말이 아닌 영문 식별자가 나간다.
                val def = game.scoreBoards.firstOrNull { it.key == ref.board.value }
                LeaderboardBoardDto(
                    slug = game.slug,
                    title = game.title,
                    titleEn = game.titleEn,
                    thumbnailUrl = game.thumbnailUrl,
                    track = ref.track,
                    board = ref.board.value,
                    boardName = def?.name,
                    boardNameEn = def?.nameEn,
                    entries = scoreRepository.top(ref.gameId, ref.track, ref.board, entries),
                    todayEntries = scoreRepository.topDaily(ref.gameId, ref.track, ref.board, today, entries),
                )
            }
            .filter { it.entries.isNotEmpty() }
            .take(boards)
            .toList()
    }

    private fun resolveGameId(slug: String): Long {
        val game = gameRepository.findBySlug(slug) ?: throw GameNotFoundException(slug)
        if (!game.isPlayable()) throw GameNotFoundException(slug)
        return requireNotNull(game.id) { "영속화된 게임에는 id가 있어야 합니다" }
    }
}
