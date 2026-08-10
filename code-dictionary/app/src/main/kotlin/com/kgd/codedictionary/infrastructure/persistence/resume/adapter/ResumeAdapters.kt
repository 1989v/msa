package com.kgd.codedictionary.infrastructure.persistence.resume.adapter

import com.kgd.codedictionary.application.resume.port.ResumeAccessLogRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeDocumentRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeSettingRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeShareLinkRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeVisitRecord
import com.kgd.codedictionary.application.resume.port.ResumeVisitStats
import com.kgd.codedictionary.domain.resume.model.ResumeDocument
import com.kgd.codedictionary.domain.resume.model.ResumeShareLink
import com.kgd.codedictionary.domain.resume.model.ResumeVisibility
import com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeAccessLogJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeDocumentJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeSettingJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeShareLinkJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.resume.repository.ResumeAccessLogJpaRepository
import com.kgd.codedictionary.infrastructure.persistence.resume.repository.ResumeDocumentJpaRepository
import com.kgd.codedictionary.infrastructure.persistence.resume.repository.ResumeSettingJpaRepository
import com.kgd.codedictionary.infrastructure.persistence.resume.repository.ResumeShareLinkJpaRepository
import com.kgd.common.exception.NotFoundException
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Component
import java.time.LocalDateTime

@Component
class ResumeDocumentRepositoryAdapter(
    private val jpaRepository: ResumeDocumentJpaRepository,
) : ResumeDocumentRepositoryPort {

    override fun findAllPublished(): List<ResumeDocument> =
        jpaRepository.findAllByPublishedTrue().map(ResumeDocumentJpaEntity::toDomain)

    override fun findAll(): List<ResumeDocument> =
        jpaRepository.findAll().map(ResumeDocumentJpaEntity::toDomain)

    override fun findBySlug(slug: String): ResumeDocument? =
        jpaRepository.findBySlug(slug)?.toDomain()

    override fun save(document: ResumeDocument): ResumeDocument {
        val existing = jpaRepository.findBySlug(document.slug)
        return if (existing == null) {
            jpaRepository.save(ResumeDocumentJpaEntity.fromDomain(document)).toDomain()
        } else {
            existing.update(document)
            existing.toDomain()
        }
    }

    override fun deleteBySlug(slug: String) = jpaRepository.deleteBySlug(slug)
}

@Component
class ResumeShareLinkRepositoryAdapter(
    private val jpaRepository: ResumeShareLinkJpaRepository,
) : ResumeShareLinkRepositoryPort {

    override fun findByToken(token: String): ResumeShareLink? =
        jpaRepository.findByToken(token)?.toDomain()

    override fun findAll(): List<ResumeShareLink> =
        jpaRepository.findAll().map(ResumeShareLinkJpaEntity::toDomain)

    override fun save(link: ResumeShareLink): ResumeShareLink =
        jpaRepository.save(ResumeShareLinkJpaEntity.fromDomain(link)).toDomain()

    override fun revoke(id: Long) {
        val entity = jpaRepository.findById(id).orElseThrow { NotFoundException("ResumeShareLink", id) }
        entity.revoke()
    }
}

@Component
class ResumeAccessLogRepositoryAdapter(
    private val jpaRepository: ResumeAccessLogJpaRepository,
) : ResumeAccessLogRepositoryPort {

    override fun record(shareLinkId: Long?, slug: String) {
        jpaRepository.save(ResumeAccessLogJpaEntity(shareLinkId = shareLinkId, slug = slug))
    }

    override fun countByShareLink(): Map<Long, ResumeVisitStats> =
        jpaRepository.aggregateByShareLink().associate { row ->
            val linkId = (row[0] as Number).toLong()
            linkId to ResumeVisitStats(
                visitCount = (row[1] as Number).toLong(),
                firstVisitedAt = row[2] as? LocalDateTime,
                lastVisitedAt = row[3] as? LocalDateTime,
            )
        }

    override fun findRecent(limit: Int): List<ResumeVisitRecord> =
        jpaRepository.findRecentWithLabel(PageRequest.of(0, limit)).map { row ->
            ResumeVisitRecord(
                shareLinkId = (row[0] as? Number)?.toLong(),
                label = row[1] as? String,
                slug = row[2] as String,
                visitedAt = row[3] as LocalDateTime,
            )
        }
}

@Component
class ResumeSettingRepositoryAdapter(
    private val jpaRepository: ResumeSettingJpaRepository,
) : ResumeSettingRepositoryPort {

    override fun currentVisibility(): ResumeVisibility = setting().visibility

    override fun updateVisibility(visibility: ResumeVisibility) {
        setting().changeVisibility(visibility)
    }

    /**
     * 설정 행이 없으면 닫힌 상태로 만들어 둔다. 마이그레이션이 넣어 두지만,
     * 없을 때 기본값이 "공개"가 되는 일만은 없어야 한다.
     */
    private fun setting(): ResumeSettingJpaEntity =
        jpaRepository.findById(ResumeSettingJpaEntity.SINGLETON_ID).orElseGet {
            jpaRepository.save(ResumeSettingJpaEntity(visibility = ResumeVisibility.TOKEN_ONLY))
        }
}
