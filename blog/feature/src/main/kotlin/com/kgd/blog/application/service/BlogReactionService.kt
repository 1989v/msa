package com.kgd.blog.application.service

import com.kgd.blog.application.dto.BlogIdentity
import com.kgd.blog.application.dto.BlogReaction
import com.kgd.blog.domain.model.VoterKey
import com.kgd.blog.infrastructure.persistence.entity.BlogPostJpaEntity
import com.kgd.blog.infrastructure.persistence.entity.BlogPostLikeJpaEntity
import com.kgd.blog.infrastructure.persistence.entity.BlogPostRatingJpaEntity
import com.kgd.blog.infrastructure.persistence.repository.BlogPostJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogPostLikeJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogPostRatingJpaRepository
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
    private val postRepository: BlogPostJpaRepository,
    private val likeRepository: BlogPostLikeJpaRepository,
    private val ratingRepository: BlogPostRatingJpaRepository,
    private val queryService: BlogQueryService,
) {

    fun toggleLike(slug: String, identity: BlogIdentity): BlogReaction {
        val post = queryService.publishedOrThrow(slug)
        val postId = post.id ?: 0
        val voter = identity.voterKey()
        val existing = likeRepository.findByPostIdAndVoterTypeAndVoterKey(postId, voter.voterType, voter.key)
        val liked: Boolean
        if (existing == null) {
            likeRepository.save(BlogPostLikeJpaEntity(postId, voter))
            postRepository.addLikeCount(postId, 1)
            liked = true
        } else {
            likeRepository.delete(existing)
            // 카운터가 음수로 내려가지 않게 원장이 있을 때만 뺀다
            postRepository.addLikeCount(postId, -1)
            liked = false
        }
        return reaction(postId, voter, likedOverride = liked)
    }

    fun rate(slug: String, identity: BlogIdentity, score: Int): BlogReaction {
        if (score !in 1..5) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "평점은 1~5 여야 합니다")
        }
        val post = queryService.publishedOrThrow(slug)
        val postId = post.id ?: 0
        val voter = identity.voterKey()
        val existing = ratingRepository.findByPostIdAndVoterTypeAndVoterKey(postId, voter.voterType, voter.key)
        if (existing == null) {
            ratingRepository.save(BlogPostRatingJpaEntity(postId, voter, score))
            postRepository.addRating(postId, score.toLong(), 1)
        } else {
            // 재평가는 기존 표를 고친다 — 새 행을 만들면 1인 1표가 깨진다
            val delta = (score - existing.score).toLong()
            existing.rescore(score)
            postRepository.addRating(postId, delta, 0)
        }
        return reaction(postId, voter)
    }

    fun clearRating(slug: String, identity: BlogIdentity): BlogReaction {
        val post = queryService.publishedOrThrow(slug)
        val postId = post.id ?: 0
        val voter = identity.voterKey()
        ratingRepository.findByPostIdAndVoterTypeAndVoterKey(postId, voter.voterType, voter.key)?.let {
            ratingRepository.delete(it)
            postRepository.addRating(postId, -it.score.toLong(), -1)
        }
        return reaction(postId, voter)
    }

    private fun reaction(postId: Long, voter: VoterKey, likedOverride: Boolean? = null): BlogReaction {
        // 카운터 UPDATE 는 영속성 컨텍스트를 건너뛰므로 다시 읽어야 최신값이 나온다
        val fresh: BlogPostJpaEntity = postRepository.findById(postId).orElseThrow {
            BusinessException(ErrorCode.NOT_FOUND, "글을 찾을 수 없습니다")
        }
        return BlogReaction(
            liked = likedOverride
                ?: (likeRepository.findByPostIdAndVoterTypeAndVoterKey(postId, voter.voterType, voter.key) != null),
            likeCount = fresh.likeCount,
            ratingAverage = fresh.ratingAverage,
            ratingCount = fresh.ratingCount,
            myScore = ratingRepository.findByPostIdAndVoterTypeAndVoterKey(postId, voter.voterType, voter.key)?.score,
        )
    }
}
