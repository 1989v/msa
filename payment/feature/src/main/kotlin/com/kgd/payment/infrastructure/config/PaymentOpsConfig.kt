package com.kgd.payment.infrastructure.config

import com.kgd.common.ops.DltKafka
import com.kgd.common.ops.DltOpsIssueRecorder
import com.kgd.common.ops.DltReplayer
import com.kgd.common.ops.OpsIssueStore
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory
import org.springframework.kafka.core.KafkaTemplate
import java.time.Clock
import javax.sql.DataSource

/**
 * payment DLT → 운영 이슈(type=DLT). 조회·재시도·종결은 payment 의 기존 운영 이슈 API 가 같은 `ops_issue` 행을 본다 —
 * DLT 행의 적재와 재발행 기록(payload)만 공통 저장소로 한다.
 */
@Configuration
class PaymentOpsConfig {

    @Bean
    fun paymentOpsIssueStore(
        @Qualifier("paymentDataSource") dataSource: DataSource,
        @Qualifier("paymentClock") clock: Clock,
    ): OpsIssueStore = OpsIssueStore(dataSource, clock)

    @Bean
    fun paymentDltReplayer(
        @Qualifier("paymentOpsIssueStore") store: OpsIssueStore,
        @Qualifier("paymentOutboxKafkaTemplate") template: KafkaTemplate<String, String>,
    ): DltReplayer = DltReplayer(store, template)

    @Bean
    fun paymentDltRecorder(@Qualifier("paymentOpsIssueStore") store: OpsIssueStore): DltOpsIssueRecorder =
        DltOpsIssueRecorder(store, setOf(PaymentKafkaConfig.CONSUMER_GROUP))

    @Bean
    fun paymentDltListenerContainerFactory(
        @Value("\${spring.kafka.bootstrap-servers}") bootstrapServers: String,
        @Value("\${commerce.ops.dlt.metadata-max-age-ms:60000}") metadataMaxAgeMs: Long,
    ): ConcurrentKafkaListenerContainerFactory<String, String> =
        DltKafka.listenerContainerFactory(bootstrapServers, DLT_GROUP, metadataMaxAgeMs)

    companion object {
        const val DLT_GROUP = "payment-dlt-ops"
    }
}
