package com.kgd.codedictionary.application.portfolio.service

import com.github.benmanes.caffeine.cache.Caffeine
import com.github.benmanes.caffeine.cache.Ticker
import org.springframework.stereotype.Service
import java.time.Duration
import java.util.UUID

data class SnippetUnlockDto(val token: String, val expiresIn: Long)

/**
 * 광고 시청 후 공개면 스니펫 전문을 여는 1회성 토큰 (ADR-0066 개정).
 *
 * 인메모리인 이유: 이 토큰이 지키는 것은 "광고를 봤다"는 사실 하나뿐이고, 잃어도 광고를
 * 다시 보면 그만이다. 배포는 단일 레플리카(OCI free tier 단일 노드)라 노드 간 공유도
 * 필요 없다 — 레플리카를 늘리는 날에는 공유 저장소로 옮겨야 한다.
 * Caffeine 은 이미 classpath 에 있다 (treemap stats 캐시).
 */
@Service
class SnippetUnlockService(
    ticker: Ticker = Ticker.systemTicker(),
) {

    // maximumSize 는 발급 폭주가 힙을 먹지 않게 하는 안전핀 — 초과분은 오래된 것부터 밀려난다
    private val tokens = Caffeine.newBuilder()
        .ticker(ticker)
        .expireAfterWrite(TTL)
        .maximumSize(10_000)
        .build<String, Boolean>()

    fun issue(): SnippetUnlockDto {
        val token = UUID.randomUUID().toString()
        tokens.put(token, true)
        return SnippetUnlockDto(token = token, expiresIn = TTL.seconds)
    }

    fun isValid(token: String?): Boolean =
        token?.takeIf { it.isNotBlank() }?.let { tokens.getIfPresent(it) } == true

    companion object {
        private val TTL = Duration.ofHours(1)
    }
}
