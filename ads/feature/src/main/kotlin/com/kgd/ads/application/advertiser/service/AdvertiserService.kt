package com.kgd.ads.application.advertiser.service

import com.kgd.ads.application.advertiser.port.AdvertiserPort
import com.kgd.ads.application.advertiser.usecase.RegisterAdvertiserUseCase
import com.kgd.ads.application.ledger.port.LedgerPort
import com.kgd.ads.domain.advertiser.model.Advertiser
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.LocalDateTime

@Service
class AdvertiserService(
    private val advertiserPort: AdvertiserPort,
    private val ledgerPort: LedgerPort,
    @Qualifier("adsClock") private val clock: Clock,
) : RegisterAdvertiserUseCase {

    private val log = KotlinLogging.logger {}

    /** 광고주 행과 지갑 원장 계정을 한 트랜잭션에서 만든다 — 지갑 없는 MEMBER 광고주는 없다. */
    @Transactional("adsTransactionManager")
    override fun execute(command: RegisterAdvertiserUseCase.Command): RegisterAdvertiserUseCase.Result {
        advertiserPort.findByMemberId(command.memberId)?.let {
            return RegisterAdvertiserUseCase.Result(requireNotNull(it.id))
        }
        val now = LocalDateTime.now(clock)
        val saved = advertiserPort.save(Advertiser.registerMember(command.memberId, command.displayName), now)
        val advertiserId = requireNotNull(saved.id)
        ledgerPort.openWallet(advertiserId, now)
        log.info { "광고주 등록: advertiserId=$advertiserId" }
        return RegisterAdvertiserUseCase.Result(advertiserId)
    }
}
