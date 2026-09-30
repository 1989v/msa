package com.kgd.place.infrastructure.persistence.attraction.repository

import com.kgd.place.infrastructure.persistence.attraction.entity.AttractionSimilarJpaEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface AttractionSimilarJpaRepository : JpaRepository<AttractionSimilarJpaEntity, Long> {

    fun findByModelRefAndAttractionIdInOrderByAttractionIdAscRankNoAsc(
        modelRef: String,
        attractionIds: List<Long>,
    ): List<AttractionSimilarJpaEntity>

    /**
     * 벌크 DELETE 는 바로 실행된다. `deleteAll(엔티티)` 로 지우면 Hibernate 가 flush 때 INSERT 를 DELETE 보다
     * 먼저 보내 같은 (문서, 스탬프, 순위) 유니크 키에 걸린다.
     */
    @Modifying
    @Query("DELETE FROM AttractionSimilarJpaEntity s WHERE s.modelRef = :modelRef AND s.attractionId IN :ids")
    fun deleteByModelRefAndAttractionIds(@Param("modelRef") modelRef: String, @Param("ids") ids: Collection<Long>): Int

    @Query(value = "SELECT id FROM attractions WHERE id IN (:ids)", nativeQuery = true)
    fun findExistingAttractionIds(@Param("ids") ids: Collection<Long>): List<Long>
}
