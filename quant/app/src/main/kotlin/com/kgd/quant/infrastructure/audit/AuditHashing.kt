package com.kgd.quant.infrastructure.audit

import java.security.MessageDigest
import java.time.Instant

/**
 * TG-P2-05 / ADR-0026 — audit_log prev_hash chain 계산 유틸.
 *
 * publisher 와 verifier 모두 **같은 입력 형식** 으로 hash 를 계산해야 chain 이 일치한다.
 * 입력 형식: `prevHash || payloadJson || occurredAtIso || actor` (구분자 없음).
 *
 * `occurredAt` 직렬화는 [Instant.toString] (`2026-04-24T12:34:56.789Z` 형식, ISO-8601, UTC) 사용.
 * ClickHouse `DateTime64(3, 'UTC')` 와의 round-trip 일관성을 위해 verifier 는 ClickHouse 문자열 표현
 * (`2026-04-24 12:34:56.789`) 을 다시 [Instant] 로 파싱한 뒤 본 함수에 위임한다.
 */
internal object AuditHashing {
    /** prev_hash chain 의 시작점. SHA-256 출력 길이(64 hex) 와 동일한 0 으로 채운 문자열. */
    const val GENESIS_HASH: String = "0000000000000000000000000000000000000000000000000000000000000000"

    /** SHA-256(input) 의 hex(소문자) 표현. */
    fun sha256(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(input.toByteArray(Charsets.UTF_8))
        val sb = StringBuilder(digest.size * 2)
        for (b in digest) {
            sb.append(HEX_CHARS[(b.toInt() ushr 4) and 0xF])
            sb.append(HEX_CHARS[b.toInt() and 0xF])
        }
        return sb.toString()
    }

    /**
     * audit row 1건의 current_hash 계산.
     *
     * @param prevHash    직전 row 의 current_hash. 없으면 [GENESIS_HASH].
     * @param payloadJson AuditEvent.payloadJson 그대로.
     * @param occurredAt  AuditEvent.occurredAt — [Instant.toString] 로 직렬화.
     * @param actor       AuditEvent.actor 그대로.
     */
    fun computeCurrentHash(
        prevHash: String,
        payloadJson: String,
        occurredAt: Instant,
        actor: String,
    ): String = sha256(prevHash + payloadJson + occurredAt.toString() + actor)

    private val HEX_CHARS = "0123456789abcdef".toCharArray()
}
