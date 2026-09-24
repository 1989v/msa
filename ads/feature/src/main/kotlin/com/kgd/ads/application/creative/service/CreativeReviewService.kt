package com.kgd.ads.application.creative.service

import com.kgd.ads.application.audit.dto.AdminAction
import com.kgd.ads.application.audit.port.AdminAuditPort
import com.kgd.ads.application.creative.dto.CreativeView
import com.kgd.ads.application.creative.port.CreativePort
import com.kgd.ads.application.creative.usecase.ReviewCreativeUseCase
import com.kgd.ads.domain.creative.model.Creative
import com.kgd.ads.domain.creative.model.CreativeRejectReason
import com.kgd.ads.domain.creative.model.CreativeStatus
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.LocalDateTime

@Service
class CreativeReviewService(
    private val creativePort: CreativePort,
    private val auditPort: AdminAuditPort,
    @Qualifier("adsClock") private val clock: Clock,
) : ReviewCreativeUseCase {

    private val log = KotlinLogging.logger {}

    /** 먼저 올라온 것부터. */
    override fun pending(): List<CreativeView> =
        creativePort.findAllByStatus(CreativeStatus.PENDING).sortedBy { it.id }.map(CreativeView::from)

    @Transactional("adsTransactionManager")
    override fun approve(actorMemberId: Long, creativeId: Long): CreativeView {
        val now = LocalDateTime.now(clock)
        val creative = find(creativeId)
        creative.approve(actorMemberId, now)
        auditPort.record(AdminAction(actorMemberId, "CREATIVE_APPROVE", TARGET, creativeId.toString(), null, now))
        log.info { "소재 승인: creativeId=$creativeId actor=$actorMemberId" }
        return CreativeView.from(creativePort.save(creative, now))
    }

    @Transactional("adsTransactionManager")
    override fun reject(actorMemberId: Long, creativeId: Long, reason: CreativeRejectReason): CreativeView {
        val now = LocalDateTime.now(clock)
        val creative = find(creativeId)
        creative.reject(reason, actorMemberId, now)
        auditPort.record(AdminAction(actorMemberId, "CREATIVE_REJECT", TARGET, creativeId.toString(), reason.name, now))
        log.info { "소재 반려: creativeId=$creativeId reason=$reason actor=$actorMemberId" }
        return CreativeView.from(creativePort.save(creative, now))
    }

    private fun find(id: Long): Creative = creativePort.findById(id) ?: throw BusinessException(ErrorCode.NOT_FOUND, "소재가 없습니다")

    private companion object {
        const val TARGET = "CREATIVE"
    }
}
