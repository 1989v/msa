package com.kgd.place.domain.market.model

/**
 * 시장이 가게에 붙인 번호(「5-21호」「A동 101호」「1층 3호」). 온누리 가맹점 주소 끝에 상인이 적어 둔 것이 유일한 출처다 —
 * 상가정보의 호정보는 시장 가게에서 비어 있다. 주소 앞부분(지번·도로명 번호)을 건너뛴 뒤에서만 찾는다.
 * 모양이 번호로 읽히지 않으면 null 이다 — 틀린 번호를 보이느니 없는 편이 낫다.
 */
object MarketStoreNumber {
    private const val LETTER = "[A-Za-z가나다라마바사아자차카타파하]"
    private const val NUM = """\d{1,4}(?:-\d{1,4})?"""
    private val jibun = Regex("""^.+?[가-힣](?:동\d+가|로\d+가|\d?동|리|가)\s?\d+(?:-\d+)?(?!\d)""")
    private val road = Regex("""^.+?(?:로|길)(?:\s?\d+번?길)?\s?\d+(?:-\d+)?(?!\d)""")
    // 앞 글자가 한글이면 낱자 동 이름이 아니다(「상가49호」의 「가」). 단 「시장나-45호」처럼 바로 하이픈이 오면 동 이름이다.
    private const val LETTER_PREFIX = "(?:(?<![가-힣])$LETTER|$LETTER(?=-))"
    private val ho = Regex("""(?:(${LETTER}동|\d{1,4}동)\s?)?(?:(지하|B?\d{1,2}층)\s?)?((?:$LETTER_PREFIX-?)?$NUM(?:호?\s?[~,.]\s?$NUM)*호)""")
    // 「호」가 없을 때는 동 이름과 번호가 함께 있거나(「4동-8」) 번호 자체에 문자·하이픈이 있을 때(「A-7」「5-21」)만 번호로 본다.
    private val bare = listOf(Regex("""^(${LETTER}동|\d{1,2}동)-?(\d{1,4})$"""),
        Regex("""^(?:(${LETTER}동)\s?)?($LETTER-?\d{1,4}|\d{1,2}-\d{1,4})$"""))
    private val filler = Regex("""^(?:번지|[.,]|내|상가|시장|지하|\(|\))+""")

    /** [parcel] 은 상가정보와 맞춘 필지 번호(「339-2」) — 주소에 숫자가 붙어 있을 때(「339-24동-8」) 경계를 정한다. */
    fun parse(address: String?, marketName: String?, parcel: String? = null): String? {
        val text = address?.replace(Regex("""\s+"""), " ")?.trim().orEmpty()
        if (text.isEmpty()) return null
        val tail = tail(text, parcel)
        ho.find(tail)?.let { match -> return match.groupValues.drop(1).filter { it.isNotEmpty() }.joinToString(" ") }
        var rest = tail.replace(" ", "")
        val name = marketName?.replace(" ", "").orEmpty()
        if (name.isNotEmpty() && name in rest) rest = rest.substringAfter(name)
        rest = rest.replace(filler, "").trimEnd('.', ',', ')')
        return bare.firstNotNullOfOrNull { it.matchEntire(rest) }?.groupValues?.drop(1)?.filter { it.isNotEmpty() }?.joinToString(" ")
    }

    private fun tail(text: String, parcel: String?): String {
        val squashed = text.replace(" ", "")
        if (!parcel.isNullOrBlank()) {
            val index = squashed.indexOf(parcel)
            if (index >= 0) return squashed.substring(index + parcel.length)
        }
        return listOfNotNull(jibun.find(text), road.find(text)).minByOrNull { it.range.last }
            ?.let { text.substring(it.range.last + 1) } ?: text
    }
}
