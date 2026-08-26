package com.kgd.blog.application.category.dto

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

/** 카테고리 트리 한 마디. `children` 이 비어 있으면 잎이다 */
data class BlogCategoryNode(
    val id: Long,
    val slug: String,
    val name: String,
    val description: String?,
    val path: String,
    val depth: Int,
    val orderNo: Int,
    val postCount: Long,
    val children: List<BlogCategoryNode>,
)

data class BlogCategoryRequest(
    val parentId: Long?,
    @field:NotBlank @field:Size(max = 60) val slug: String,
    @field:NotBlank @field:Size(max = 60) val name: String,
    @field:Size(max = 300) val description: String?,
    val orderNo: Int = 0,
    val hidden: Boolean = false,
)
