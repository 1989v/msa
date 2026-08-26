package com.kgd.blog.application.interaction.port

import com.kgd.blog.domain.model.VoterKey

/** 좋아요·평점 원장. 유니크 제약이 1인 1표를 보장하고 집계 컬럼은 그 파생값이다 */
interface BlogReactionRepositoryPort {
    fun hasLike(postId: Long, voter: VoterKey): Boolean
    fun addLike(postId: Long, voter: VoterKey)
    fun removeLike(postId: Long, voter: VoterKey)

    fun findRating(postId: Long, voter: VoterKey): Int?
    /** 있으면 고치고 없으면 만든다 — 새 행을 만들면 1인 1표가 깨진다 */
    fun saveRating(postId: Long, voter: VoterKey, score: Int)
    fun removeRating(postId: Long, voter: VoterKey)

    /** 글 삭제 시 좋아요·평점 원장 정리 */
    fun deleteByPostId(postId: Long)
}
