package com.kgd.place.infrastructure.persistence.attraction.adapter

import com.kgd.place.application.attraction.port.AttractionLinkRepositoryPort
import com.kgd.place.domain.attraction.model.AttractionLink
import com.kgd.place.domain.attraction.model.AttractionLinkRequest
import com.kgd.place.domain.attraction.model.AttractionLinkSource
import com.kgd.place.infrastructure.persistence.attraction.entity.AttractionLinkJpaEntity
import com.kgd.place.infrastructure.persistence.attraction.entity.AttractionLinkRequestJpaEntity
import com.kgd.place.infrastructure.persistence.attraction.repository.AttractionLinkJpaRepository
import com.kgd.place.infrastructure.persistence.attraction.repository.AttractionLinkRequestJpaRepository
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

@Component
class AttractionLinkRepositoryAdapter(
    private val linkRepository: AttractionLinkJpaRepository,
    private val requestRepository: AttractionLinkRequestJpaRepository,
) : AttractionLinkRepositoryPort {

    override fun findLinks(attractionId: Long): List<AttractionLink> =
        linkRepository.findByAttractionIdOrderBySourceAscSortOrderAsc(attractionId).map { it.toDomain() }

    /**
     * 부분 갱신이 아니라 전체 교체다. 원천(검색 결과)에서 빠진 영상이 남아 있으면 삭제된 영상으로
     * 링크가 죽고, 그 상태를 알아챌 경로가 없다.
     */
    @Transactional
    override fun replaceLinks(
        attractionId: Long,
        source: AttractionLinkSource,
        links: List<AttractionLink>,
    ) {
        linkRepository.deleteByAttractionIdAndSource(attractionId, source)
        linkRepository.flush()
        if (links.isNotEmpty()) {
            linkRepository.saveAll(links.map { AttractionLinkJpaEntity.fromDomain(it) })
        }
    }

    override fun findRequest(attractionId: Long, source: AttractionLinkSource): AttractionLinkRequest? =
        requestRepository.findByAttractionIdAndSource(attractionId, source)?.toDomain()

    @Transactional
    override fun saveRequest(request: AttractionLinkRequest): AttractionLinkRequest =
        requestRepository.save(AttractionLinkRequestJpaEntity.fromDomain(request)).toDomain()

    override fun findDueRequests(
        source: AttractionLinkSource,
        now: LocalDateTime,
        limit: Int,
    ): List<AttractionLinkRequest> =
        requestRepository.findDue(source, now, PageRequest.of(0, limit)).map { it.toDomain() }

    override fun countAttemptsSince(source: AttractionLinkSource, since: LocalDateTime): Long =
        requestRepository.countBySourceAndLastAttemptAtGreaterThanEqual(source, since)
}
