package com.kgd.blog.application.interaction.port

import com.kgd.blog.domain.model.DailyViews
import java.time.LocalDate

/** 조회 원장 — 조회수의 진실. `(post_id, visitor_key, view_date)` 유니크가 하루 1회로 접는다 */
interface BlogPostViewRepositoryPort {
    /** @return 처음 본 것이면 true, 이미 센 것이면 false. 동시 요청에도 원자적이어야 한다 */
    fun recordIfAbsent(postId: Long, visitorKey: String, date: LocalDate): Boolean
    /** `[from, to]` 일별 집계, 날짜 오름차순 */
    fun countDailyByPost(postId: Long, from: LocalDate, to: LocalDate): List<DailyViews>
    fun deleteOlderThan(threshold: LocalDate): Int
}
