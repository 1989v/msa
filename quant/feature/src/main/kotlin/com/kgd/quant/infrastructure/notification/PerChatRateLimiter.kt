package com.kgd.quant.infrastructure.notification

import kotlinx.coroutines.delay
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.util.concurrent.ConcurrentHashMap

/**
 * TG-P2-10 — Telegram chat 단위 발송 rate limiter (Phase 2 in-memory 단순화 버전).
 *
 * ## 정책
 * - 같은 chatId 로 1초당 최대 1건 발송.
 * - [acquire] 호출 시 마지막 발송 시각 + 1000ms 가 미래면 그만큼 [delay] 후 통과.
 * - 통과 직후 마지막 발송 시각을 현재로 업데이트.
 *
 * ## Phase 2 가정
 * - replicas=1 (ADR-0025) → 단일 JVM `ConcurrentHashMap` 으로 충분.
 * - Phase 3 multi-replica 시 Redis token bucket (TG-P2-11) 으로 교체 예정.
 *
 * ## 정확성 한계
 * - 동일 chatId 동시 호출 시 두 호출이 같은 `last` 를 읽고 모두 nextAllowed 를 계산할 수 있다.
 *   결과적으로 인접한 두 발송 간 간격이 1000ms 미만이 될 가능성이 존재 (race window).
 *   현실적으로 dispatcher 는 single-worker 이므로 race 가 발생하지 않지만,
 *   다중 worker / 다중 인스턴스 도입 시 Redis Lua 스크립트로 atomic 화해야 한다.
 *
 * ## 메모리 누수
 * - chatId 가 유한 (운영 ≤ 수백 개) 이므로 무한 누수 위험 없음.
 *   Phase 3 에서 다중 테넌시 확장 시 LRU 캐시로 교체.
 */
@Component
class PerChatRateLimiter(
    @Value("\${quant.notification.telegram.rate-limit-interval-ms:1000}")
    private val intervalMs: Long = 1_000L,
) {

    private val lastSent: ConcurrentHashMap<String, Long> = ConcurrentHashMap()

    /**
     * chatId 기준 발송 가능 시점까지 대기 후 last sent 시각을 갱신한다.
     *
     * @param chatId 텔레그램 chat id (기타 채널 식별자 재사용 가능)
     */
    suspend fun acquire(chatId: String) {
        val now = System.currentTimeMillis()
        val last = lastSent[chatId] ?: 0L
        val nextAllowed = last + intervalMs
        if (now < nextAllowed) {
            delay(nextAllowed - now)
        }
        lastSent[chatId] = System.currentTimeMillis()
    }
}
