package com.kgd.place.infrastructure.persistence.attraction.repository

import com.kgd.place.infrastructure.persistence.attraction.entity.AttractionEmbeddingJpaEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.LocalDateTime

interface AttractionEmbeddingJpaRepository : JpaRepository<AttractionEmbeddingJpaEntity, Long> {

    fun findByModelRefAndAttractionIdIn(modelRef: String, attractionIds: List<Long>): List<AttractionEmbeddingJpaEntity>

    fun countByModelRef(modelRef: String): Long

    /**
     * 다시 임베딩할 후보 — 벡터가 없거나 관광지가 그 뒤에 바뀐 것.
     *
     * `attractions.updated_at` 은 DB 가 관리하는 컬럼이라 엔티티에 없다. 바뀐 컬럼이 임베딩 텍스트와 무관할 수도 있어
     * 이건 **후보를 좁히는 신호**일 뿐이고, 실제 판정은 도구가 텍스트 해시로 한다(같으면 touch).
     */
    @Query(
        value = """
            SELECT a.id FROM attractions a
            LEFT JOIN attraction_embedding e ON e.attraction_id = a.id AND e.model_ref = :modelRef
            WHERE a.status = 'ACTIVE' AND (e.id IS NULL OR a.updated_at > e.embedded_at)
            ORDER BY a.id LIMIT :limit
        """,
        nativeQuery = true,
    )
    fun findPendingIds(@Param("modelRef") modelRef: String, @Param("limit") limit: Int): List<Long>

    @Query(
        value = """
            SELECT
              SUM(CASE WHEN e.id IS NULL THEN 1 ELSE 0 END),
              SUM(CASE WHEN e.id IS NOT NULL AND a.updated_at > e.embedded_at THEN 1 ELSE 0 END)
            FROM attractions a
            LEFT JOIN attraction_embedding e ON e.attraction_id = a.id AND e.model_ref = :modelRef
            WHERE a.status = 'ACTIVE'
        """,
        nativeQuery = true,
    )
    fun countPending(@Param("modelRef") modelRef: String): Array<Any>

    @Query("SELECT MAX(e.embeddedAt) FROM AttractionEmbeddingJpaEntity e WHERE e.modelRef = :modelRef")
    fun findLastEmbeddedAt(@Param("modelRef") modelRef: String): LocalDateTime?

    @Query(value = "SELECT COUNT(*) FROM attractions WHERE status = 'ACTIVE'", nativeQuery = true)
    fun countActiveAttractions(): Long

    @Query(value = "SELECT id FROM attractions WHERE id IN (:ids)", nativeQuery = true)
    fun findExistingIds(@Param("ids") ids: List<Long>): List<Long>

    @Modifying
    fun deleteByModelRef(modelRef: String): Int
}
