package com.kgd.place.infrastructure.persistence.attraction.repository

import com.kgd.place.infrastructure.persistence.attraction.entity.AttractionWellnessJpaEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface AttractionWellnessJpaRepository : JpaRepository<AttractionWellnessJpaEntity, Long> {

    /**
     * 그 언어의 태그를 지운다. 벌크 DELETE 라 바로 실행된다 — `deleteAll(엔티티)` 는 flush 때 INSERT 를 먼저 보내
     * 같은 attraction_id 에 걸린다(비슷한 곳과 같은 이유).
     */
    @Modifying
    @Query("DELETE FROM AttractionWellnessJpaEntity w WHERE w.lang = :lang")
    fun deleteByLang(@Param("lang") lang: String): Int

    @Query("SELECT w.attractionId FROM AttractionWellnessJpaEntity w WHERE w.lang = :lang")
    fun findAttractionIdsByLang(@Param("lang") lang: String): List<Long>
}
