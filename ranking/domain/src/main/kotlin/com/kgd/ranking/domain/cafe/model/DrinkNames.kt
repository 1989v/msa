package com.kgd.ranking.domain.cafe.model

/**
 * Strip only explicit boundary presentation tokens. 디카페인 is stripped too because caffeine status already
 * keeps it as a separate variant of the same drink; recipe words (빅, 빽사이즈) stay.
 */
object DrinkNames {
    private const val token = "HOT|ICED|ICE|핫|아이스|S|R|M|L|XL|EX|K|Tall|Grande|Venti|Short|Regular|Large|스몰|레귤러|미디엄|라지|점보"
    private val prefix = Regex("^(?:[HI]-|\\((?:$token)\\)\\s*|(?:HOT|ICED|ICE|핫|아이스)\\s+|디카페인\\s*(?=\\S))", RegexOption.IGNORE_CASE)
    private val spellings = listOf(Regex("마키아또|마끼야또|마키아토|마끼아토") to "마끼아또", Regex("라테") to "라떼")
    private val suffix = Regex("(?:\\s*\\((?:$token)(?:/(?:$token))*\\)|\\s+(?:$token))$", RegexOption.IGNORE_CASE)
    fun normalize(menuName: String): String {
        var name = menuName.trim().replace(Regex("\\s+"), " ")
        do {
            val previous = name
            name = name.replace(prefix, "").replace(suffix, "").trim()
        } while (name != previous)
        val compact = name.ifBlank { menuName.trim() }.replace(Regex("\\s+"), "")
        return spellings.fold(compact) { acc, (pattern, canonical) -> acc.replace(pattern, canonical) }
    }
}
