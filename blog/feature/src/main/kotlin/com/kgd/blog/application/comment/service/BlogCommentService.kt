package com.kgd.blog.application.comment.service

import com.kgd.blog.application.comment.dto.BlogCommentNode
import com.kgd.blog.application.comment.port.BlogCommentRepositoryPort
import com.kgd.blog.application.comment.usecase.ChangeBlogCommentStatusUseCase
import com.kgd.blog.application.comment.usecase.CreateBlogCommentUseCase
import com.kgd.blog.application.comment.usecase.DeleteBlogCommentUseCase
import com.kgd.blog.application.comment.usecase.EditBlogCommentUseCase
import com.kgd.blog.application.post.port.BlogPostRepositoryPort
import com.kgd.blog.application.post.service.BlogQueryService
import com.kgd.blog.application.profile.dto.BlogIdentity
import com.kgd.blog.application.profile.service.BlogProfileService
import com.kgd.blog.domain.model.BlogComment
import com.kgd.blog.domain.model.CommentStatus
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 댓글 (ADR-0072 §5 — 유일하게 로그인을 요구하는 상호작용).
 *
 * 익명 댓글을 열지 않은 이유는 무료 티어 단일 노드에서 스팸 대응(캡차·모더레이션 큐)을
 * P1 에 같이 만들어야 하기 때문이다. 로그인 사용자에게도 게이트웨이 Rate Limiter 가 걸린다 —
 * 스팸이 익명에서만 오지는 않는다.
 */
@Service
@Transactional
class BlogCommentService(
    private val commentRepository: BlogCommentRepositoryPort,
    private val postRepository: BlogPostRepositoryPort,
    private val profileService: BlogProfileService,
    private val queryService: BlogQueryService,
) : CreateBlogCommentUseCase, EditBlogCommentUseCase, DeleteBlogCommentUseCase, ChangeBlogCommentStatusUseCase {

    override fun execute(command: CreateBlogCommentUseCase.Command): List<BlogCommentNode> {
        val (request, identity) = command
        val post = queryService.publishedOrThrow(request.postSlug)
        val postId = post.id ?: 0
        val profile = profileService.requireInteractiveProfile(identity, request.displayName)

        request.parentId?.let { parentId ->
            val parent = commentRepository.findById(parentId)
                ?: throw BusinessException(ErrorCode.NOT_FOUND, "원 댓글을 찾을 수 없습니다")
            if (parent.postId != postId) {
                throw BusinessException(ErrorCode.INVALID_INPUT, "다른 글의 댓글에는 답글을 달 수 없습니다")
            }
            BlogComment.requireTopLevelParent(parent)
        }

        // 길이·공백 규칙은 도메인이 판정한다 — 컨트롤러의 @Size 와 규칙이 갈리면
        // 어느 쪽이 진짜인지 알 수 없게 된다
        commentRepository.save(
            BlogComment(
                id = null,
                postId = postId,
                profileId = profile.id ?: 0,
                parentId = request.parentId,
                body = BlogComment.validateBody(request.body),
                status = CommentStatus.VISIBLE,
            ),
        )
        postRepository.addCommentCount(postId, 1)
        return queryService.commentsOf(post, identity)
    }

    override fun execute(command: EditBlogCommentUseCase.Command): List<BlogCommentNode> {
        val (commentId, body, identity) = command
        val comment = editableOrThrow(commentId, identity)
        if (comment.status != CommentStatus.VISIBLE) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "수정할 수 없는 댓글입니다")
        }
        commentRepository.save(comment.edit(body))
        return commentsOf(comment.postId, identity)
    }

    override fun execute(command: DeleteBlogCommentUseCase.Command): List<BlogCommentNode> {
        val (commentId, identity) = command
        val comment = editableOrThrow(commentId, identity)
        if (comment.status == CommentStatus.DELETED) return commentsOf(comment.postId, identity)
        commentRepository.save(comment.softDelete())
        postRepository.addCommentCount(comment.postId, -1)
        return commentsOf(comment.postId, identity)
    }

    /** 모더레이션 — 숨김/복구. 어드민 경로에서만 호출된다 */
    override fun execute(command: ChangeBlogCommentStatusUseCase.Command) {
        val (commentId, status) = command
        val comment = commentRepository.findById(commentId)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "댓글을 찾을 수 없습니다")
        val wasCounted = comment.status == CommentStatus.VISIBLE
        val willCount = status == CommentStatus.VISIBLE
        commentRepository.save(comment.withStatus(status))
        if (wasCounted != willCount) {
            postRepository.addCommentCount(comment.postId, if (willCount) 1 else -1)
        }
    }

    private fun editableOrThrow(commentId: Long, identity: BlogIdentity): BlogComment {
        val comment = commentRepository.findById(commentId)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "댓글을 찾을 수 없습니다")
        val profile = profileService.find(identity)
        profile?.requireCanInteract()
        comment.requireEditableBy(profile?.id, identity.isAdmin)
        return comment
    }

    private fun commentsOf(postId: Long, identity: BlogIdentity): List<BlogCommentNode> {
        val post = postRepository.findById(postId)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "글을 찾을 수 없습니다")
        return queryService.commentsOf(post, identity)
    }
}
