package com.kgd.product.infrastructure.config

import com.kgd.common.ops.DltKafka
import com.kgd.common.ops.DltOpsIssueRecorder
import com.kgd.common.ops.DltReplayer
import com.kgd.common.ops.OpsIssueAdminService
import com.kgd.common.ops.OpsIssueStore
import com.kgd.common.ops.usecase.OpsIssueAdminUseCase
import com.kgd.product.infrastructure.messaging.InventoryStockSyncConsumer
import com.kgd.product.infrastructure.messaging.SellerReadModelConsumer
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory
import org.springframework.kafka.core.KafkaTemplate
import javax.sql.DataSource

/**
 * product 운영 이슈 — `product_db.ops_issue` + DLT 적재 + 어드민 재발행. 빈 이름은 전부 `product` 접두(commerce 폴드).
 * DLT 는 자기 컨슈머 그룹이 실패한 것만 받는다 — 같은 토픽을 다른 도메인도 구독하면 DLT 토픽이 겹친다.
 */
@Configuration
class ProductOpsConfig {

    @Bean
    fun productOpsIssueStore(@Qualifier("productDataSource") dataSource: DataSource): OpsIssueStore = OpsIssueStore(dataSource)

    @Bean
    fun productDltReplayer(
        @Qualifier("productOpsIssueStore") store: OpsIssueStore,
        @Qualifier("productOutboxKafkaTemplate") template: KafkaTemplate<String, String>,
    ): DltReplayer = DltReplayer(store, template)

    @Bean
    fun productOpsIssueAdmin(
        @Qualifier("productOpsIssueStore") store: OpsIssueStore,
        @Qualifier("productDltReplayer") replayer: DltReplayer,
    ): OpsIssueAdminUseCase = OpsIssueAdminService.dltOnly("product", store, replayer)

    @Bean
    fun productDltRecorder(@Qualifier("productOpsIssueStore") store: OpsIssueStore): DltOpsIssueRecorder =
        DltOpsIssueRecorder(store, setOf(InventoryStockSyncConsumer.CONSUMER_GROUP, SellerReadModelConsumer.CONSUMER_GROUP))

    @Bean
    fun productDltListenerContainerFactory(
        @Value("\${spring.kafka.bootstrap-servers}") bootstrapServers: String,
        @Value("\${commerce.ops.dlt.metadata-max-age-ms:60000}") metadataMaxAgeMs: Long,
    ): ConcurrentKafkaListenerContainerFactory<String, String> =
        DltKafka.listenerContainerFactory(bootstrapServers, DLT_GROUP, metadataMaxAgeMs)

    companion object {
        const val DLT_GROUP = "product-dlt-ops"
    }
}
