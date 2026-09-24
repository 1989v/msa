package com.kgd.order.infrastructure.config

import com.kgd.common.ops.DltKafka
import com.kgd.common.ops.DltOpsIssueRecorder
import com.kgd.common.ops.DltReplayer
import com.kgd.common.ops.OpsIssueAdminService
import com.kgd.common.ops.OpsIssueStore
import com.kgd.common.ops.usecase.OpsIssueAdminUseCase
import com.kgd.order.application.claim.usecase.ResumeClaimUseCase
import com.kgd.order.application.saga.usecase.ResumeSagaUseCase
import com.kgd.order.domain.opsissue.model.OpsIssueType
import com.kgd.order.infrastructure.messaging.OrderClaimConsumer
import com.kgd.order.infrastructure.messaging.OrderReadModelConsumer
import com.kgd.order.infrastructure.messaging.OrderSagaConsumer
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory
import org.springframework.kafka.core.KafkaTemplate
import java.time.Clock
import javax.sql.DataSource

/**
 * order 운영 이슈 — `order_db.ops_issue` + DLT 적재 + 어드민 재시도. 재시도는 종류별로 다르다:
 * DLT 는 원 토픽 재발행, SAGA_STUCK 은 사가 재개, CLAIM_STUCK 은 클레임 재개.
 * 저장소는 order EMF 의 DataSource(`orderDataSource`) — 코디네이터 트랜잭션에 함께 묶인다.
 */
@Configuration
class OrderOpsConfig {

    @Bean
    fun orderOpsIssueStore(
        @Qualifier("orderDataSource") dataSource: DataSource,
        @Qualifier("orderClock") clock: Clock,
    ): OpsIssueStore = OpsIssueStore(dataSource, clock)

    @Bean
    fun orderDltReplayer(
        @Qualifier("orderOpsIssueStore") store: OpsIssueStore,
        @Qualifier("orderOutboxKafkaTemplate") template: KafkaTemplate<String, String>,
    ): DltReplayer = DltReplayer(store, template)

    @Bean
    fun orderOpsIssueAdmin(
        @Qualifier("orderOpsIssueStore") store: OpsIssueStore,
        @Qualifier("orderDltReplayer") replayer: DltReplayer,
        resumeSaga: ResumeSagaUseCase,
        resumeClaim: ResumeClaimUseCase,
    ): OpsIssueAdminUseCase = OpsIssueAdminService(
        "order", store,
        mapOf(
            DltOpsIssueRecorder.DLT to { issue -> replayer.replay(issue.id) },
            OpsIssueType.SAGA_STUCK.name to { issue -> resumeSaga.resume(issue.targetId.toLong()) },
            OpsIssueType.CLAIM_STUCK.name to { issue -> resumeClaim.resume(issue.targetId.toLong()) },
        ),
    )

    @Bean
    fun orderDltRecorder(@Qualifier("orderOpsIssueStore") store: OpsIssueStore): DltOpsIssueRecorder =
        DltOpsIssueRecorder(
            store,
            setOf(OrderSagaConsumer.CONSUMER_GROUP, OrderClaimConsumer.CONSUMER_GROUP, OrderReadModelConsumer.CONSUMER_GROUP),
        )

    @Bean
    fun orderDltListenerContainerFactory(
        @Value("\${spring.kafka.bootstrap-servers}") bootstrapServers: String,
        @Value("\${commerce.ops.dlt.metadata-max-age-ms:60000}") metadataMaxAgeMs: Long,
    ): ConcurrentKafkaListenerContainerFactory<String, String> =
        DltKafka.listenerContainerFactory(bootstrapServers, DLT_GROUP, metadataMaxAgeMs)

    companion object {
        const val DLT_GROUP = "order-dlt-ops"
    }
}
