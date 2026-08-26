package com.kgd.deal.infrastructure.persistence.adapter

import com.kgd.deal.application.offer.port.DealOfferRepositoryPort
import com.kgd.deal.domain.model.LinkStatus
import com.kgd.deal.domain.model.Offer
import com.kgd.deal.infrastructure.persistence.entity.DealOfferJpaEntity
import com.kgd.deal.infrastructure.persistence.repository.DealOfferJpaRepository
import org.springframework.stereotype.Component
import java.time.LocalDateTime

@Component
class DealOfferRepositoryAdapter(
    private val jpaRepository: DealOfferJpaRepository,
) : DealOfferRepositoryPort {

    override fun findAll(): List<Offer> = jpaRepository.findAll().map { it.toDomain() }

    override fun findById(id: Long): Offer? = jpaRepository.findById(id).orElse(null)?.toDomain()

    override fun findBySlug(slug: String): Offer? = jpaRepository.findBySlug(slug)?.toDomain()

    override fun existsBySlug(slug: String): Boolean = jpaRepository.existsBySlug(slug)

    override fun existsByCategoryId(categoryId: Long): Boolean = jpaRepository.existsByCategoryId(categoryId)

    override fun countByCategoryId(categoryId: Long): Long = jpaRepository.countByCategoryId(categoryId)

    override fun findVisibleByCategory(categoryId: Long, now: LocalDateTime): List<Offer> =
        jpaRepository.findVisibleByCategory(categoryId, now).map { it.toDomain() }

    override fun findAllVisible(now: LocalDateTime): List<Offer> = jpaRepository.findAllVisible(now).map { it.toDomain() }

    override fun searchVisible(pattern: String, now: LocalDateTime): List<Offer> =
        jpaRepository.searchVisible(pattern, now).map { it.toDomain() }

    override fun findExpiringSoon(now: LocalDateTime, threshold: LocalDateTime): List<Offer> =
        jpaRepository.findExpiringSoon(now, threshold).map { it.toDomain() }

    override fun findStale(threshold: LocalDateTime): List<Offer> = jpaRepository.findStale(threshold).map { it.toDomain() }

    override fun findAllByLinkStatus(linkStatus: LinkStatus): List<Offer> =
        jpaRepository.findAllByLinkStatusOrderByLinkCheckedAtAsc(linkStatus).map { it.toDomain() }

    /** 편집 값만 동기화한다 — 관측값(클릭 수·링크 상태)은 엔티티의 [DealOfferJpaEntity.update] 가 건드리지 않는다 */
    override fun save(offer: Offer): Offer {
        val managed = offer.id?.let { jpaRepository.findById(it).orElse(null) }
        if (managed != null) {
            managed.update(offer)
            return managed.toDomain()
        }
        return jpaRepository.save(DealOfferJpaEntity.fromDomain(offer)).toDomain()
    }

    override fun deleteById(id: Long) = jpaRepository.deleteById(id)

    override fun increaseClickCount(id: Long) {
        jpaRepository.increaseClickCount(id)
    }
}
