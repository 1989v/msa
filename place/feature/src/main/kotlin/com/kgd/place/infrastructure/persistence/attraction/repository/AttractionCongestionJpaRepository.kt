package com.kgd.place.infrastructure.persistence.attraction.repository

import com.kgd.place.infrastructure.persistence.attraction.entity.AttractionCongestionJpaEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface AttractionCongestionJpaRepository : JpaRepository<AttractionCongestionJpaEntity, Long> {

    /**
     * 그 시군구의 행을 지운다. 벌크 DELETE 라 바로 실행된다 — `deleteAll(엔티티)` 는 flush 때 INSERT 를 먼저 보내
     * 같은 (시군구, 이름) 유니크 키에 걸린다(웰니스와 같은 이유).
     */
    @Modifying
    @Query("DELETE FROM AttractionCongestionJpaEntity c WHERE c.signguCd = :signguCd")
    fun deleteBySignguCd(@Param("signguCd") signguCd: String): Int

    fun findByAttractionIdInAndMatchMethodIn(attractionIds: Collection<Long>, matchMethods: Collection<String>): List<AttractionCongestionJpaEntity>
}
