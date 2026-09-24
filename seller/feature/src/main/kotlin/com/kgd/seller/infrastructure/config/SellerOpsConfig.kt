package com.kgd.seller.infrastructure.config

import com.kgd.common.ops.OpsIssueAdminService
import com.kgd.common.ops.OpsIssueStore
import com.kgd.common.ops.usecase.OpsIssueAdminUseCase
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import javax.sql.DataSource

/**
 * seller 운영 이슈 — `seller_db.ops_issue`. seller 는 구독하는 토픽이 없어 DLT 컨슈머가 없다 — 운영 큐가 여덟 도메인을
 * 같은 모양으로 합치도록 테이블과 어드민 API 만 둔다. 재시도할 종류가 생기면 핸들러를 여기 붙인다.
 */
@Configuration
class SellerOpsConfig {

    @Bean
    fun sellerOpsIssueStore(@Qualifier("sellerDataSource") dataSource: DataSource): OpsIssueStore = OpsIssueStore(dataSource)

    @Bean
    fun sellerOpsIssueAdmin(@Qualifier("sellerOpsIssueStore") store: OpsIssueStore): OpsIssueAdminUseCase =
        OpsIssueAdminService("seller", store, emptyMap())
}
