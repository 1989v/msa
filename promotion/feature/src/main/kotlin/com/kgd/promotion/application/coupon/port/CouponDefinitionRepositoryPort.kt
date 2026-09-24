package com.kgd.promotion.application.coupon.port

import com.kgd.promotion.domain.coupon.model.CouponDefinition

interface CouponDefinitionRepositoryPort {
    fun create(definition: CouponDefinition): CouponDefinition
    fun findById(id: Long): CouponDefinition?
    fun findAllByIdIn(ids: Collection<Long>): List<CouponDefinition>
    fun findPage(page: Int, size: Int): CouponDefinitionPage

    /**
     * 발행 수를 1 올린다 — `issued_count < issue_limit` 일 때만(조건부 UPDATE). 상한에 닿았으면 false.
     * 동시 발행이 몰려도 행 잠금이 UPDATE 를 줄 세워 상한을 넘지 않는다.
     */
    fun tryIncrementIssued(id: Long): Boolean
}

data class CouponDefinitionPage(val items: List<CouponDefinition>, val total: Long)
