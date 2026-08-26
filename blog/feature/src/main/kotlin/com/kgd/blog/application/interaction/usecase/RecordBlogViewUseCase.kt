package com.kgd.blog.application.interaction.usecase

/** 조회 1건 반영. 집계 실패가 글 조회를 막지 않는다 — 구현이 예외를 삼킨다 */
interface RecordBlogViewUseCase {
    fun execute(command: Command)

    data class Command(val postId: Long, val visitorKey: String?, val userAgent: String?)
}
