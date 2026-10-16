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

    // 온누리는 시도를 「서울특별시」「서울시」「서울」「경북」처럼 섞어 쓰고 상가정보는 정식 명칭만 쓴다.
    private val sidoPrefixes = listOf("서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "제주",
        "충북", "충남", "전북", "전남", "경북", "경남")
    private val sidoLongNames = mapOf("충청북도" to "충북", "충청남도" to "충남", "전라북도" to "전북", "전라남도" to "전남",
        "경상북도" to "경북", "경상남도" to "경남")

    fun normalized(value: String): String =
        Normalizer.normalize(value, Normalizer.Form.NFKC).replace(whitespace, "").lowercase(Locale.ROOT)

    /** Lot address with its leading 시도 reduced to the short name, then [normalized]. */
    private fun lotAddress(value: String): String {
        val trimmed = Normalizer.normalize(value, Normalizer.Form.NFKC).trim()
        val first = trimmed.substringBefore(' ')
        val sido = sidoLongNames[first] ?: sidoPrefixes.firstOrNull { first.startsWith(it) }
        return normalized(if (sido == null || first == trimmed) trimmed else sido + " " + trimmed.substringAfter(' '))
    }

    /** Null for rows that are never paired: manual entries and rows without a lot address. */
    fun key(store: MarketStore): String? {
        if (store.source == MarketStoreSource.MANUAL) return null
        val jibun = store.jibunAddress?.let(::lotAddress)?.takeIf { it.isNotEmpty() } ?: return null
        val digest = MessageDigest.getInstance("SHA-256").digest("${normalized(store.name)}\n$jibun".toByteArray())
        return digest.joinToString("") { "%02x".format(it) }
    }
}
