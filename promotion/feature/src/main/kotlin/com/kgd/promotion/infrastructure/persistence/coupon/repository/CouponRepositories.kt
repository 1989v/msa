package com.kgd.promotion.infrastructure.persistence.coupon.repository

import com.kgd.promotion.infrastructure.persistence.coupon.entity.CouponDefinitionJpaEntity
import com.kgd.promotion.infrastructure.persistence.coupon.entity.UserCouponJpaEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface CouponDefinitionJpaRepository : JpaRepository<CouponDefinitionJpaEntity, Long> {
    /** 상한 아래일 때만 1 올린다 — 바꾼 행 수(0 이면 소진) */
    @Modifying
    @Query(
        "UPDATE CouponDefinitionJpaEntity c SET c.issuedCount = c.issuedCount + 1 " +
            "WHERE c.id = :id AND c.issuedCount < c.issueLimit",
    )
    fun incrementIssuedIfBelowLimit(@Param("id") id: Long): Int
}

interface UserCouponJpaRepository : JpaRepository<UserCouponJpaEntity, Long> {
    fun existsByMemberIdAndCouponDefinitionId(memberId: String, couponDefinitionId: Long): Boolean
    fun findAllByMemberIdOrderByIdDesc(memberId: String): List<UserCouponJpaEntity>
}
