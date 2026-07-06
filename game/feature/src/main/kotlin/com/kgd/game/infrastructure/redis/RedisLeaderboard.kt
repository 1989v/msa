package com.kgd.game.infrastructure.redis

import com.kgd.game.domain.BoardKey
import com.kgd.game.domain.LeaderboardEntry
import com.kgd.game.domain.LeaderboardPort
import com.kgd.game.domain.PlayerId
import com.kgd.game.domain.VerificationStatus
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Component

/**
 * 리더보드 — Redis Sorted Set(ZSET). 베스트 점수 유지.
 * 닉네임/검증상태는 보드별 hash 에 병행 저장(플레이어 스토어와 결합 회피).
 */
@Component
class RedisLeaderboard(
    private val redis: StringRedisTemplate,
) : LeaderboardPort {

    private fun board(b: BoardKey) = "${b.gameId}:${b.period}:${b.dateKey ?: "all"}"
    private fun zKey(b: BoardKey) = "game:lb:z:${board(b)}"
    private fun nickKey(b: BoardKey) = "game:lb:nick:${board(b)}"
    private fun statusKey(b: BoardKey) = "game:lb:status:${board(b)}"

    override fun submit(board: BoardKey, playerId: PlayerId, nickname: String, score: Int, status: VerificationStatus) {
        val z = redis.opsForZSet()
        val current = z.score(zKey(board), playerId.value)
        if (current == null || score.toDouble() > current) {
            z.add(zKey(board), playerId.value, score.toDouble())
        }
        redis.opsForHash<String, String>().put(nickKey(board), playerId.value, nickname)
        redis.opsForHash<String, String>().putIfAbsent(statusKey(board), playerId.value, status.name)
    }

    override fun top(board: BoardKey, limit: Int): List<LeaderboardEntry> {
        val tuples = redis.opsForZSet().reverseRangeWithScores(zKey(board), 0, (limit - 1).toLong()) ?: emptySet()
        val nicks = redis.opsForHash<String, String>().entries(nickKey(board))
        val statuses = redis.opsForHash<String, String>().entries(statusKey(board))
        return tuples.mapIndexedNotNull { i, tuple ->
            val pid = tuple.value ?: return@mapIndexedNotNull null
            LeaderboardEntry(
                rank = i + 1,
                playerId = PlayerId(pid),
                nickname = nicks[pid] ?: pid,
                score = tuple.score?.toInt() ?: 0,
                status = statuses[pid]?.let { runCatching { VerificationStatus.valueOf(it) }.getOrNull() }
                    ?: VerificationStatus.PROVISIONAL,
            )
        }
    }

    override fun rankOf(board: BoardKey, playerId: PlayerId): Int? =
        redis.opsForZSet().reverseRank(zKey(board), playerId.value)?.toInt()?.plus(1)

    override fun setStatus(board: BoardKey, playerId: PlayerId, status: VerificationStatus) {
        redis.opsForHash<String, String>().put(statusKey(board), playerId.value, status.name)
    }
}
