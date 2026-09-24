package com.kgd.settlement.infrastructure.config

import com.kgd.common.ops.DltKafka
import com.kgd.common.ops.DltOpsIssueRecorder
import com.kgd.common.ops.DltReplayer
import com.kgd.common.ops.OpsIssueAdminService
import com.kgd.common.ops.OpsIssueStore
import com.kgd.common.ops.usecase.OpsIssueAdminUseCase
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory
import org.springframework.kafka.core.KafkaTemplate
import javax.sql.DataSource

/**
 * settlement 운영 이슈 — `settlement_db.ops_issue` + DLT 적재 + 어드민 재발행. 빈 이름은 전부 `settlement` 접두(commerce 폴드).
 * DLT 는 자기 컨슈머 그룹이 실패한 것만 받는다 — 같은 토픽을 다른 도메인도 구독하면 DLT 토픽이 겹친다.
 */
@Configuration
class SettlementOpsConfig {

    @Bean
    fun settlementOpsIssueStore(@Qualifier("settlementDataSource") dataSource: DataSource): OpsIssueStore = OpsIssueStore(dataSource)

    @Bean
    fun settlementDltReplayer(
        @Qualifier("settlementOpsIssueStore") store: OpsIssueStore,
        @Qualifier("settlementDltKafkaTemplate") template: KafkaTemplate<String, String>,
    ): DltReplayer = DltReplayer(store, template)

    @Bean
    fun settlementOpsIssueAdmin(
        @Qualifier("settlementOpsIssueStore") store: OpsIssueStore,
        @Qualifier("settlementDltReplayer") replayer: DltReplayer,
    ): OpsIssueAdminUseCase = OpsIssueAdminService.dltOnly("settlement", store, replayer)

    @Bean
    fun settlementDltRecorder(@Qualifier("settlementOpsIssueStore") store: OpsIssueStore): DltOpsIssueRecorder =
        DltOpsIssueRecorder(store, setOf(SettlementKafkaConfig.CONSUMER_GROUP))

    @Bean
    fun settlementDltListenerContainerFactory(
        @Value("\${spring.kafka.bootstrap-servers}") bootstrapServers: String,
        @Value("\${commerce.ops.dlt.metadata-max-age-ms:60000}") metadataMaxAgeMs: Long,
    ): ConcurrentKafkaListenerContainerFactory<String, String> =
        DltKafka.listenerContainerFactory(bootstrapServers, DLT_GROUP, metadataMaxAgeMs)

    companion object {
        const val DLT_GROUP = "settlement-dlt-ops"
    }
}
