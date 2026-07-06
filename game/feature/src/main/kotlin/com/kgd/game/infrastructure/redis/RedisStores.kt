package com.kgd.game.infrastructure.redis

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.game.domain.GameSession
import com.kgd.game.domain.Player
import com.kgd.game.domain.PlayerId
import com.kgd.game.domain.PlayerStore
import com.kgd.game.domain.ReplayStore
import com.kgd.game.domain.SessionId
import com.kgd.game.domain.SessionStatus
import com.kgd.game.domain.SessionStore
import com.kgd.game.domain.StoredReplay
import com.kgd.game.domain.VerificationStatus
import com.kgd.game.sim.ReplayLog
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Component
import java.time.Duration
import java.util.UUID

@Component
class RedisSessionStore(
    private val redis: StringRedisTemplate,
) : SessionStore {
    private fun key(id: SessionId) = "game:session:${id.value}"

    override fun save(session: GameSession) {
        val k = key(session.id)
        redis.opsForHash<String, String>().putAll(
            k,
            mapOf(
                "gameId" to session.gameId,
                "playerId" to (session.playerId?.value ?: ""),
                "seed" to session.seed.toString(),
                "dailyDate" to (session.dailyDate ?: ""),
                "startedEpochMs" to session.startedEpochMs.toString(),
                "status" to session.status.name,
            ),
        )
        redis.expire(k, Duration.ofHours(2))
    }

    override fun find(id: SessionId): GameSession? {
        val h = redis.opsForHash<String, String>().entries(key(id))
        if (h.isEmpty()) return null
        val gameId = h["gameId"] ?: return null
        val seed = h["seed"]?.toIntOrNull() ?: return null
        return GameSession(
            id = id,
            gameId = gameId,
            playerId = h["playerId"]?.takeIf { it.isNotEmpty() }?.let { PlayerId(it) },
            seed = seed,
            dailyDate = h["dailyDate"]?.takeIf { it.isNotEmpty() },
            startedEpochMs = h["startedEpochMs"]?.toLongOrNull() ?: 0L,
            status = h["status"]?.let { runCatching { SessionStatus.valueOf(it) }.getOrNull() } ?: SessionStatus.OPEN,
        )
    }
}

/** 리플레이 보관 — Tier B 재실행용. ReplayLog 는 JSON, claimedScore/status 는 별도 필드. */
@Component
class RedisReplayStore(
    private val redis: StringRedisTemplate,
    private val mapper: ObjectMapper,
) : ReplayStore {
    private fun key(id: SessionId) = "game:replay:${id.value}"

    override fun save(stored: StoredReplay) {
        val k = key(stored.sessionId)
        redis.opsForHash<String, String>().putAll(
            k,
            mapOf(
                "replay" to mapper.writeValueAsString(stored.replay),
                "claimedScore" to stored.claimedScore.toString(),
                "status" to stored.status.name,
            ),
        )
        redis.expire(k, Duration.ofDays(2))
    }

    override fun updateStatus(sessionId: SessionId, status: VerificationStatus) {
        redis.opsForHash<String, String>().put(key(sessionId), "status", status.name)
    }

    /** Tier B 가 보관 리플레이를 다시 읽을 때 사용(현재는 제출 흐름에서 즉시 검증하므로 보조용). */
    fun load(sessionId: SessionId): ReplayLog? {
        val json = redis.opsForHash<String, String>().get(key(sessionId), "replay") ?: return null
        return mapper.readValue(json, ReplayLog::class.java)
    }
}

/** 플레이어 — 게스트(미등록) vs 닉네임 클레임(등록). 등록만 경쟁 랭킹 등재. */
@Component
class RedisPlayerStore(
    private val redis: StringRedisTemplate,
) : PlayerStore {
    private fun playerKey(id: PlayerId) = "game:player:${id.value}"
    private fun nickKey(nickname: String) = "game:nick:${nickname.lowercase()}"

    override fun createGuest(nickname: String): Player {
        val player = Player(PlayerId("guest-${UUID.randomUUID()}"), nickname, registered = false)
        persist(player)
        return player
    }

    override fun registerOrGet(nickname: String): Player {
        val nk = nickKey(nickname)
        redis.opsForValue().get(nk)?.let { existing ->
            return find(PlayerId(existing)) ?: Player(PlayerId(existing), nickname, registered = true)
        }
        val candidate = PlayerId("user-${UUID.randomUUID()}")
        redis.opsForValue().setIfAbsent(nk, candidate.value)
        val winner = redis.opsForValue().get(nk) ?: candidate.value // race-safe: 먼저 쓴 쪽이 이김
        val player = Player(PlayerId(winner), nickname, registered = true)
        persist(player)
        return player
    }

    override fun find(id: PlayerId): Player? {
        val h = redis.opsForHash<String, String>().entries(playerKey(id))
        if (h.isEmpty()) return null
        return Player(id, h["nickname"] ?: "", h["registered"]?.toBoolean() ?: false)
    }

    private fun persist(player: Player) {
        redis.opsForHash<String, String>().putAll(
            playerKey(player.id),
            mapOf("nickname" to player.nickname, "registered" to player.registered.toString()),
        )
    }
}
