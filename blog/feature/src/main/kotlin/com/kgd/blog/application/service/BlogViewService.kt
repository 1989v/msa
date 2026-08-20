package com.kgd.blog.application.service

import com.kgd.blog.infrastructure.persistence.repository.BlogPostJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogPostViewJpaRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate

/**
 * 조회수 집계 (ADR-0072 §4).
 *
 * 원장(`blog_post_view`)의 유니크 제약이 하루 1회로 접고, 새로 들어간 경우에만 카운터를 올린다.
 * 카운터는 표시·정렬용 파생값이고 진실은 원장이다.
 */
@Service
class BlogViewService(
    private val viewRepository: BlogPostViewJpaRepository,
    private val postRepository: BlogPostJpaRepository,
) {
    private val log = KotlinLogging.logger {}

    /**
     * 조회 1건 반영.
     *
     * **집계 실패가 글 조회를 막지 않는다.** 읽기가 본질이고 통계는 부수다 — 예외는 삼키고
     * warn 만 남긴다. 이 순서를 뒤집으면 DB 가 흔들릴 때 글이 통째로 500 이 된다.
     *
     * 조회 트랜잭션과 분리해 REQUIRES_NEW 로 연다. 상세 조회는 read-only 라 같은 트랜잭션에
     * 쓰기를 얹을 수 없다.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun record(postId: Long, visitorKey: String?, userAgent: String?) {
        if (visitorKey.isNullOrBlank()) return
        // 봇을 세면 조회수가 "사람이 읽은 횟수"가 아니게 되고, 그 숫자를 보고 글을 쓰게 되면
        // 판단 자체가 오염된다.
        if (isBot(userAgent)) return
        runCatching {
            val inserted = viewRepository.insertIfAbsent(postId, visitorKey.take(MAX_KEY), LocalDate.now())
            if (inserted > 0) postRepository.increaseViewCount(postId)
        }.onFailure { log.warn(it) { "조회수 집계 실패 postId=$postId" } }
    }

    /** 보존기간 초과 원장 정리 — 어드민에서 수동 실행 */
    @Transactional
    fun purgeOlderThan(days: Long): Int =
        viewRepository.deleteOlderThan(LocalDate.now().minusDays(days))

    private fun isBot(userAgent: String?): Boolean {
        val ua = userAgent?.lowercase() ?: return false
        return BOT_MARKERS.any { it in ua }
    }

    companion object {
        const val MAX_KEY = 64
        const val RETENTION_DAYS = 90L

        /**
         * 완전한 봇 목록은 존재하지 않는다. 흔한 것만 걸러 신호 대 잡음을 맞추는 게 목적이고,
         * 정확한 사람 수를 재는 것이 목적이 아니다.
         */
        private val BOT_MARKERS = listOf(
            "bot", "crawler", "spider", "slurp", "curl", "wget", "python-requests",
            "headlesschrome", "facebookexternalhit", "embedly", "preview",
        )
    }
}
