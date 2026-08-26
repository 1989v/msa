package com.kgd.blog.application.interaction.service

import com.kgd.blog.application.interaction.dto.BlogReaction
import com.kgd.blog.application.interaction.port.BlogReactionRepositoryPort
import com.kgd.blog.application.interaction.usecase.ClearBlogRatingUseCase
import com.kgd.blog.application.interaction.usecase.RateBlogPostUseCase
import com.kgd.blog.application.interaction.usecase.ToggleBlogLikeUseCase
import com.kgd.blog.application.post.port.BlogPostRepositoryPort
import com.kgd.blog.application.post.service.BlogQueryService
import com.kgd.blog.domain.model.VoterKey
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 좋아요·평점 (ADR-0072 §5).
 *
 * 둘 다 **익명 허용**이다. 표의 주인은 로그인 회원이면 회원 id, 아니면 게이트웨이가 심은
 * 방문자 id — 원장의 유니크 제약이 1인 1표를 보장하고, 집계 컬럼은 그 파생값이다.
 *
 * 평점과 좋아요가 축이 겹친다는 것은 알고 있다. 화면에서 좋아요를 1차 액션, 평점을 보조로
 * 배치해 서로 경합하지 않게 한다 — 데이터 모델은 둘을 독립으로 둔다.
 */
@Service
@Transactional
class BlogReactionService(
    private val postRepository: BlogPostRepositoryPort,
    private val reactionRepository: BlogReactionRepositoryPort,
    private val queryService: BlogQueryService,
) : ToggleBlogLikeUseCase, RateBlogPostUseCase, ClearBlogRatingUseCase {

    override fun execute(command: ToggleBlogLikeUseCase.Command): BlogReaction {
        val post = queryService.publishedOrThrow(command.slug)
        val postId = post.id ?: 0
        val voter = command.identity.voterKey()
        val liked: Boolean
        if (!reactionRepository.hasLike(postId, voter)) {
            reactionRepository.addLike(postId, voter)
            postRepository.addLikeCount(postId, 1)
            liked = true
        } else {
            reactionRepository.removeLike(postId, voter)
            // 카운터가 음수로 내려가지 않게 원장이 있을 때만 뺀다
            postRepository.addLikeCount(postId, -1)
            liked = false
        }
        return reaction(postId, voter, likedOverride = liked)
    }

    override fun execute(command: RateBlogPostUseCase.Command): BlogReaction {
        val (slug, identity, score) = command
        if (score !in 1..5) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "평점은 1~5 여야 합니다")
        }
        val post = queryService.publishedOrThrow(slug)
        val postId = post.id ?: 0
        val voter = identity.voterKey()
        val existing = reactionRepository.findRating(postId, voter)
        reactionRepository.saveRating(postId, voter, score)
        if (existing == null) {
            postRepository.addRating(postId, score.toLong(), 1)
        } else {
            // 재평가는 기존 표를 고친다 — 새 행을 만들면 1인 1표가 깨진다
            postRepository.addRating(postId, (score - existing).toLong(), 0)
        }
        return reaction(postId, voter)
    }

    override fun execute(command: ClearBlogRatingUseCase.Command): BlogReaction {
        val post = queryService.publishedOrThrow(command.slug)
        val postId = post.id ?: 0
        val voter = command.identity.voterKey()
        reactionRepository.findRating(postId, voter)?.let { score ->
            reactionRepository.removeRating(postId, voter)
            postRepository.addRating(postId, -score.toLong(), -1)
        }
        return reaction(postId, voter)
    }

    private fun reaction(postId: Long, voter: VoterKey, likedOverride: Boolean? = null): BlogReaction {
        // 카운터 UPDATE 는 영속성 컨텍스트를 건너뛰므로 다시 읽어야 최신값이 나온다
        val fresh = postRepository.findById(postId)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "글을 찾을 수 없습니다")
        return BlogReaction(
            liked = likedOverride ?: reactionRepository.hasLike(postId, voter),
            likeCount = fresh.likeCount,
            ratingAverage = fresh.ratingAverage,
            ratingCount = fresh.ratingCount,
            myScore = reactionRepository.findRating(postId, voter),
        )
    }
}
