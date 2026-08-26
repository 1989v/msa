package com.kgd.blog.application.post.usecase

import com.kgd.blog.application.post.dto.BlogViewDaily
import java.time.LocalDate

/** 일별 조회 추이 — 원장이 있어 공짜로 나오는 값 */
interface GetBlogViewsDailyUseCase {
    fun execute(query: Query): List<BlogViewDaily>

    data class Query(val postId: Long, val from: LocalDate, val to: LocalDate)
}
