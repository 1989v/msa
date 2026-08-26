package com.kgd.blog.application.comment.port

import com.kgd.blog.domain.model.BlogComment
import com.kgd.blog.domain.model.CommentStatus
import com.kgd.blog.domain.model.Paged
import com.kgd.blog.domain.model.Paging

interface BlogCommentRepositoryPort {
    fun findById(id: Long): BlogComment?
    /** 삭제·숨김 포함, id 오름차순 — 빼면 대댓글이 부모를 잃는다 */
    fun findAllByPostId(postId: Long): List<BlogComment>
    /** 어드민 목록, id 내림차순 — [status] null 이면 전체 */
    fun findAll(status: CommentStatus?, paging: Paging): Paged<BlogComment>
    /** id 가 있으면 본문·상태 동기화, 없으면 생성 */
    fun save(comment: BlogComment): BlogComment
    fun deleteByPostId(postId: Long)
}
