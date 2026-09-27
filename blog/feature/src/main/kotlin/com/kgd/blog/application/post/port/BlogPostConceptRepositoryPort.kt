package com.kgd.blog.application.post.port

/** 글 ↔ 개념 매핑. 순서는 작성자가 고른 순서다 */
interface BlogPostConceptRepositoryPort {
    fun findConceptIds(postId: Long): List<String>

    /** 글의 매핑을 [conceptIds] 로 통째로 바꾼다 */
    fun replace(postId: Long, conceptIds: List<String>)

    fun deleteByPostId(postId: Long)
}
