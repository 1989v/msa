package com.kgd.seller.infrastructure.persistence.seller.adapter

import com.kgd.common.exception.NotFoundException
import com.kgd.seller.application.seller.port.SellerPage
import com.kgd.seller.application.seller.port.SellerRepositoryPort
import com.kgd.seller.domain.seller.exception.SellerAlreadyExistsException
import com.kgd.seller.domain.seller.model.Seller
import com.kgd.seller.domain.seller.model.SellerStatus
import com.kgd.seller.infrastructure.persistence.seller.entity.SellerJpaEntity
import com.kgd.seller.infrastructure.persistence.seller.repository.SellerJpaRepository
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Component
import java.time.Instant

@Component
class SellerRepositoryAdapter(
    private val jpaRepository: SellerJpaRepository,
) : SellerRepositoryPort {

    override fun create(seller: Seller): Seller = try {
        // 유니크 위반을 이 자리에서 잡으려면 커밋 전에 INSERT 가 나가야 한다
        jpaRepository.saveAndFlush(SellerJpaEntity.newFrom(seller)).toDomain()
    } catch (e: DataIntegrityViolationException) {
        throw SellerAlreadyExistsException(seller.memberId)
    }

    override fun save(seller: Seller): Seller {
        val id = requireNotNull(seller.id) { "새 신청은 create 로 저장한다" }
        val entity = jpaRepository.findById(id).orElseThrow { NotFoundException("Seller", id) }
        entity.syncFrom(seller)
        return jpaRepository.save(entity).toDomain()
    }

    override fun findById(id: Long): Seller? = jpaRepository.findById(id).orElse(null)?.toDomain()

    override fun findAllByMemberId(memberId: String): List<Seller> =
        jpaRepository.findAllByMemberIdOrderByIdAsc(memberId).map { it.toDomain() }

    override fun findPage(status: SellerStatus?, page: Int, size: Int): SellerPage {
        val pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id"))
        val result = if (status == null) jpaRepository.findAll(pageable) else jpaRepository.findAllByStatus(status, pageable)
        return SellerPage(result.content.map { it.toDomain() }, result.totalElements)
    }

    override fun findRejectedUnpurgedBefore(cutoff: Instant, limit: Int): List<Seller> =
        jpaRepository.findAllByStatusAndRejectedAtLessThanEqualAndPiiPurgedAtIsNullOrderByIdAsc(
            SellerStatus.REJECTED, cutoff, PageRequest.of(0, limit),
        ).map { it.toDomain() }
}
