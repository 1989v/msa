package com.kgd.quant.infrastructure.persistence.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

/**
 * TG-P2-04 — `notification_target` 테이블 매핑 Entity.
 *
 * Phase 1 V001 컬럼 + Phase 2 V002 envelope encryption 컬럼 매핑.
 *
 * ## 컬럼
 *  - `bot_token_cipher`:
 *      - Phase 2: AES-GCM(plaintext, DEK) ciphertext
 *      - Phase 1 fallback: 단순 AES-GCM(plaintext, KEK) ciphertext (`dek_wrapped IS NULL`)
 *  - `dek_wrapped`: KMS wrap 된 DEK. NULL 이면 Phase 1 deprecated.
 *  - `kek_version`: INT(1+) NOT NULL.
 *
 * ## 키
 *  - PK: `target_id` (BINARY(16))
 *  - 인덱스: `idx_notif_tenant`, `idx_notification_target_kek_version`
 */
@Entity
@Table(name = "notification_target")
class NotificationTargetEntity(
    @Id
    @Column(name = "target_id", columnDefinition = "BINARY(16)", nullable = false)
    var targetId: UUID = UUID.randomUUID(),

    @Column(name = "tenant_id", nullable = false, length = 64)
    var tenantId: String = "",

    @Column(name = "channel", nullable = false, length = 32)
    var channel: String = "",

    @Column(name = "bot_token_cipher", nullable = false, columnDefinition = "VARBINARY(1024)")
    var botTokenCipher: ByteArray = ByteArray(0),

    @Column(name = "chat_id", nullable = false, length = 128)
    var chatId: String = "",

    @Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now(),

    /** TG-P2-04 신규 — 사용 KEK 버전. INV-P2-11 NOT NULL. */
    @Column(name = "kek_version", nullable = false)
    var kekVersion: Int = 1,

    /** TG-P2-04 신규 — KMS wrap(DEK). NULL = Phase 1 fallback row. */
    @Column(name = "dek_wrapped", nullable = true, columnDefinition = "VARBINARY(1024)")
    var dekWrapped: ByteArray? = null
)
