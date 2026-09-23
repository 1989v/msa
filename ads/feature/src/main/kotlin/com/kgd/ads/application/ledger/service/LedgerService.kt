package com.kgd.ads.application.ledger.service

import com.kgd.ads.application.advertiser.port.AdvertiserPort
import com.kgd.ads.application.ledger.port.LedgerLine
import com.kgd.ads.application.ledger.port.LedgerPort
import com.kgd.ads.application.ledger.port.LedgerPosting
import com.kgd.ads.application.ledger.usecase.GetWalletUseCase
import com.kgd.ads.application.ledger.usecase.TopUpUseCase
import com.kgd.ads.domain.advertiser.model.AdvertiserStatus
import com.kgd.ads.domain.ledger.model.LedgerAccountType
import com.kgd.ads.domain.ledger.model.LedgerTransactionType
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.LocalDateTime

@Service
class LedgerService(
    private val advertiserPort: AdvertiserPort,
    private val ledgerPort: LedgerPort,
    @Qualifier("adsClock") private val clock: Clock,
) : TopUpUseCase, GetWalletUseCase {

    private val log = KotlinLogging.logger {}

    @Transactional("adsTransactionManager")
    override fun execute(command: TopUpUseCase.Command): TopUpUseCase.Result {
        if (command.amountMicros <= 0) throw BusinessException(ErrorCode.INVALID_INPUT, "충전액은 0 보다 커야 합니다")
        val advertiser = advertiserPort.findByMemberId(command.memberId)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "광고주가 아닙니다")
        if (advertiser.status != AdvertiserStatus.ACTIVE) {
            throw BusinessException(ErrorCode.FORBIDDEN, "정지된 광고주는 충전할 수 없습니다")
        }
        val advertiserId = requireNotNull(advertiser.id)
        val wallet = ledgerPort.findWalletAccountId(advertiserId)
            ?: error("지갑 없는 광고주: advertiserId=$advertiserId")
        val source = ledgerPort.systemAccountId(LedgerAccountType.TOPUP_SOURCE)

        val transactionId = ledgerPort.post(
            LedgerPosting(
                type = LedgerTransactionType.TOPUP,
                idempotencyKey = command.idempotencyKey,
                actorMemberId = command.memberId,
                lines = listOf(LedgerLine(source, -command.amountMicros), LedgerLine(wallet, command.amountMicros)),
                at = LocalDateTime.now(clock),
            ),
        )
        val balance = ledgerPort.balanceOf(wallet)
        log.info { "충전: advertiserId=$advertiserId amountMicros=${command.amountMicros} txId=$transactionId" }
        return TopUpUseCase.Result(transactionId, balance)
    }

    override fun execute(memberId: Long): GetWalletUseCase.Result? {
        val advertiserId = advertiserPort.findByMemberId(memberId)?.id ?: return null
        val wallet = ledgerPort.findWalletAccountId(advertiserId) ?: return null
        return GetWalletUseCase.Result(advertiserId, ledgerPort.balanceOf(wallet))
    }
}
