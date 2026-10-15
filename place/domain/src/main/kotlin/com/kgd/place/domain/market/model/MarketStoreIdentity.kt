package com.kgd.place.domain.market.model

import java.security.MessageDigest
import java.text.Normalizer
import java.util.Locale

/**
 * One shop listed by two sources (온누리 가맹점 + 상가정보) shares a normalized name and lot address.
 * The public projection pairs rows by this, and the same key is stored as a derived column so search
 * can pair them with an indexed equality instead of normalizing every row in SQL.
 */
object MarketStoreIdentity {
    private val whitespace = Regex("\\s+")

    fun normalized(value: String): String =
        Normalizer.normalize(value, Normalizer.Form.NFKC).replace(whitespace, "").lowercase(Locale.ROOT)

    /** Null for rows that are never paired: manual entries and rows without a lot address. */
    fun key(store: MarketStore): String? {
        if (store.source == MarketStoreSource.MANUAL) return null
        val jibun = store.jibunAddress?.let(::normalized)?.takeIf { it.isNotEmpty() } ?: return null
        val digest = MessageDigest.getInstance("SHA-256").digest("${normalized(store.name)}\n$jibun".toByteArray())
        return digest.joinToString("") { "%02x".format(it) }
    }
}
