package com.kgd.ads.infrastructure.persistence.creative.adapter

import com.kgd.ads.application.creative.port.CreativePort
import com.kgd.ads.domain.creative.model.Creative
import com.kgd.ads.domain.creative.model.CreativeStatus
import com.kgd.ads.infrastructure.persistence.advertiser.repository.AdvertiserJpaRepository
import com.kgd.ads.infrastructure.persistence.creative.entity.CreativeJpaEntity
import com.kgd.ads.infrastructure.persistence.creative.repository.CreativeJpaRepository
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Component
import java.time.LocalDateTime

@Component
class CreativeRepositoryAdapter(
    private val creativeRepository: CreativeJpaRepository,
    private val advertiserRepository: AdvertiserJpaRepository,
) : CreativePort {

    override fun findById(id: Long): Creative? = creativeRepository.findByIdOrNull(id)?.let { toDomain(listOf(it)).single() }

    override fun findByIdAndAdvertiser(id: Long, advertiserId: Long): Creative? =
        creativeRepository.findByIdAndAdvertiserId(id, advertiserId)?.let { toDomain(listOf(it)).single() }

    override fun findAllByCampaign(campaignId: Long): List<Creative> = toDomain(creativeRepository.findAllByCampaignId(campaignId))

    override fun findAllByStatus(status: CreativeStatus): List<Creative> = toDomain(creativeRepository.findAllByStatus(status))

    override fun save(creative: Creative, now: LocalDateTime): Creative {
        val createdAt = creative.id?.let { creativeRepository.findByIdOrNull(it)?.createdAt } ?: now
        return toDomain(listOf(creativeRepository.save(CreativeJpaEntity.of(creative, createdAt, now)))).single()
    }

    private fun toDomain(rows: List<CreativeJpaEntity>): List<Creative> {
        if (rows.isEmpty()) return emptyList()
        val kinds = advertiserRepository.findAllById(rows.map { it.advertiserId }.toSet()).associate { requireNotNull(it.id) to it.kind }
        return rows.map { it.toDomain(requireNotNull(kinds[it.advertiserId]) { "광고주 없음: ${it.advertiserId}" }) }
    }
}
