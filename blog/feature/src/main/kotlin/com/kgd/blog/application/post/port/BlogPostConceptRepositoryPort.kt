package com.kgd.blog.application.post.port

/** 글 ↔ 개념 매핑. 순서는 작성자가 고른 순서다 */
interface BlogPostConceptRepositoryPort {
    fun findConceptIds(postId: Long): List<String>

    /** 글의 매핑을 [conceptIds] 로 통째로 바꾼다 */
    fun replace(postId: Long, conceptIds: List<String>)

    fun deleteByPostId(postId: Long)

    /** 개념별 발행글 수 — 매핑이 있어도 발행 안 된 글은 세지 않는다 */
    fun countPublishedByConcept(): Map<String, Long>
}
