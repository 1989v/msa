package com.kgd.promotion.infrastructure.persistence.coupon.adapter

import com.kgd.common.exception.NotFoundException
import com.kgd.promotion.application.coupon.port.CouponDefinitionPage
import com.kgd.promotion.application.coupon.port.CouponDefinitionRepositoryPort
import com.kgd.promotion.application.coupon.port.UserCouponRepositoryPort
import com.kgd.promotion.domain.coupon.exception.CouponAlreadyIssuedException
import com.kgd.promotion.domain.coupon.model.CouponDefinition
import com.kgd.promotion.domain.coupon.model.UserCoupon
import com.kgd.promotion.infrastructure.persistence.coupon.entity.CouponDefinitionJpaEntity
import com.kgd.promotion.infrastructure.persistence.coupon.entity.UserCouponJpaEntity
import com.kgd.promotion.infrastructure.persistence.coupon.repository.CouponDefinitionJpaRepository
import com.kgd.promotion.infrastructure.persistence.coupon.repository.UserCouponJpaRepository
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Component

@Component
class CouponDefinitionRepositoryAdapter(
    private val jpaRepository: CouponDefinitionJpaRepository,
) : CouponDefinitionRepositoryPort {

    override fun create(definition: CouponDefinition): CouponDefinition =
        jpaRepository.saveAndFlush(CouponDefinitionJpaEntity.newFrom(definition)).toDomain()

    override fun findById(id: Long): CouponDefinition? = jpaRepository.findById(id).orElse(null)?.toDomain()

    override fun findAllByIdIn(ids: Collection<Long>): List<CouponDefinition> =
        if (ids.isEmpty()) emptyList() else jpaRepository.findAllById(ids).map { it.toDomain() }

    override fun findPage(page: Int, size: Int): CouponDefinitionPage =
        jpaRepository.findAll(PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id")))
            .let { p -> CouponDefinitionPage(p.content.map { it.toDomain() }, p.totalElements) }

    override fun tryIncrementIssued(id: Long): Boolean = jpaRepository.incrementIssuedIfBelowLimit(id) == 1
}

@Component
class UserCouponRepositoryAdapter(
    private val jpaRepository: UserCouponJpaRepository,
) : UserCouponRepositoryPort {

    /** 유니크(회원·정의) 위반은 도메인 예외로 바꾼다 — 호출 트랜잭션은 그 예외로 되돌아간다(발행 수 증가 포함) */
    override fun create(coupon: UserCoupon): UserCoupon = try {
        jpaRepository.saveAndFlush(UserCouponJpaEntity.newFrom(coupon)).toDomain()
    } catch (e: DataIntegrityViolationException) {
        throw CouponAlreadyIssuedException(coupon.couponDefinitionId)
    }

    override fun save(coupon: UserCoupon): UserCoupon {
        val id = requireNotNull(coupon.id) { "새 쿠폰은 create 로 저장한다" }
        val entity = jpaRepository.findById(id).orElseThrow { NotFoundException("UserCoupon", id) }
        entity.syncFrom(coupon)
        return jpaRepository.save(entity).toDomain()
    }

    override fun findById(id: Long): UserCoupon? = jpaRepository.findById(id).orElse(null)?.toDomain()

    override fun existsByMemberIdAndDefinitionId(memberId: String, couponDefinitionId: Long): Boolean =
        jpaRepository.existsByMemberIdAndCouponDefinitionId(memberId, couponDefinitionId)

    override fun findAllByMemberId(memberId: String): List<UserCoupon> =
        jpaRepository.findAllByMemberIdOrderByIdDesc(memberId).map { it.toDomain() }
}
