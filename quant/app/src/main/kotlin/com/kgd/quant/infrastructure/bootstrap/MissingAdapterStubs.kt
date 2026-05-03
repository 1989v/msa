package com.kgd.quant.infrastructure.bootstrap

import com.kgd.quant.application.port.credential.CredentialPlaintext
import com.kgd.quant.application.port.credential.CredentialVault
import com.kgd.quant.application.port.credential.DecryptedCredential
import com.kgd.quant.application.port.exchange.SlippageModel
import com.kgd.quant.application.port.marketdata.Bar
import com.kgd.quant.application.port.marketdata.BarInterval
import com.kgd.quant.application.port.marketdata.HistoricalMarketDataSource
import com.kgd.quant.application.port.marketdata.MarketDataSubscriber
import com.kgd.quant.application.port.marketdata.Symbol
import com.kgd.quant.application.port.marketdata.Tick
import com.kgd.quant.application.port.notification.NotificationEvent
import com.kgd.quant.application.port.notification.NotificationPriority
import com.kgd.quant.application.port.notification.NotificationPriorityQueue
import com.kgd.quant.application.port.notification.NotificationSender
import com.kgd.quant.application.port.notification.PrioritizedNotification
import com.kgd.quant.application.port.notification.SendResult
import com.kgd.quant.domain.common.Price
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.credential.Exchange
import com.kgd.quant.domain.order.OrderSide
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emptyFlow
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.time.Instant
import java.util.UUID

/**
 * ⚠️ TEMPORARY — Phase 1/2 에서 구현이 누락된 application port 들의 stub 모음.
 *
 * RunBacktestUseCase / Strategy lifecycle / Notification dispatcher 등 다수 use case 가
 * 본 port 들을 생성자로 요구해 ApplicationContext 시작이 막혔다. k3d 로컬에서 부팅 검증을
 * 가능하게 하려고 NotImplementedError throw 하는 stub 을 등록한다 (실제 호출 시 즉시 실패).
 *
 * 정식 구현 위치 (TG-/ADR 참조):
 *   - HistoricalMarketDataSource : ClickHouse `quant.market_tick_*` 또는 CSV (TG-05)
 *   - MarketDataSubscriber       : 빗썸/업비트 WebSocket (TG-04.3)
 *   - CredentialVault            : KeyManagementService + ExchangeCredentialRepository 합성 (TG-P2-04)
 *   - SlippageModel              : FixedSlippageModel (TG-P2-08, default 0.05%)
 *   - NotificationSender         : Telegram Bot (TG-04.8)
 *   - NotificationPriorityQueue  : in-memory PriorityChannel (TG-P2-10, replicas=1 가정)
 *
 * `@ConditionalOnMissingBean` 으로 가드 → 정식 구현 등록 시 stub 자동 비활성화.
 *
 * TODO(removal): 위 6개 정식 어댑터 합류 후 본 파일 삭제.
 */
@Configuration
class MissingAdapterStubs {

    @Bean
    @ConditionalOnMissingBean(HistoricalMarketDataSource::class)
    fun stubHistoricalMarketDataSource(): HistoricalMarketDataSource = object : HistoricalMarketDataSource {
        override fun stream(symbol: Symbol, from: Instant, to: Instant, interval: BarInterval): Flow<Bar> =
            emptyFlow()
    }

    @Bean
    @ConditionalOnMissingBean(MarketDataSubscriber::class)
    fun stubMarketDataSubscriber(): MarketDataSubscriber = object : MarketDataSubscriber {
        override fun subscribe(symbol: Symbol): Flow<Tick> = emptyFlow()
        override fun fallbackPoll(symbol: Symbol): Flow<Tick> = emptyFlow()
    }

    @Bean
    @ConditionalOnMissingBean(CredentialVault::class)
    fun stubCredentialVault(): CredentialVault = object : CredentialVault {
        override suspend fun store(tenantId: TenantId, exchange: Exchange, plaintext: CredentialPlaintext): UUID =
            error("CredentialVault is a stub — wire LocalFileKmsAdapter/OciVaultKmsAdapter 합성 구현체.")
        override suspend fun load(tenantId: TenantId, exchange: Exchange): DecryptedCredential =
            error("CredentialVault is a stub — wire LocalFileKmsAdapter/OciVaultKmsAdapter 합성 구현체.")
    }

    @Bean
    @ConditionalOnMissingBean(SlippageModel::class)
    fun stubSlippageModel(): SlippageModel = SlippageModel { tick, _: OrderSide -> tick }

    @Bean
    @ConditionalOnMissingBean(NotificationSender::class)
    fun stubNotificationSender(): NotificationSender = object : NotificationSender {
        override suspend fun send(tenantId: TenantId, event: NotificationEvent): SendResult =
            SendResult.Failure(reason = "NotificationSender stub — Telegram bot 미구현", retryable = false)
    }

    @Bean
    @ConditionalOnMissingBean(NotificationPriorityQueue::class)
    fun stubNotificationPriorityQueue(): NotificationPriorityQueue = object : NotificationPriorityQueue {
        // 단일 무제한 channel — priority 무시. 부팅 검증 전용.
        private val channel = Channel<PrioritizedNotification>(Channel.UNLIMITED)
        override fun enqueue(item: PrioritizedNotification) {
            channel.trySend(item)
        }
        override suspend fun dequeue(): PrioritizedNotification = channel.receive()
        override fun size(priority: NotificationPriority): Int = 0
    }

    private fun SlippageModel(impl: (Price, OrderSide) -> Price): SlippageModel = object : SlippageModel {
        override fun apply(tick: Price, side: OrderSide): Price = impl(tick, side)
    }
}
