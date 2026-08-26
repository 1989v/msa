package com.kgd.blog.application.post.port

import com.kgd.blog.domain.model.BlogPost
import com.kgd.blog.domain.model.Paged
import com.kgd.blog.domain.model.Paging
import com.kgd.blog.domain.model.PostStatus

interface BlogPostRepositoryPort {
    fun findById(id: Long): BlogPost?
    fun findBySlug(slug: String): BlogPost?
    fun existsBySlug(slug: String): Boolean
    fun countByCategoryId(categoryId: Long): Long
    fun findAllByIdIn(ids: Collection<Long>): List<BlogPost>

    /**
     * 공개 목록 — 공개 판정(PUBLISHED)은 저장소가 끝낸다. 발행일 내림차순.
     * [categoryIds]·[authorId] 는 null 이면 조건 없음, 빈 컬렉션은 호출부가 먼저 거른다.
     */
    fun findPublished(categoryIds: Collection<Long>?, authorId: Long?, paging: Paging): Paged<BlogPost>
    /** 어드민 목록 — [status] null 이면 전체 */
    fun findAll(status: PostStatus?, paging: Paging): Paged<BlogPost>
    /** 작성자 목록, id 내림차순 — [status] null 이면 전체 */
    fun findByAuthor(authorId: Long, status: PostStatus?, paging: Paging): Paged<BlogPost>
    /** [status] null 이면 전체 */
    fun countByAuthor(authorId: Long, status: PostStatus?): Long
    fun sumViewCountByAuthor(authorId: Long): Long

    /** id 가 있으면 편집값·상태를 동기화(카운터 유지), 없으면 생성 */
    fun save(post: BlogPost): BlogPost
    fun deleteById(id: Long)

    // 비정규화 카운터 — 엔티티를 읽어 더하면 동시 요청이 서로를 덮어쓴다. UPDATE 한 방
    fun increaseViewCount(id: Long)
    fun addLikeCount(id: Long, delta: Long)
    fun addCommentCount(id: Long, delta: Long)
    fun addRating(id: Long, sumDelta: Long, countDelta: Long)
}
