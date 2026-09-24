package com.kgd.promotion.infrastructure.config

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
 * promotion 운영 이슈 — `promotion_db.ops_issue` + DLT 적재 + 어드민 재발행. 빈 이름은 전부 `promotion` 접두(commerce 폴드).
 * DLT 는 자기 컨슈머 그룹이 실패한 것만 받는다 — 같은 토픽을 다른 도메인도 구독하면 DLT 토픽이 겹친다.
 */
@Configuration
class PromotionOpsConfig {

    @Bean
    fun promotionOpsIssueStore(@Qualifier("promotionDataSource") dataSource: DataSource): OpsIssueStore = OpsIssueStore(dataSource)

    @Bean
    fun promotionDltReplayer(
        @Qualifier("promotionOpsIssueStore") store: OpsIssueStore,
        @Qualifier("promotionOutboxKafkaTemplate") template: KafkaTemplate<String, String>,
    ): DltReplayer = DltReplayer(store, template)

    @Bean
    fun promotionOpsIssueAdmin(
        @Qualifier("promotionOpsIssueStore") store: OpsIssueStore,
        @Qualifier("promotionDltReplayer") replayer: DltReplayer,
    ): OpsIssueAdminUseCase = OpsIssueAdminService.dltOnly("promotion", store, replayer)

    @Bean
    fun promotionDltRecorder(@Qualifier("promotionOpsIssueStore") store: OpsIssueStore): DltOpsIssueRecorder =
        DltOpsIssueRecorder(store, setOf(PromotionKafkaConfig.CONSUMER_GROUP))

    @Bean
    fun promotionDltListenerContainerFactory(
        @Value("\${spring.kafka.bootstrap-servers}") bootstrapServers: String,
        @Value("\${commerce.ops.dlt.metadata-max-age-ms:60000}") metadataMaxAgeMs: Long,
    ): ConcurrentKafkaListenerContainerFactory<String, String> =
        DltKafka.listenerContainerFactory(bootstrapServers, DLT_GROUP, metadataMaxAgeMs)

    companion object {
        const val DLT_GROUP = "promotion-dlt-ops"
    }
}
