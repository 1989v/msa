package com.kgd.blog.application.category.port

import com.kgd.blog.domain.model.BlogCategory

interface BlogCategoryRepositoryPort {
    fun findById(id: Long): BlogCategory?
    /** path 오름차순 — 트리 조립 순서 */
    fun findAllOrderByPath(): List<BlogCategory>
    fun findAllByIdIn(ids: Collection<Long>): List<BlogCategory>
    /** 자기 자신 + 모든 하위 (물질화 경로 prefix) */
    fun findSubtree(path: String): List<BlogCategory>
    fun existsByParentIdAndSlug(parentId: Long?, slug: String): Boolean
    fun countByParentId(parentId: Long): Long
    /** id 가 있으면 전체 동기화, 없으면 생성 */
    fun save(category: BlogCategory): BlogCategory
    fun saveAll(categories: List<BlogCategory>)
    fun deleteById(id: Long)
}
