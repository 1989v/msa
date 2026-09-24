package com.kgd.ads.application.ledger.service

import com.kgd.ads.application.advertiser.port.AdvertiserPort
import com.kgd.ads.application.ledger.config.AdsTopUpProperties
import com.kgd.ads.application.ledger.port.LedgerPort
import com.kgd.ads.application.ledger.usecase.GetWalletUseCase
import com.kgd.ads.application.ledger.usecase.TopUpUseCase
import com.kgd.ads.domain.advertiser.model.AdvertiserStatus
import com.kgd.ads.domain.ledger.model.Credits
import com.kgd.ads.domain.ledger.model.LedgerAccountType
import com.kgd.ads.domain.ledger.model.LedgerTransaction
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Isolation
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.LocalDateTime

@Service
class LedgerService(
    private val advertiserPort: AdvertiserPort,
    private val ledgerPort: LedgerPort,
    private val topUpProperties: AdsTopUpProperties,
    @Qualifier("adsClock") private val clock: Clock,
) : TopUpUseCase, GetWalletUseCase {

    private val log = KotlinLogging.logger {}

    /**
     * 한도 확인과 기록을 지갑 행 잠금 안에서 한다 — 잠금 밖에서 합계를 보면 동시 충전 둘이 같은 여유를 보고 함께 통과한다.
     * READ COMMITTED 라야 잠금을 기다린 뒤의 합계 조회가 앞 충전의 커밋을 본다.
     * 같은 멱등 키의 재요청은 한도와 무관하게 앞 거래를 돌려준다.
     */
    @Transactional("adsTransactionManager", isolation = Isolation.READ_COMMITTED)
    override fun execute(command: TopUpUseCase.Command): TopUpUseCase.Result {
        if (command.amountMicros <= 0) throw BusinessException(ErrorCode.INVALID_INPUT, "충전액은 0 보다 커야 합니다")
        if (command.amountMicros > topUpProperties.maxPerCallMicros) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "1회 충전 한도(${Credits.format(topUpProperties.maxPerCallMicros)})를 넘었습니다")
        }
        val advertiser = advertiserPort.findByMemberId(command.memberId)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "광고주가 아닙니다")
        if (advertiser.status != AdvertiserStatus.ACTIVE) {
            throw BusinessException(ErrorCode.FORBIDDEN, "정지된 광고주는 충전할 수 없습니다")
        }
        val advertiserId = requireNotNull(advertiser.id)
        val wallet = ledgerPort.findWalletAccountId(advertiserId)
            ?: error("지갑 없는 광고주: advertiserId=$advertiserId")
        val source = ledgerPort.systemAccountId(LedgerAccountType.TOPUP_SOURCE)
        ledgerPort.lockAccounts(listOf(source, wallet))

        ledgerPort.findTransactionId(command.idempotencyKey)?.let { existing ->
            return TopUpUseCase.Result(existing, ledgerPort.balanceOf(wallet))
        }
        val now = LocalDateTime.now(clock)
        val dayStart = now.toLocalDate().atStartOfDay()
        val toppedUpToday = ledgerPort.sumTopUps(wallet, dayStart, dayStart.plusDays(1))
        if (toppedUpToday + command.amountMicros > topUpProperties.dailyLimitMicros) {
            log.info { "충전 거절(하루 한도): advertiserId=$advertiserId today=$toppedUpToday amountMicros=${command.amountMicros}" }
            throw BusinessException(ErrorCode.INVALID_INPUT, "오늘 충전 한도(${Credits.format(topUpProperties.dailyLimitMicros)})를 넘습니다 — 오늘 충전 ${Credits.format(toppedUpToday)}")
        }

        val transactionId = ledgerPort.post(
            LedgerTransaction.topUp(
                idempotencyKey = command.idempotencyKey,
                sourceAccountId = source,
                walletAccountId = wallet,
                amountMicros = command.amountMicros,
                actorMemberId = command.memberId,
                at = now,
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
