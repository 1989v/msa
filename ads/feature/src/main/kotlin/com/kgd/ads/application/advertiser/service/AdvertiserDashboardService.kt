package com.kgd.ads.application.advertiser.service

import com.kgd.ads.application.advertiser.usecase.GetAdvertiserDashboardUseCase
import com.kgd.ads.application.ledger.port.LedgerPort
import com.kgd.ads.application.report.port.ReportPort
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import java.time.Clock
import java.time.LocalDate

@Service
class AdvertiserDashboardService(
    private val access: AdvertiserAccess,
    private val ledgerPort: LedgerPort,
    private val reportPort: ReportPort,
    @Qualifier("adsClock") private val clock: Clock,
) : GetAdvertiserDashboardUseCase {

    override fun execute(memberId: Long): GetAdvertiserDashboardUseCase.Dashboard {
        val advertiser = access.require(memberId)
        val advertiserId = requireNotNull(advertiser.id)
        val wallet = ledgerPort.findWalletAccountId(advertiserId) ?: error("지갑 없는 광고주: advertiserId=$advertiserId")
        val dayStart = LocalDate.now(clock).atStartOfDay()
        val today = reportPort.advertiserTotals(advertiserId, dayStart, dayStart.plusDays(1))
        return GetAdvertiserDashboardUseCase.Dashboard(
            advertiserId = advertiserId,
            displayName = advertiser.displayName,
            status = advertiser.status,
            suspendReason = advertiser.suspension?.reason,
            balanceMicros = ledgerPort.balanceOf(wallet),
            todaySpendMicros = today.spendMicros,
            todayChargedMicros = today.chargedMicros,
        )
    }
}
