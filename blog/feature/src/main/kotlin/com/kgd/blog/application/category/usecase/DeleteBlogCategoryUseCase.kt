package com.kgd.blog.application.category.usecase

/** 비어 있을 때만 — 글이나 하위가 남은 채 지우면 그 글들이 조회에서 사라진다 */
interface DeleteBlogCategoryUseCase {
    fun execute(command: Command)

    data class Command(val id: Long)
}
