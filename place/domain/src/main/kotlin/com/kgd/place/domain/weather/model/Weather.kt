package com.kgd.place.domain.weather.model

import java.time.Duration
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.temporal.ChronoUnit
import kotlin.math.roundToInt

/**
 * 시군구 하나의 날씨 단위 — 대표점이 떨어지는 기상청 단기예보 격자와 중기예보 구역(육상 권역 · 기온 regId).
 * 매핑은 수집기(place-ingest `weather_grid`)가 계산해 보낸다. [taMatch] 는 기온 regId 를 고른 근거(NAME · METRO · NEAREST)다.
 */
data class WeatherArea(
    val sigunguCode: String,
    val nx: Int,
    val ny: Int,
    val landRegId: String?,
    val taRegId: String?,
    val taMatch: String?,
)

/** 중기예보 종류 — 육상(`getMidLandFcst`, 하늘·강수확률) · 기온(`getMidTa`, 최저·최고). */
enum class MidKind { LAND, TA }

/** 중기 구역 — 기상청 구역코드표 한 줄. */
data class MidRegion(val regId: String, val kind: MidKind, val name: String)

/** 단기예보 원천 한 행(범주 하나 · 예보 시각 하나). [fcstTime] 은 원천 `HHmm` 을 수로(0600 → 600). */
data class ShortForecastItem(val category: String, val fcstDate: LocalDate, val fcstTime: Int, val value: String) {
    val hour: Int get() = fcstTime / 100
}

/** 격자 하나의 단기 발표본 하나. */
data class ShortForecast(val nx: Int, val ny: Int, val baseAt: LocalDateTime, val items: List<ShortForecastItem>)

/** 중기 구역 하나의 발표본 하나 — 원천 키 → 값(문자열) 그대로. */
data class MidForecast(val regId: String, val kind: MidKind, val tmFc: LocalDateTime, val fields: Map<String, String?>)

enum class WeatherSource { SHORT, MID }

/** 반나절(또는 하루) 날씨 — [sky] 는 기상청 중기예보 표현(맑음 · 구름많음 · 흐리고 비 …), [pop] 은 강수확률(%). */
data class HalfDay(val sky: String, val pop: Int?)

/**
 * 하루 날씨. 단기 날은 오전/오후([am]/[pm]), 중기 4~7일은 오전/오후, 8~10일은 하루 하나([allDay])다 — 원천이 그렇게 준다.
 * 값이 없는 칸은 null 이다(17시 발표의 오늘은 오후 일부뿐이고 최저·최고가 없다). 0 으로 채우지 않는다.
 */
data class DailyWeather(
    val date: LocalDate,
    val source: WeatherSource,
    val min: Int?,
    val max: Int?,
    val am: HalfDay? = null,
    val pm: HalfDay? = null,
    val allDay: HalfDay? = null,
)

/**
 * 시군구 날씨 「오늘 ~ 10일」 — 단기(발표일 ~ 글피)와 중기(06시 발표 4~10일 뒤)를 날짜로 잇는다.
 * 같은 날짜는 단기가 이긴다(시간 단위라 더 자세하다).
 */
object WeatherOutlook {
    /** 단기는 발표일부터 글피(+3일)까지 쓴다. 그 뒤 날의 몇 시간(17시 발표는 +4일 낮까지)은 하루가 안 차서 그리지 않는다. */
    const val SHORT_LAST_DAY = 3L
    const val MID_FIRST_DAY = 4
    const val MID_LAST_DAY = 10
    /** 중기 육상은 7일 뒤까지 오전/오후, 그 뒤는 하루 하나다. */
    const val MID_HALF_LAST_DAY = 7

    /** 단기예보는 발표 24시간이 지나면 그리지 않는다(설계 §4). */
    val SHORT_FRESH: Duration = Duration.ofHours(24)

    /** 중기는 하루 한 번(06시) 발표라 24시간 + 수집 지연 여유. */
    val MID_FRESH: Duration = Duration.ofHours(30)

    private val PRECIPITATION = mapOf(1 to "비", 2 to "비/눈", 3 to "눈", 4 to "소나기")
    private val SKY = mapOf(1 to "맑음", 3 to "구름많음", 4 to "흐림")

    /**
     * 단기 코드 → 중기와 같은 표현. 강수형태(PTY)가 있으면 「구름많고 비」「흐리고 눈」, 없으면 하늘상태(SKY)만.
     * 모르는 코드면 null — 지어내지 않는다.
     */
    fun skyText(sky: Int?, pty: Int?): String? {
        val rain = pty?.let { PRECIPITATION[it] }
        if (rain != null) return if (sky == 4) "흐리고 $rain" else "구름많고 $rain"
        return sky?.let { SKY[it] }
    }

    fun shortDays(forecast: ShortForecast): List<DailyWeather> {
        val first = forecast.baseAt.toLocalDate()
        return forecast.items
            .groupBy { it.fcstDate }
            .filterKeys { ChronoUnit.DAYS.between(first, it) in 0..SHORT_LAST_DAY }
            .toSortedMap()
            .map { (date, items) ->
                DailyWeather(
                    date = date,
                    source = WeatherSource.SHORT,
                    min = items.firstOrNull { it.category == "TMN" }?.value?.toDoubleOrNull()?.roundToInt(),
                    max = items.firstOrNull { it.category == "TMX" }?.value?.toDoubleOrNull()?.roundToInt(),
                    am = half(items.filter { it.hour < 12 }),
                    pm = half(items.filter { it.hour >= 12 }),
                )
            }
    }

    /** 반나절 — 하늘은 가장 잦은 값(같으면 더 흐린 쪽), 강수형태는 한 시각이라도 있으면 가장 잦은 것, 강수확률은 최댓값. */
    private fun half(items: List<ShortForecastItem>): HalfDay? {
        fun codes(category: String) = items.filter { it.category == category }.mapNotNull { it.value.toIntOrNull() }
        fun mostFrequent(values: List<Int>) = values.groupingBy { it }.eachCount()
            .maxWithOrNull(compareBy<Map.Entry<Int, Int>> { it.value }.thenBy { it.key })?.key
        val sky = mostFrequent(codes("SKY")) ?: return null
        val pty = mostFrequent(codes("PTY").filter { it != 0 })
        val text = skyText(sky, pty) ?: return null
        return HalfDay(text, codes("POP").maxOrNull())
    }

    fun midDays(land: MidForecast?, ta: MidForecast?): List<DailyWeather> {
        val dates = sortedSetOf<LocalDate>()
        fun dateOf(f: MidForecast, n: Int): LocalDate = f.tmFc.toLocalDate().plusDays(n.toLong())
        val byDate = mutableMapOf<LocalDate, DailyWeather>()
        for (n in MID_FIRST_DAY..MID_LAST_DAY) {
            land?.let { f ->
                val date = dateOf(f, n)
                val day = byDate[date] ?: DailyWeather(date, WeatherSource.MID, null, null)
                byDate[date] = if (n <= MID_HALF_LAST_DAY) {
                    day.copy(am = midHalf(f, "wf${n}Am", "rnSt${n}Am"), pm = midHalf(f, "wf${n}Pm", "rnSt${n}Pm"))
                } else {
                    day.copy(allDay = midHalf(f, "wf$n", "rnSt$n"))
                }
                dates += date
            }
            ta?.let { f ->
                val date = dateOf(f, n)
                val day = byDate[date] ?: DailyWeather(date, WeatherSource.MID, null, null)
                byDate[date] = day.copy(min = f.int("taMin$n"), max = f.int("taMax$n"))
                dates += date
            }
        }
        return dates.mapNotNull { byDate[it] }
            .filter { it.min != null || it.max != null || it.am != null || it.pm != null || it.allDay != null }
    }

    private fun midHalf(f: MidForecast, sky: String, pop: String): HalfDay? =
        f.fields[sky]?.takeIf { it.isNotBlank() }?.let { HalfDay(it, f.int(pop)) }

    private fun MidForecast.int(key: String): Int? = fields[key]?.toDoubleOrNull()?.roundToInt()

    /** 단기 날 + 단기에 없는 날짜의 중기 날, 날짜순. */
    fun days(short: ShortForecast?, land: MidForecast?, ta: MidForecast?): List<DailyWeather> {
        val shortDays = short?.let { shortDays(it) }.orEmpty()
        val covered = shortDays.map { it.date }.toSet()
        return (shortDays + midDays(land, ta).filter { it.date !in covered }).sortedBy { it.date }
    }

    /** 중기 두 발표 중 오래된 쪽 — 신선도는 이 값으로 잰다(한쪽만 새로워도 둘을 섞어 그리지 않게). */
    fun midIssuedAt(land: MidForecast?, ta: MidForecast?): LocalDateTime? = listOfNotNull(land?.tmFc, ta?.tmFc).minOrNull()

    fun isFresh(issuedAt: LocalDateTime?, limit: Duration, now: LocalDateTime): Boolean =
        issuedAt != null && !now.isAfter(issuedAt.plus(limit))

    /**
     * 화면에 낼 날인가 — 지난 날짜가 아니고(오늘은 낸다), 그 날의 원천 발표가 신선도 기준 안이다.
     * 기준을 넘긴 값은 0 으로 그리지 않고 뺀다 — 남는 날이 없으면 화면이 절을 숨긴다.
     */
    fun visible(date: LocalDate, source: WeatherSource, shortBaseAt: LocalDateTime?, midTmFc: LocalDateTime?, now: LocalDateTime): Boolean =
        !date.isBefore(now.toLocalDate()) && when (source) {
            WeatherSource.SHORT -> isFresh(shortBaseAt, SHORT_FRESH, now)
            WeatherSource.MID -> isFresh(midTmFc, MID_FRESH, now)
        }
}
