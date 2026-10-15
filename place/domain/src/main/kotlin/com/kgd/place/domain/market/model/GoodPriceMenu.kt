package com.kgd.place.domain.market.model

data class GoodPriceMenu(val name: String, val price: Int?) {
    companion object {
        /** Source decoding belongs to the boundary; menu and price rules remain framework-free. */
        fun from(source: Map<String, String?>): List<GoodPriceMenu> = (1..4).mapNotNull { index ->
            val name = source["메뉴$index"]?.trim()?.takeIf { it.isNotEmpty() } ?: return@mapNotNull null
            val price = source["가격$index"]?.filter { it in '0'..'9' }?.toIntOrNull()
            GoodPriceMenu(name, price)
        }
    }
}
