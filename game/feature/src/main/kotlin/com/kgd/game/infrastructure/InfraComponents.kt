package com.kgd.game.infrastructure

import com.kgd.game.domain.Clock
import com.kgd.game.domain.DailyChallenge
import com.kgd.game.domain.DailyChallengePort
import com.kgd.game.domain.GameCatalogItem
import com.kgd.game.domain.GameRegistry
import com.kgd.game.domain.SeedSource
import com.kgd.game.domain.SessionId
import com.kgd.game.domain.SessionTokenService
import com.kgd.game.sim.GameModule
import com.kgd.game.sim.games.SnakeGame
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

@Component
class SystemClock : Clock {
    override fun nowEpochMs(): Long = System.currentTimeMillis()
}

/** 서버 발급 seed — 예측 불가, 클라가 고르지 못함(seed shopping 방지). */
@Component
class SecureRandomSeedSource : SeedSource {
    private val random = SecureRandom()
    override fun newSeed(): Int = random.nextInt()
}

/**
 * 데일리 챌린지 공통 seed — (gameId, date) 에서 결정적으로 파생(저장 불필요).
 * 같은 날 모두 같은 맵 → 절차적 맵 공정 경쟁. String.hashCode 는 JLS 로 안정적.
 */
@Component
class DerivedDailyChallenge : DailyChallengePort {
    override fun current(gameId: String, date: String): DailyChallenge =
        DailyChallenge(gameId, date, "$gameId:$date".hashCode())
}

/** gameId → 결정적 게임 모듈/카탈로그. v1 은 Snake. */
@Component
class InMemoryGameRegistry : GameRegistry {
    private val modules: Map<String, GameModule<*>> = mapOf(SnakeGame.ID to SnakeGame())
    private val items: List<GameCatalogItem> = listOf(GameCatalogItem(SnakeGame.ID, "Snake"))

    override fun module(gameId: String): GameModule<*>? = modules[gameId]
    override fun catalog(): List<GameCatalogItem> = items
}

/**
 * 세션 서명 토큰 — HMAC-SHA256("sessionId|seed|startedEpochMs").
 * 무플레이/위조 제출 차단. 비밀키는 game.security.hmac-secret(운영은 반드시 주입).
 */
@Component
class HmacSessionTokenService(
    @Value("\${game.security.hmac-secret:dev-secret-change-me-in-prod}") private val secret: String,
) : SessionTokenService {
    private val algorithm = "HmacSHA256"

    override fun issue(sessionId: SessionId, seed: Int, startedEpochMs: Long): String =
        sign(payload(sessionId, seed, startedEpochMs))

    override fun verify(token: String, sessionId: SessionId, seed: Int, startedEpochMs: Long): Boolean {
        val expected = sign(payload(sessionId, seed, startedEpochMs))
        return java.security.MessageDigest.isEqual(expected.toByteArray(), token.toByteArray())
    }

    private fun payload(sessionId: SessionId, seed: Int, startedEpochMs: Long) =
        "${sessionId.value}|$seed|$startedEpochMs"

    private fun sign(data: String): String {
        val mac = Mac.getInstance(algorithm)
        mac.init(SecretKeySpec(secret.toByteArray(), algorithm))
        return Base64.getEncoder().encodeToString(mac.doFinal(data.toByteArray()))
    }
}
