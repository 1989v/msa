package com.kgd.game.infrastructure.arcade

import com.kgd.game.domain.arcade.Clock
import com.kgd.game.domain.arcade.DailyChallenge
import com.kgd.game.domain.arcade.DailyChallengePort
import com.kgd.game.domain.arcade.GameCatalogItem
import com.kgd.game.domain.arcade.GameRegistry
import com.kgd.game.domain.arcade.SeedSource
import com.kgd.game.domain.arcade.SessionId
import com.kgd.game.domain.arcade.SessionTokenService
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
 * 무플레이/위조 제출 차단. 비밀키는 game.security.hmac-secret.
 *
 * **키가 없으면 뜨지 않는다.** 전에는 공개 레포에 적힌 기본값으로 폴백했는데, 그러면 서명이
 * 누구나 만들 수 있는 값이 되어 **검사가 도는 채로 아무것도 막지 않는다.** 안 무는 검사는
 * 없는 것보다 나쁘다 — 있다고 믿게 만들기 때문이다. 같은 판단이 auth 의 SubjectHasher 에 있다.
 *
 * 배포 순서: Secret 을 먼저 만들고 파드를 올린다.
 *   kubectl -n commerce create secret generic game-hmac \
 *     --from-literal=secret="$(openssl rand -hex 32)"
 *
 * 키를 바꾸면 **진행 중이던 아케이드 세션의 제출이 거부된다**(판당 수 분). 회원 데이터에는
 * 영향이 없다 — 이 서명은 세션 수명만큼만 산다.
 */
@Component
class HmacSessionTokenService(
    @Value("\${game.security.hmac-secret:}") secret: String,
) : SessionTokenService {
    private val algorithm = "HmacSHA256"
    private val secret: String = secret.trim().also {
        check(it.toByteArray().size >= MIN_KEY_BYTES) {
            "game.security.hmac-secret 가 없거나 너무 짧습니다(최소 ${MIN_KEY_BYTES}바이트). " +
                "GAME_HMAC_SECRET 을 주입하세요 — 이 키 없이는 세션 토큰이 위조를 막지 못합니다."
        }
    }

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

    private companion object {
        /** auth 의 SubjectHasher 와 같은 하한 — HMAC-SHA256 블록 크기 */
        const val MIN_KEY_BYTES = 32
    }
}
