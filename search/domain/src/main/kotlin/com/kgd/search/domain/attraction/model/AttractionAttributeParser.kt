package com.kgd.search.domain.attraction.model

import java.time.DayOfWeek

/**
 * 파서 입력. place 가 유형별 키를 이미 한 자리로 접어 둔 컬럼을 그대로 받는다.
 * [intro] 는 introRaw 를 펼친 것이고 신용카드·유모차 대여 키에만 쓴다 — 요금·주차·휴무를
 * 여기서 다시 찾으면 place 의 접기 규칙과 두 벌이 된다.
 */
data class AttractionAttributeSource(
    val restDate: String?,
    val parking: String?,
    val useFee: String?,
    val petAcmpyType: String?,
    val intro: Map<String, String?> = emptyMap(),
)

/**
 * TourAPI 원문(국·영) → [AttractionAttributes].
 *
 * 규칙은 운영 원문 표본에 나온 표기만 받아들이고, 나머지는 `UNKNOWN` 으로 둔다.
 * 긍정 판정은 필터가 되므로 넓게 잡기보다 틀리지 않는 쪽을 택했다.
 */
object AttractionAttributeParser {

    const val VERSION = 1

    fun parse(source: AttractionAttributeSource): AttractionAttributes = AttractionAttributes(
        regularClosure = regularClosure(source.restDate),
        parking = parking(source.parking),
        petPolicy = petPolicy(source.petAcmpyType),
        creditCard = check(firstValue(source.intro, CREDIT_CARD_KEYS)),
        strollerRental = check(firstValue(source.intro, STROLLER_KEYS)),
        freeAdmission = admission(source.useFee),
    )

    // ── 정기휴무 ──────────────────────────────────────────────

    private val KO_DAYS = mapOf(
        '월' to DayOfWeek.MONDAY, '화' to DayOfWeek.TUESDAY, '수' to DayOfWeek.WEDNESDAY,
        '목' to DayOfWeek.THURSDAY, '금' to DayOfWeek.FRIDAY, '토' to DayOfWeek.SATURDAY, '일' to DayOfWeek.SUNDAY,
    )
    private val EN_DAYS = DayOfWeek.entries.associateBy { it.name.lowercase() }
    private val WEEKEND = setOf(DayOfWeek.SATURDAY, DayOfWeek.SUNDAY)

    private val KO_ALWAYS_OPEN = Regex("""연중\s*(무휴|개방)""")
    private val EN_ALWAYS_OPEN = Regex("""(n/a\s*)?\(?\s*open\s+(all\s+year\s+round|24/7|24\s*hrs?)\s*\)?""")
    private val KO_WEEKLY = Regex("""(매주\s*)?([월화수목금토일])요일(\s*~\s*([월화수목금토일])요일)?""")
    private val EN_WEEKLY = Regex("""(closed\s+on\s+)?(every\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?""")
    private val EN_SHORT_DAY = Regex("""mon|tue|wed|thu|fri|sat|sun""")
    private val KO_HOLIDAY_WORDS = Regex("""1월\s*1일|설날|명절|추석|연휴|당일|신정|법정|공휴일|설|·|\s""")
    private val EN_HOLIDAY = Regex("""seollal|chuseok|january 1|new year|public holiday|national holiday""")

    // 격주·월 n회·다음날·전날처럼 요일을 확정할 수 없게 만드는 말. 휴일 문구와 섞여 있어도 UNKNOWN 이다.
    private val EN_CONDITIONAL = Regex(
        """month|week|every|once|twice|other|following|before|after|except|if|when|\d(st|nd|rd|th)""",
    )

    private fun regularClosure(raw: String?): RegularClosure {
        val main = mainText(raw) ?: return RegularClosure.Unknown
        // 「N/A (Open all year round)」「Open 24/7」은 빗금을 품고 있어 쪼개기 전에 통째로 본다
        if (KO_ALWAYS_OPEN.matches(main) || EN_ALWAYS_OPEN.matches(main)) return RegularClosure.AlwaysOpen

        val days = mutableSetOf<DayOfWeek>()
        for (segment in main.split(',', '/', '\n').map { it.trim() }.filter { it.isNotEmpty() }) {
            val weekly = weekdays(segment)
            when {
                weekly != null -> days += weekly
                isHoliday(segment) -> Unit
                else -> return RegularClosure.Unknown
            }
        }
        return RegularClosure.Weekly(days)
    }

    /**
     * `※`·`*` 뒤는 「자세한 사항은 전화문의」 같은 덧붙임이라 버린다. 남은 것이 없으면 null.
     * 쉼표·빗금·줄바꿈이 항목 구분자다(`·` 는 「설·추석」 안에 있어 구분자가 아니다).
     */
    private fun mainText(raw: String?): String? {
        val text = stripTags(raw ?: return null).substringBefore('※').substringBefore('*')
        return text.trim().lowercase().takeIf { it.isNotEmpty() }
    }

    private fun weekdays(segment: String): Set<DayOfWeek>? {
        KO_WEEKLY.matchEntire(segment)?.let { m ->
            val from = KO_DAYS.getValue(m.groupValues[2][0])
            val to = m.groupValues[4].firstOrNull()?.let { KO_DAYS.getValue(it) } ?: from
            return range(from, to)
        }
        if (segment == "주말" || segment == "weekend" || segment == "weekends") return WEEKEND
        EN_WEEKLY.matchEntire(segment)?.let { return setOf(EN_DAYS.getValue(it.groupValues[3])) }
        if (EN_SHORT_DAY.matches(segment)) return setOf(DayOfWeek.entries.first { it.name.lowercase().startsWith(segment) })
        return null
    }

    private fun range(from: DayOfWeek, to: DayOfWeek): Set<DayOfWeek> {
        val days = mutableSetOf(from)
        var day = from
        while (day != to) {
            day = day.plus(1)
            days += day
        }
        return days
    }

    private fun isHoliday(segment: String): Boolean =
        KO_HOLIDAY_WORDS.replace(segment, "").isEmpty() ||
            (EN_HOLIDAY.containsMatchIn(segment) && !EN_CONDITIONAL.containsMatchIn(segment))

    // ── 주차 ─────────────────────────────────────────────────

    private val PARKING_NO = Regex("""^(불가|없음|not available|no\s|n/a)""")
    private val PARKING_YES = Regex("""^(가능|있음|주차장\s*있음|available|y(\s|\(|$))""")

    private fun parking(raw: String?): Availability {
        val text = stripTags(raw ?: return Availability.UNKNOWN).trim().lowercase()
        return when {
            // 「불가능」이 「가능」을 품고 있어 부정을 먼저 본다
            PARKING_NO.containsMatchIn(text) -> Availability.NO
            PARKING_YES.containsMatchIn(text) -> Availability.YES
            else -> Availability.UNKNOWN
        }
    }

    // ── 반려동물 ──────────────────────────────────────────────

    private val PET_POLICY = mapOf(
        "전구역동반가능" to PetPolicy.ALLOWED,
        "일부구역동반가능" to PetPolicy.PARTIAL,
    )

    private fun petPolicy(raw: String?): PetPolicy =
        PET_POLICY[raw.orEmpty().filterNot { it.isWhitespace() }] ?: PetPolicy.UNKNOWN

    // ── 신용카드 · 유모차 대여 (introRaw chk*) ──────────────────

    private val CREDIT_CARD_KEYS = listOf(
        "chkcreditcard", "chkcreditcardculture", "chkcreditcardfood", "chkcreditcardleports", "chkcreditcardshopping",
    )
    private val STROLLER_KEYS = listOf(
        "chkbabycarriage", "chkbabycarriageculture", "chkbabycarriageleports", "chkbabycarriageshopping",
    )

    private val CHECK_YES = setOf("가능", "있음", "모든카드사용가능")

    // 「없음」을 NO 로 읽는 것은 가정이다 — 원천이 「해당 없음」과 「정보 없음」을 가르지 않는다.
    // 사람 라벨 정확도 측정에서 맞는지 확인한다.
    private val CHECK_NO = setOf("불가", "불가능", "없음", "불가(현금만가능)")

    private fun firstValue(intro: Map<String, String?>, keys: List<String>): String? =
        keys.firstNotNullOfOrNull { key -> intro[key]?.takeIf { it.isNotBlank() } }

    private fun check(raw: String?): Availability {
        val text = raw?.filterNot { it.isWhitespace() } ?: return Availability.UNKNOWN
        return when (text) {
            in CHECK_YES -> Availability.YES
            in CHECK_NO -> Availability.NO
            else -> Availability.UNKNOWN
        }
    }

    // ── 입장 무료 ──────────────────────────────────────────────

    private val STARTS_FREE = Regex("""^(무료|free(?![a-z]))""")
    private val AMOUNT = Regex("""\d[\d,.]*\s*(원|won)|krw\s*\d|유료|paid""")

    /**
     * 금액이 없는 무료만 FREE. 「어른 3,000원 … ※ 무료: 6세 이하」처럼 감면 대상만 무료인 원문이
     * 흔해서, 무료로 시작하지 않으면 금액이 이긴다. 무료로 시작하는데 금액도 있으면(층별 유료 등) 모른다.
     * 관광지(12)·레포츠(28)는 접힌 요금 컬럼이 비어 여기로 오기 전에 UNKNOWN 이 된다.
     */
    private fun admission(raw: String?): Admission {
        val text = stripTags(raw ?: return Admission.UNKNOWN).trim().lowercase()
        val startsFree = STARTS_FREE.containsMatchIn(text)
        val hasAmount = AMOUNT.containsMatchIn(text)
        return when {
            startsFree && !hasAmount -> Admission.FREE
            startsFree -> Admission.UNKNOWN
            hasAmount -> Admission.PAID
            else -> Admission.UNKNOWN
        }
    }

    // ── 공통 ─────────────────────────────────────────────────

    private val TAG = Regex("""<[^>]*>""")

    /** 원천 줄바꿈 태그(`<br>`, `<br />`)는 항목 구분이라 줄바꿈으로 바꾼다. */
    private fun stripTags(raw: String): String = TAG.replace(raw, "\n")
}
