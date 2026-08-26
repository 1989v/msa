package com.kgd.blog.domain.model

import java.time.LocalDate

/** 하루치 조회 수 — 원장(`blog_post_view`)의 부산물. 작성자 통계 한 점 */
data class DailyViews(val date: LocalDate, val count: Long)
