package com.kgd.place.application.market.dto

import com.kgd.place.domain.market.model.MarketStore
import com.kgd.place.domain.market.model.MarketStoreNumber
import tools.jackson.databind.json.JsonMapper

/**
 * 가게 번호는 온누리 원문의 「주소」에만 있다 — 상가정보와 맞춘 행은 지번주소 칸이 상가정보 주소로 바뀌어 있다.
 * 공개 조회는 원문 대신 [MarketStore.onnuriAddress] 를 채우고, 원문 전체를 읽은 행은 원문에서 꺼낸다.
 */
object MarketStoreNumberProjection {
    private val json = JsonMapper.builder().build()
    private val parcel = Regex("""(\d+(?:-\d+)?)\s*$""")

    fun from(store: MarketStore, marketName: String?): String? {
        val address = store.onnuriAddress ?: store.onnuriRaw?.takeIf { it != MarketStore.RAW_OMITTED }
            ?.let { json.readTree(it)["주소"]?.takeUnless { node -> node.isNull }?.asText() } ?: return null
        val matchedParcel = store.jibunAddress?.takeIf { it != address }?.let { parcel.find(it)?.groupValues?.get(1) }
        return MarketStoreNumber.parse(address, marketName, matchedParcel)
    }
}
