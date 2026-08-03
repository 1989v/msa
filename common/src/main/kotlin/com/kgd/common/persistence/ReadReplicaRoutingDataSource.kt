package com.kgd.common.persistence

import org.springframework.jdbc.datasource.lookup.AbstractRoutingDataSource
import org.springframework.transaction.support.TransactionSynchronizationManager

/**
 * ADR-0058 — 읽기-쓰기 분리 라우팅 헬퍼 (공유).
 *
 * 현재 트랜잭션이 readOnly 면 [DataSourceType.REPLICA], 아니면 [DataSourceType.MASTER] 로 라우팅한다.
 * commerce 모듈러 모놀리스에서 도메인별 datasource 가 각자 master/replica 를 라우팅하므로,
 * 특정 도메인 패키지(com.kgd.inventory 등)가 아닌 common 에 두어 feature 간 의존을 만들지 않는다.
 */
enum class DataSourceType { MASTER, REPLICA }

class ReadReplicaRoutingDataSource : AbstractRoutingDataSource() {
    override fun determineCurrentLookupKey(): DataSourceType =
        if (TransactionSynchronizationManager.isCurrentTransactionReadOnly())
            DataSourceType.REPLICA else DataSourceType.MASTER
}
