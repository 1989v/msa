package com.kgd.quant.infrastructure.security

import com.kgd.quant.infrastructure.persistence.repository.ExchangeCredentialJpaRepository
import com.kgd.quant.infrastructure.persistence.repository.NotificationTargetJpaRepository
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * TG-P2-04 — `LazyReencryptionJob` 의 트랜잭션 경계 분리.
 *
 * Spring AOP `@Transactional` 은 같은 클래스 내부 호출 시 프록시를 우회하므로 적용되지 않는다.
 * 본 별도 빈으로 분리하여 KMS 호출(외부 IO) 은 트랜잭션 밖, 실 UPDATE 만 짧은 트랜잭션 안에서
 * 실행되도록 한다 (ADR-0020 §외부 IO 는 트랜잭션 밖).
 */
@Component
class EnvelopeUpdateExecutor(
    private val credentialRepo: ExchangeCredentialJpaRepository,
    private val notificationRepo: NotificationTargetJpaRepository
) {

    @Transactional
    fun updateCredential(
        credentialId: UUID,
        expectedOldVersion: Int,
        apiKeyCt: ByteArray,
        apiSecretCt: ByteArray,
        passphraseCt: ByteArray?,
        dekWrapped: ByteArray,
        newVersion: Int
    ): Int = credentialRepo.updateEnvelopeWithLock(
        credentialId = credentialId,
        expectedOldVersion = expectedOldVersion,
        apiKeyCt = apiKeyCt,
        apiSecretCt = apiSecretCt,
        passphraseCt = passphraseCt,
        dekWrapped = dekWrapped,
        newVersion = newVersion
    )

    @Transactional
    fun updateNotification(
        targetId: UUID,
        expectedOldVersion: Int,
        botTokenCt: ByteArray,
        dekWrapped: ByteArray,
        newVersion: Int
    ): Int = notificationRepo.updateEnvelopeWithLock(
        targetId = targetId,
        expectedOldVersion = expectedOldVersion,
        botTokenCt = botTokenCt,
        dekWrapped = dekWrapped,
        newVersion = newVersion
    )
}
