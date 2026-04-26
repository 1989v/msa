package com.kgd.sevensplit.application.port.persistence

import com.kgd.sevensplit.domain.common.TenantId
import com.kgd.sevensplit.domain.credential.Exchange
import com.kgd.sevensplit.domain.credential.ExchangeCredential

/**
 * ExchangeCredentialRepositoryPort — `ExchangeCredential` 영속화 port.
 *
 * ## 계약
 * - 모든 조회 시그니처에 `tenantId` 포함 (INV-05).
 * - Phase 1 은 `(tenantId, exchange)` per 1건 가정. 복수 계정 지원은 OQ-011 에서 확장.
 * - 저장되는 필드는 모두 암호화된 cipher bytes — 평문 입력은 받지 않는다.
 *   평문 입출력은 [CredentialVault] 가 담당.
 */
interface ExchangeCredentialRepositoryPort {
    suspend fun save(credential: ExchangeCredential): ExchangeCredential
    suspend fun findByTenantAndExchange(tenantId: TenantId, exchange: Exchange): ExchangeCredential?
}
