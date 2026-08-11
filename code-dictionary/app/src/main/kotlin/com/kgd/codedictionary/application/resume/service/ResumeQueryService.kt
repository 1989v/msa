package com.kgd.codedictionary.application.resume.service

import com.kgd.codedictionary.application.resume.dto.ResumeDocumentDto
import com.kgd.codedictionary.application.resume.dto.ResumeDocumentSummaryDto
import com.kgd.codedictionary.application.resume.dto.ResumeProfileDto
import com.kgd.codedictionary.application.resume.dto.ResumeStatusDto
import com.kgd.codedictionary.application.resume.port.ResumeAccessLogRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeDocumentRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeSettingRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeShareLinkRepositoryPort
import com.kgd.codedictionary.domain.resume.model.ResumeDocumentKind
import com.kgd.codedictionary.domain.resume.model.ResumeShareLink
import com.kgd.codedictionary.domain.resume.model.ResumeVisibility
import com.kgd.codedictionary.domain.resume.policy.ResumeAccessPolicy
import com.kgd.common.exception.NotFoundException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

data class ResumeOverview(
    val main: ResumeDocumentDto?,
    val details: List<ResumeDocumentSummaryDto>,
    /** 경력·프로젝트·기술 스택 — 마크다운의 자리표시자를 채운다 */
    val profile: ResumeProfileDto,
)

/**
 * 공개 이력서 조회 (ADR-0064).
 *
 * 게이트를 통과하지 못하면 [NotFoundException] 으로 끝낸다 — 403 은 문서의 존재를 알려주므로
 * 포트폴리오 카드의 PRIVATE 처리와 같은 은닉 기준을 쓴다.
 */
@Service
class ResumeQueryService(
    private val documentRepository: ResumeDocumentRepositoryPort,
    private val shareLinkRepository: ResumeShareLinkRepositoryPort,
    private val accessLogRepository: ResumeAccessLogRepositoryPort,
    private val settingRepository: ResumeSettingRepositoryPort,
    private val profileService: ResumeProfileService,
) {

    @Transactional(readOnly = true)
    fun status(): ResumeStatusDto =
        ResumeStatusDto(publiclyVisible = settingRepository.currentVisibility() == ResumeVisibility.PUBLIC)

    @Transactional
    fun overview(token: String?): ResumeOverview {
        val link = authorize(token)
        val published = documentRepository.findAllPublished()
        val main = published.firstOrNull { it.kind == ResumeDocumentKind.MAIN }
        val details = published
            .filter { it.kind == ResumeDocumentKind.DETAIL }
            .sortedBy { it.orderNo }
            .map(ResumeDocumentSummaryDto::from)

        main?.let { accessLogRepository.record(link?.id, it.slug) }
        return ResumeOverview(
            main = main?.let(ResumeDocumentDto::from),
            details = details,
            profile = profileService.profile(),
        )
    }

    @Transactional
    fun document(slug: String, token: String?): ResumeDocumentDto {
        val link = authorize(token)
        val document = documentRepository.findBySlug(slug)
            ?.takeIf { it.published }
            ?: throw NotFoundException("ResumeDocument", slug)

        accessLogRepository.record(link?.id, document.slug)
        return ResumeDocumentDto.from(document)
    }

    /**
     * 게이트 통과 여부를 판정하고, 통과 시 열람에 쓰인 공유 링크를 돌려준다.
     * 공개 상태에서 토큰 없이 들어온 경우 null 을 돌려준다 (익명 열람).
     */
    private fun authorize(token: String?): ResumeShareLink? {
        val link = token?.trim()?.takeIf { it.isNotEmpty() }?.let { shareLinkRepository.findByToken(it) }
        if (!ResumeAccessPolicy.canRead(settingRepository.currentVisibility(), link)) {
            throw NotFoundException("Resume")
        }
        return link?.takeIf { it.isUsable() }
    }
}
