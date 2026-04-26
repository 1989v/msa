package com.kgd.quant.infrastructure.persistence.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

/**
 * TG-P2-04 — `exchange_credential` 테이블 매핑 Entity.
 *
 * Phase 1 V001 에서 컬럼만 사전 마련됐고, Phase 2 V002 에서 envelope encryption 컬럼
 * (`kek_version`, `dek_wrapped`) 가 추가되었다. 본 Entity 는 두 Phase 컬럼을 모두 매핑한다.
 *
 * ## 컬럼 의미
 *  - `api_key_cipher` / `api_secret_cipher` / `passphrase_cipher`:
 *      - Phase 2: AES-GCM(plaintext, DEK) ciphertext (envelope)
 *      - Phase 1 fallback: 단순 AES-GCM(plaintext, KEK) ciphertext (`dek_wrapped IS NULL` 일 때만)
 *  - `dek_wrapped`: KMS wrap 된 DEK. NULL 이면 Phase 1 deprecated row.
 *  - `kek_version`: INT(1+). Phase 1 default = 1. LocalFile KMS 의 `local-vN` 의 N 값과 매핑.
 *
 * ## 동시 갱신 (Optimistic Lock — TG-P2-04.4)
 *  - `LazyReencryptionJob` 가 회전 시 update 할 때 `WHERE id=? AND kek_version=N` 로
 *    낙관적 잠금을 적용한다 (별도 `@Version` 컬럼 도입 없이 비즈니스 컬럼으로 충돌 감지).
 *
 * ## kotlin-jpa
 *  - `class` + `var` 필드 (Hibernate proxy 호환).
 */
@Entity
@Table(name = "exchange_credential")
class ExchangeCredentialEntity(
    @Id
    @Column(name = "credential_id", columnDefinition = "BINARY(16)", nullable = false)
    var credentialId: UUID = UUID.randomUUID(),

    @Column(name = "tenant_id", nullable = false, length = 64)
    var tenantId: String = "",

    @Column(name = "exchange", nullable = false, length = 32)
    var exchange: String = "",

    @Column(name = "api_key_cipher", nullable = false, columnDefinition = "VARBINARY(1024)")
    var apiKeyCipher: ByteArray = ByteArray(0),

    @Column(name = "api_secret_cipher", nullable = false, columnDefinition = "VARBINARY(1024)")
    var apiSecretCipher: ByteArray = ByteArray(0),

    @Column(name = "passphrase_cipher", nullable = true, columnDefinition = "VARBINARY(1024)")
    var passphraseCipher: ByteArray? = null,

    @Column(name = "ip_whitelist", nullable = false, columnDefinition = "TEXT")
    var ipWhitelist: String = "",

    @Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now(),

    /**
     * TG-P2-04 — 신규 컬럼.
     *
     * 현재 row 의 *_cipher 값을 wrap 한 KEK 의 버전 (예: `local-vN` → N).
     * INV-P2-11: NOT NULL 강제 (V002 default 1).
     */
    @Column(name = "kek_version", nullable = false)
    var kekVersion: Int = 1,

    /**
     * TG-P2-04 — 신규 컬럼.
     *
     * envelope 형식: KMS wrap(DEK). NULL 이면 Phase 1 단순 AES-GCM 형식 (deprecated, fallback 경로).
     */
    @Column(name = "dek_wrapped", nullable = true, columnDefinition = "VARBINARY(1024)")
    var dekWrapped: ByteArray? = null
)
