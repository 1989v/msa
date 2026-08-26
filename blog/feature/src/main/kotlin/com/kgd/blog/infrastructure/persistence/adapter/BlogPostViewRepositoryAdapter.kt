package com.kgd.blog.infrastructure.persistence.adapter

import com.kgd.blog.application.interaction.port.BlogPostViewRepositoryPort
import com.kgd.blog.domain.model.DailyViews
import com.kgd.blog.infrastructure.persistence.repository.BlogPostViewJpaRepository
import org.springframework.stereotype.Component
import java.sql.Date as SqlDate
import java.time.LocalDate

@Component
class BlogPostViewRepositoryAdapter(
    private val jpaRepository: BlogPostViewJpaRepository,
) : BlogPostViewRepositoryPort {

    override fun recordIfAbsent(postId: Long, visitorKey: String, date: LocalDate): Boolean =
        jpaRepository.insertIfAbsent(postId, visitorKey, date) > 0

    /** 집계 행은 `[DATE, COUNT]` 배열로 온다 — 드라이버마다 날짜 타입이 달라 여기서 흡수한다 */
    override fun countDailyByPost(postId: Long, from: LocalDate, to: LocalDate): List<DailyViews> =
        jpaRepository.countDailyByPost(postId, from, to).map { row ->
            val day = when (val raw = row[0]) {
                is LocalDate -> raw
                is SqlDate -> raw.toLocalDate()
                else -> LocalDate.parse(raw.toString())
            }
            DailyViews(day, (row[1] as Number).toLong())
        }

    override fun deleteOlderThan(threshold: LocalDate): Int = jpaRepository.deleteOlderThan(threshold)
}
