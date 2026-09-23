package com.kgd.ads.domain.token.policy

import com.kgd.ads.domain.campaign.model.BidType
import com.kgd.ads.domain.token.model.EventRejectReason
import com.kgd.ads.domain.token.model.ServeClaims
import com.kgd.ads.domain.token.model.ServedAd
import com.kgd.ads.domain.token.model.SigningKey
import com.kgd.ads.domain.token.model.TokenKind
import com.kgd.ads.domain.token.model.TokenVerification
import java.security.MessageDigest
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * 노출·클릭 토큰 — `base64url(내용).base64url(HMAC-SHA256)`. 서명만 하고 암호화하지 않는다.
 *
 * 서명 대상은 순서가 고정된 12개 값이다: 종류 · 결정 id · 캠페인 · 소재 · 광고주 · 지면 · 입찰 방식 ·
 * 1회 과금액 · 과금 여부 · 방문자 해시 · 발급 시각 · 키 id. 하나라도 빠지면 그 값은 위조할 수 있다.
 * 비교는 `MessageDigest.isEqual`(상수 시간). 검증은 현재 키와, 교체 중이면 이전 키를 키 id 로 고른다.
 */
class ServeTokenSigner(
    private val current: SigningKey,
    private val previous: SigningKey?,
    private val clock: Clock,
) {
    fun issue(kind: TokenKind, ad: ServedAd): String {
        listOf(ad.decisionId, ad.placementKey, ad.visitorHash).forEach {
            require(SAFE_VALUE.matches(it)) { "토큰 값에 쓸 수 없는 문자가 있습니다: $it" }
        }
        val payload = listOf(
            kind.name, ad.decisionId, ad.campaignId, ad.creativeId, ad.advertiserId, ad.placementKey,
            ad.bidType.name, ad.chargeMicros, if (ad.billable) "1" else "0", ad.visitorHash,
            clock.instant().epochSecond, current.id,
        ).joinToString(SEPARATOR).toByteArray()
        return ENCODER.encodeToString(payload) + "." + ENCODER.encodeToString(mac(current, payload))
    }

    fun verify(token: String, expectedKind: TokenKind, visitorHash: String): TokenVerification {
        val claims = verifiedClaims(token) ?: return rejected(EventRejectReason.INVALID_SIGNATURE, null)
        return when {
            claims.kind != expectedKind -> rejected(EventRejectReason.INVALID_SIGNATURE, null)
            clock.instant().isAfter(claims.issuedAt.plus(LIFETIME)) -> rejected(EventRejectReason.EXPIRED, claims)
            claims.ad.visitorHash != visitorHash -> rejected(EventRejectReason.VISITOR_MISMATCH, claims)
            !claims.ad.billable -> rejected(EventRejectReason.NOT_BILLABLE, claims)
            else -> TokenVerification.Accepted(claims)
        }
    }

    /** 서명이 맞을 때만 내용을 푼다. 형식이 깨졌거나 키를 모르거나 서명이 틀리면 null. */
    private fun verifiedClaims(token: String): ServeClaims? {
        val parts = token.split('.')
        if (parts.size != 2) return null
        val payload = decode(parts[0]) ?: return null
        val signature = decode(parts[1]) ?: return null
        val fields = String(payload).split(SEPARATOR)
        if (fields.size != FIELD_COUNT) return null
        val key = listOfNotNull(current, previous).firstOrNull { it.id == fields[11] } ?: return null
        if (!MessageDigest.isEqual(mac(key, payload), signature)) return null
        return parse(fields)
    }

    private fun parse(f: List<String>): ServeClaims? = runCatching {
        ServeClaims(
            kind = TokenKind.valueOf(f[0]),
            ad = ServedAd(
                decisionId = f[1],
                campaignId = f[2].toLong(),
                creativeId = f[3].toLong(),
                advertiserId = f[4].toLong(),
                placementKey = f[5],
                bidType = BidType.valueOf(f[6]),
                chargeMicros = f[7].toLong(),
                billable = f[8] == "1",
                visitorHash = f[9],
            ),
            issuedAt = Instant.ofEpochSecond(f[10].toLong()),
            keyId = f[11],
        )
    }.getOrNull()

    private fun mac(key: SigningKey, payload: ByteArray): ByteArray =
        Mac.getInstance(ALGORITHM).apply { init(SecretKeySpec(key.bytes(), ALGORITHM)) }.doFinal(payload)

    private fun decode(value: String): ByteArray? =
        try {
            Base64.getUrlDecoder().decode(value)
        } catch (e: IllegalArgumentException) {
            null
        }

    private fun rejected(reason: EventRejectReason, claims: ServeClaims?) = TokenVerification.Rejected(reason, claims)

    companion object {
        val LIFETIME: Duration = Duration.ofHours(2)
        private const val ALGORITHM = "HmacSHA256"
        private const val SEPARATOR = "|"
        private const val FIELD_COUNT = 12
        private val SAFE_VALUE = Regex("^[A-Za-z0-9._:-]{1,128}$")
        private val ENCODER = Base64.getUrlEncoder().withoutPadding()
    }
}
