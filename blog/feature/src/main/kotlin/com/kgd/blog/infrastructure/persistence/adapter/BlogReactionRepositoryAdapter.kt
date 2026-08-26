package com.kgd.blog.infrastructure.persistence.adapter

import com.kgd.blog.application.interaction.port.BlogReactionRepositoryPort
import com.kgd.blog.domain.model.VoterKey
import com.kgd.blog.infrastructure.persistence.entity.BlogPostLikeJpaEntity
import com.kgd.blog.infrastructure.persistence.entity.BlogPostRatingJpaEntity
import com.kgd.blog.infrastructure.persistence.repository.BlogPostLikeJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogPostRatingJpaRepository
import org.springframework.stereotype.Component

@Component
class BlogReactionRepositoryAdapter(
    private val likeRepository: BlogPostLikeJpaRepository,
    private val ratingRepository: BlogPostRatingJpaRepository,
) : BlogReactionRepositoryPort {

    override fun hasLike(postId: Long, voter: VoterKey): Boolean =
        likeRepository.findByPostIdAndVoterTypeAndVoterKey(postId, voter.voterType, voter.key) != null

    override fun addLike(postId: Long, voter: VoterKey) {
        likeRepository.save(BlogPostLikeJpaEntity(postId, voter))
    }

    override fun removeLike(postId: Long, voter: VoterKey) {
        likeRepository.findByPostIdAndVoterTypeAndVoterKey(postId, voter.voterType, voter.key)?.let { likeRepository.delete(it) }
    }

    override fun findRating(postId: Long, voter: VoterKey): Int? =
        ratingRepository.findByPostIdAndVoterTypeAndVoterKey(postId, voter.voterType, voter.key)?.score

    override fun saveRating(postId: Long, voter: VoterKey, score: Int) {
        val existing = ratingRepository.findByPostIdAndVoterTypeAndVoterKey(postId, voter.voterType, voter.key)
        if (existing == null) {
            ratingRepository.save(BlogPostRatingJpaEntity(postId, voter, score))
        } else {
            existing.rescore(score)
        }
    }

    override fun removeRating(postId: Long, voter: VoterKey) {
        ratingRepository.findByPostIdAndVoterTypeAndVoterKey(postId, voter.voterType, voter.key)?.let { ratingRepository.delete(it) }
    }

    override fun deleteByPostId(postId: Long) {
        likeRepository.deleteByPostId(postId)
        ratingRepository.deleteByPostId(postId)
    }
}
