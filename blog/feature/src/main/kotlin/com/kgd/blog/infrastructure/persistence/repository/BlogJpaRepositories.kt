package com.kgd.blog.infrastructure.persistence.repository

import com.kgd.blog.domain.model.CommentStatus
import com.kgd.blog.domain.model.PostStatus
import com.kgd.blog.domain.model.ProfileRole
import com.kgd.blog.domain.model.ProfileStatus
import com.kgd.blog.domain.model.VoterType
import com.kgd.blog.infrastructure.persistence.entity.BlogCategoryJpaEntity
import com.kgd.blog.infrastructure.persistence.entity.BlogCommentJpaEntity
import com.kgd.blog.infrastructure.persistence.entity.BlogPostJpaEntity
import com.kgd.blog.infrastructure.persistence.entity.BlogPostLikeJpaEntity
import com.kgd.blog.infrastructure.persistence.entity.BlogPostRatingJpaEntity
import com.kgd.blog.infrastructure.persistence.entity.BlogPostViewJpaEntity
import com.kgd.blog.infrastructure.persistence.entity.BlogProfileJpaEntity
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.LocalDate

interface BlogProfileJpaRepository : JpaRepository<BlogProfileJpaEntity, Long> {
    fun findByMemberId(memberId: Long): BlogProfileJpaEntity?
    fun findByHandle(handle: String): BlogProfileJpaEntity?
    fun existsByHandle(handle: String): Boolean
    fun findAllByRoleOrderByIdDesc(role: ProfileRole): List<BlogProfileJpaEntity>
    fun findAllByRoleAndStatusOrderByIdDesc(role: ProfileRole, status: ProfileStatus): List<BlogProfileJpaEntity>
    fun findAllByIdIn(ids: Collection<Long>): List<BlogProfileJpaEntity>
}

interface BlogCategoryJpaRepository : JpaRepository<BlogCategoryJpaEntity, Long> {

    fun findAllByOrderByPathAsc(): List<BlogCategoryJpaEntity>
    fun findByPath(path: String): BlogCategoryJpaEntity?
    fun existsByParentIdAndSlug(parentId: Long?, slug: String): Boolean
    fun countByParentId(parentId: Long): Long

    /**
     * 자기 자신 + 모든 하위. 물질화 경로를 둔 이유가 이 한 줄이다 —
     * 인접 리스트만으로는 3단을 긁는 데 재귀 CTE 나 왕복 3번이 필요하다.
     */
    @Query(
        """
        SELECT c FROM BlogCategoryJpaEntity c
        WHERE c.path = :path OR c.path LIKE CONCAT(:path, '/%')
        ORDER BY c.path ASC
        """,
    )
    fun findSubtree(@Param("path") path: String): List<BlogCategoryJpaEntity>
}

interface BlogPostJpaRepository : JpaRepository<BlogPostJpaEntity, Long> {

    fun findBySlug(slug: String): BlogPostJpaEntity?
    fun existsBySlug(slug: String): Boolean
    fun countByCategoryId(categoryId: Long): Long
    fun findAllByAuthorProfileIdOrderByIdDesc(authorProfileId: Long, pageable: Pageable): Page<BlogPostJpaEntity>
    fun findAllByAuthorProfileIdAndStatusOrderByIdDesc(
        authorProfileId: Long,
        status: PostStatus,
        pageable: Pageable,
    ): Page<BlogPostJpaEntity>

    /**
     * 공개 목록 — 공개 판정을 **쿼리에서** 끝낸다. 서비스나 화면에서 거르면 페이지네이션과
     * 총 개수가 어긋나고, 한 곳이라도 빠뜨리면 초안이 새어 나간다.
     *
     * 필터 조합마다 메서드를 따로 두는 이유는 `:ids IS NULL OR x IN :ids` 형태가 컬렉션
     * 파라미터에 null 을 바인딩하는 순간 구현체마다 다르게 깨지기 때문이다. 이름이 길어지는
     * 대신 무엇을 거르는지가 호출부에서 그대로 읽힌다.
     */
    fun findAllByStatusOrderByPublishedAtDescIdDesc(
        status: PostStatus,
        pageable: Pageable,
    ): Page<BlogPostJpaEntity>

    fun findAllByStatusAndCategoryIdInOrderByPublishedAtDescIdDesc(
        status: PostStatus,
        categoryIds: Collection<Long>,
        pageable: Pageable,
    ): Page<BlogPostJpaEntity>

    fun findAllByStatusAndAuthorProfileIdOrderByPublishedAtDescIdDesc(
        status: PostStatus,
        authorProfileId: Long,
        pageable: Pageable,
    ): Page<BlogPostJpaEntity>

    fun findAllByStatusAndCategoryIdInAndAuthorProfileIdOrderByPublishedAtDescIdDesc(
        status: PostStatus,
        categoryIds: Collection<Long>,
        authorProfileId: Long,
        pageable: Pageable,
    ): Page<BlogPostJpaEntity>

    /** 사이트맵·프리렌더용 — 페이지네이션 없이 발행글 전체 (색인 대상만) */
    @Query(
        """
        SELECT p FROM BlogPostJpaEntity p
        WHERE p.status = com.kgd.blog.domain.model.PostStatus.PUBLISHED
        ORDER BY p.publishedAt DESC, p.id DESC
        """,
    )
    fun findAllPublished(): List<BlogPostJpaEntity>

    /**
     * 비정규화 카운터는 전부 UPDATE 한 방으로 움직인다. 엔티티를 읽어 더하면 동시 요청이
     * 서로를 덮어쓴다 — 정확한 값은 각자의 원장 테이블이 갖고 있고 이 컬럼은 표시·정렬용이다.
     */
    // flush/clear 를 켜는 이유: 이 UPDATE 는 영속성 컨텍스트를 건너뛴다. 끄면 같은 트랜잭션에서
    // 방금 올린 카운터를 다시 읽었을 때 1차 캐시의 옛 엔티티가 나와, 응답만 옛 값이 되는
    // 재현 어려운 버그가 된다.
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE BlogPostJpaEntity p SET p.viewCount = p.viewCount + 1 WHERE p.id = :id")
    fun increaseViewCount(@Param("id") id: Long): Int

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE BlogPostJpaEntity p SET p.likeCount = p.likeCount + :delta WHERE p.id = :id")
    fun addLikeCount(@Param("id") id: Long, @Param("delta") delta: Long): Int

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE BlogPostJpaEntity p SET p.commentCount = p.commentCount + :delta WHERE p.id = :id")
    fun addCommentCount(@Param("id") id: Long, @Param("delta") delta: Long): Int

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
        """
        UPDATE BlogPostJpaEntity p
        SET p.ratingSum = p.ratingSum + :sumDelta, p.ratingCount = p.ratingCount + :countDelta
        WHERE p.id = :id
        """,
    )
    fun addRating(
        @Param("id") id: Long,
        @Param("sumDelta") sumDelta: Long,
        @Param("countDelta") countDelta: Long,
    ): Int
}

interface BlogPostViewJpaRepository : JpaRepository<BlogPostViewJpaEntity, Long> {

    /**
     * 하루 1회 집계의 원자적 판정. 반환값 1 이면 처음 본 것이고 0 이면 이미 센 것이다.
     *
     * `exists` 후 `save` 는 동시 요청에서 둘 다 통과해 유니크 위반 예외로 떨어진다 —
     * 조회 하나가 예외를 던지면 글 자체가 500 이 된다. MySQL 전용 구문이지만 플랫폼의
     * DB 는 MySQL 하나다.
     */
    @Modifying
    @Query(
        value = """
            INSERT IGNORE INTO blog_post_view (post_id, visitor_key, view_date)
            VALUES (:postId, :visitorKey, :viewDate)
        """,
        nativeQuery = true,
    )
    fun insertIfAbsent(
        @Param("postId") postId: Long,
        @Param("visitorKey") visitorKey: String,
        @Param("viewDate") viewDate: LocalDate,
    ): Int

    @Query(
        """
        SELECT v.viewDate AS day, COUNT(v) AS cnt
        FROM BlogPostViewJpaEntity v
        WHERE v.postId = :postId AND v.viewDate >= :from AND v.viewDate <= :to
        GROUP BY v.viewDate
        ORDER BY v.viewDate ASC
        """,
    )
    fun countDailyByPost(
        @Param("postId") postId: Long,
        @Param("from") from: LocalDate,
        @Param("to") to: LocalDate,
    ): List<Array<Any>>

    /** 보존기간 초과분 정리 */
    @Modifying
    @Query("DELETE FROM BlogPostViewJpaEntity v WHERE v.viewDate < :threshold")
    fun deleteOlderThan(@Param("threshold") threshold: LocalDate): Int
}

interface BlogPostLikeJpaRepository : JpaRepository<BlogPostLikeJpaEntity, Long> {
    fun findByPostIdAndVoterTypeAndVoterKey(
        postId: Long,
        voterType: VoterType,
        voterKey: String,
    ): BlogPostLikeJpaEntity?

    fun deleteByPostId(postId: Long)
}

interface BlogPostRatingJpaRepository : JpaRepository<BlogPostRatingJpaEntity, Long> {
    fun findByPostIdAndVoterTypeAndVoterKey(
        postId: Long,
        voterType: VoterType,
        voterKey: String,
    ): BlogPostRatingJpaEntity?

    fun deleteByPostId(postId: Long)
}

interface BlogCommentJpaRepository : JpaRepository<BlogCommentJpaEntity, Long> {

    /** 삭제된 댓글도 함께 돌려준다 — 대댓글의 부모 자리를 비우면 스레드가 무너진다 */
    fun findAllByPostIdOrderByIdAsc(postId: Long): List<BlogCommentJpaEntity>

    fun findAllByStatusOrderByIdDesc(status: CommentStatus, pageable: Pageable): Page<BlogCommentJpaEntity>
    fun findAllByOrderByIdDesc(pageable: Pageable): Page<BlogCommentJpaEntity>
    fun countByPostIdAndStatus(postId: Long, status: CommentStatus): Long
    fun deleteByPostId(postId: Long)
}
