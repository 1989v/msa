package com.kgd.ads.application.advertiser.service

import com.kgd.ads.application.advertiser.dto.AdvertiserAdminView
import com.kgd.ads.application.advertiser.port.AdvertiserPort
import com.kgd.ads.application.advertiser.usecase.ManageAdvertiserUseCase
import com.kgd.ads.application.audit.dto.AdminAction
import com.kgd.ads.application.audit.port.AdminAuditPort
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.LocalDateTime

@Service
class AdvertiserAdminService(
    private val advertiserPort: AdvertiserPort,
    private val auditPort: AdminAuditPort,
    @Qualifier("adsClock") private val clock: Clock,
) : ManageAdvertiserUseCase {

    private val log = KotlinLogging.logger {}

    override fun list(): List<AdvertiserAdminView> = advertiserPort.findAll().map(AdvertiserAdminView::from)

    @Transactional("adsTransactionManager")
    override fun suspend(command: ManageAdvertiserUseCase.Suspend): AdvertiserAdminView {
        val now = LocalDateTime.now(clock)
        val advertiser = find(command.advertiserId)
        advertiser.suspend(command.reason, command.actorMemberId, now)
        advertiserPort.updateStatus(advertiser, now)
        auditPort.record(AdminAction(command.actorMemberId, "ADVERTISER_SUSPEND", TARGET, command.advertiserId.toString(), advertiser.suspension?.reason, now))
        log.info { "광고주 정지: advertiserId=${command.advertiserId} actor=${command.actorMemberId}" }
        return AdvertiserAdminView.from(advertiser)
    }

    @Transactional("adsTransactionManager")
    override fun unsuspend(command: ManageAdvertiserUseCase.Unsuspend): AdvertiserAdminView {
        val now = LocalDateTime.now(clock)
        val advertiser = find(command.advertiserId)
        advertiser.unsuspend()
        advertiserPort.updateStatus(advertiser, now)
        auditPort.record(AdminAction(command.actorMemberId, "ADVERTISER_UNSUSPEND", TARGET, command.advertiserId.toString(), null, now))
        log.info { "광고주 정지 해제: advertiserId=${command.advertiserId} actor=${command.actorMemberId}" }
        return AdvertiserAdminView.from(advertiser)
    }

    private fun find(id: Long) = advertiserPort.findById(id) ?: throw BusinessException(ErrorCode.NOT_FOUND, "광고주가 없습니다")

    private companion object {
        const val TARGET = "ADVERTISER"
    }
}
