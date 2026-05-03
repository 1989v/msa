package com.kgd.quant.infrastructure.persistence.adapter

import com.kgd.quant.application.port.persistence.ExchangeCredentialRepositoryPort
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.credential.Exchange
import com.kgd.quant.domain.credential.ExchangeCredential
import com.kgd.quant.infrastructure.persistence.entity.ExchangeCredentialEntity
import com.kgd.quant.infrastructure.persistence.repository.ExchangeCredentialJpaRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.springframework.stereotype.Component

/**
 * `ExchangeCredentialRepositoryPort` 의 JPA 기반 구현.
 *
 * ## 트랜잭션 / 동시성
 * - 메서드별 짧은 트랜잭션 (ADR-0020 — 클래스 레벨 `@Transactional` 금지).
 * - JPA blocking 호출을 `Dispatchers.IO` 로 위임.
 *
 * ## tenantId 격리 (INV-05)
 * - `findByTenantAndExchange` 는 (tenantId, exchange) 매칭 row 만 조회.
 *
 * ## envelope 필드 (Phase 2 — TG-P2-04)
 * - 도메인 `ExchangeCredential` 은 `kek_version`/`dek_wrapped` 를 모르므로
 *   매핑 시 entity 의 envelope 컬럼은 보존(update 경로) 또는 default 1/null(create 경로) 처리.
 * - 신규 envelope 회전 / KMS wrap 갱신 경로는 `LazyReencryptionJob` 등 별도 컴포넌트가 담당.
 */
@Component
class JpaExchangeCredentialRepositoryAdapter(
    private val jpa: ExchangeCredentialJpaRepository,
) : ExchangeCredentialRepositoryPort {

    override suspend fun save(credential: ExchangeCredential): ExchangeCredential =
        withContext(Dispatchers.IO) {
            val existing = jpa.findById(credential.credentialId).orElse(null)
            val entity = if (existing == null) {
                ExchangeCredentialEntity(
                    credentialId = credential.credentialId,
                    tenantId = credential.tenantId.value,
                    exchange = credential.exchange.name,
                    apiKeyCipher = credential.apiKeyCipher,
                    apiSecretCipher = credential.apiSecretCipher,
                    passphraseCipher = credential.passphraseCipher,
                    ipWhitelist = credential.ipWhitelist.joinToString(","),
                )
            } else {
                existing.apply {
                    apiKeyCipher = credential.apiKeyCipher
                    apiSecretCipher = credential.apiSecretCipher
                    passphraseCipher = credential.passphraseCipher
                    ipWhitelist = credential.ipWhitelist.joinToString(",")
                }
            }
            jpa.save(entity).toDomain()
        }

    override suspend fun findByTenantAndExchange(
        tenantId: TenantId,
        exchange: Exchange,
    ): ExchangeCredential? = withContext(Dispatchers.IO) {
        jpa.findAllByTenantId(tenantId.value)
            .firstOrNull { it.exchange == exchange.name }
            ?.toDomain()
    }

    private fun ExchangeCredentialEntity.toDomain(): ExchangeCredential = ExchangeCredential(
        credentialId = credentialId,
        tenantId = TenantId(tenantId),
        exchange = Exchange.valueOf(exchange),
        apiKeyCipher = apiKeyCipher,
        apiSecretCipher = apiSecretCipher,
        passphraseCipher = passphraseCipher,
        ipWhitelist = ipWhitelist.takeIf { it.isNotBlank() }?.split(",") ?: emptyList(),
    )
}
