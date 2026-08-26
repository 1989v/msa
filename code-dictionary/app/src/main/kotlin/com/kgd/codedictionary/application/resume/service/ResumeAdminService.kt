package com.kgd.codedictionary.application.resume.service

import com.kgd.codedictionary.application.resume.dto.ResumeDocumentSummaryDto
import com.kgd.codedictionary.application.resume.dto.ResumeDocumentUpsertRequest
import com.kgd.codedictionary.application.resume.dto.ResumeShareLinkCreateRequest
import com.kgd.codedictionary.application.resume.dto.ResumeShareLinkDto
import com.kgd.codedictionary.application.resume.dto.ResumeVisitDto
import com.kgd.codedictionary.application.resume.port.ResumeAccessLogRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeDocumentRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeSettingRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeShareLinkRepositoryPort
import com.kgd.codedictionary.application.resume.usecase.ManageResumeUseCase
import com.kgd.codedictionary.domain.resume.model.ResumeDocument
import com.kgd.codedictionary.domain.resume.model.ResumeDocumentKind
import com.kgd.codedictionary.domain.resume.model.ResumeShareLink
import com.kgd.codedictionary.domain.resume.model.ResumeVisibility
import java.security.SecureRandom
import java.util.Base64
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class ResumeAdminService(
    private val documentRepository: ResumeDocumentRepositoryPort,
    private val shareLinkRepository: ResumeShareLinkRepositoryPort,
    private val accessLogRepository: ResumeAccessLogRepositoryPort,
    private val settingRepository: ResumeSettingRepositoryPort,
) : ManageResumeUseCase {
    private val random = SecureRandom()
    private val encoder: Base64.Encoder = Base64.getUrlEncoder().withoutPadding()

    @Transactional(readOnly = true)
    override fun listDocuments(): List<ResumeDocumentSummaryDto> =
        documentRepository.findAll()
            .sortedWith(compareBy({ it.kind != ResumeDocumentKind.MAIN }, { it.orderNo }))
            .map(ResumeDocumentSummaryDto::from)

    @Transactional(readOnly = true)
    override fun getDocument(slug: String): ResumeDocument? = documentRepository.findBySlug(slug)

    @Transactional
    override fun upsertDocument(request: ResumeDocumentUpsertRequest): ResumeDocumentSummaryDto {
        val existing = documentRepository.findBySlug(request.slug.trim().lowercase())
        val document = ResumeDocument.restore(
            id = existing?.id,
            slug = request.slug,
            title = request.title,
            bodyMarkdown = request.bodyMarkdown,
            kind = ResumeDocumentKind.parse(request.kind),
            orderNo = request.orderNo,
            published = request.published,
            createdAt = existing?.createdAt,
            updatedAt = existing?.updatedAt,
        )
        return ResumeDocumentSummaryDto.from(documentRepository.save(document))
    }

    @Transactional
    override fun deleteDocument(slug: String) = documentRepository.deleteBySlug(slug.trim().lowercase())

    @Transactional(readOnly = true)
    override fun listShareLinks(): List<ResumeShareLinkDto> {
        val stats = accessLogRepository.countByShareLink()
        return shareLinkRepository.findAll()
            .sortedByDescending { it.createdAt }
            .map { link ->
                val stat = link.id?.let { stats[it] }
                ResumeShareLinkDto.from(
                    link = link,
                    visitCount = stat?.visitCount ?: 0L,
                    firstVisitedAt = stat?.firstVisitedAt,
                    lastVisitedAt = stat?.lastVisitedAt,
                )
            }
    }

    @Transactional
    override fun createShareLink(request: ResumeShareLinkCreateRequest): ResumeShareLinkDto {
        val link = shareLinkRepository.save(
            ResumeShareLink.create(token = generateToken(), label = request.label, note = request.note),
        )
        return ResumeShareLinkDto.from(link, visitCount = 0L, firstVisitedAt = null, lastVisitedAt = null)
    }

    @Transactional
    override fun revokeShareLink(id: Long) = shareLinkRepository.revoke(id)

    @Transactional(readOnly = true)
    override fun currentVisibility(): ResumeVisibility = settingRepository.currentVisibility()

    @Transactional
    override fun updateVisibility(visibility: ResumeVisibility) = settingRepository.updateVisibility(visibility)

    @Transactional(readOnly = true)
    override fun recentVisits(limit: Int): List<ResumeVisitDto> =
        accessLogRepository.findRecent(limit).map {
            ResumeVisitDto(label = it.label, slug = it.slug, visitedAt = it.visitedAt)
        }

    /** URL 에 그대로 붙는 값이라 URL-safe Base64 로 만든다. */
    private fun generateToken(): String {
        val bytes = ByteArray(24)
        random.nextBytes(bytes)
        return encoder.encodeToString(bytes).take(ResumeShareLink.TOKEN_LENGTH)
    }
}
