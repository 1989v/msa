package com.kgd.blog.application.interaction.dto

import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min

data class BlogReaction(
    val liked: Boolean,
    val likeCount: Long,
    val ratingAverage: Double,
    val ratingCount: Long,
    val myScore: Int?,
)

data class BlogRatingRequest(
    @field:Min(1) @field:Max(5) val score: Int,
)
