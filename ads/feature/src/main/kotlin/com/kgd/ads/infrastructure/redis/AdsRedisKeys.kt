package com.kgd.ads.infrastructure.redis

import com.kgd.ads.domain.placement.model.FillSource
import com.kgd.ads.domain.token.model.TokenKind
import com.kgd.ads.domain.token.policy.ServeTokenSigner
import java.time.Duration
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

/**
 * ads Redis 키 이름과 수명 — 한 곳에서만 정한다. 결정이 읽고, 이벤트 수락이 올리고, 집계가 읽는 키가 같아야 한다.
 * 모든 키는 `ads:` 로 시작하고 TTL 을 갖는다. 날짜·시각은 KST.
 *
 * [VISITOR_FREQUENCY_TTL_HOURS] 는 방문자 해시가 Redis 에 남는 최대 시간이라 개인정보처리방침 §6 문구와 같아야 한다.
 */
object AdsRedisKeys {
    /** 방문자×캠페인 하루 빈도 키의 수명. KST 하루(24시간) + 경계 여유 1시간. */
    const val VISITOR_FREQUENCY_TTL_HOURS = 25L

    /** 지출·지면 카운터의 수명. 정산 지연 한도(6시간)와 집계 주기보다 넉넉히 길다. */
    const val COUNTER_TTL_HOURS = 48L

    private const val PREFIX = "ads:"
    private val DAY: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyyMMdd")
    private val HOUR: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyyMMddHH")
    private val MINUTE: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyyMMddHHmm")

    /** 방문자가 그 날 그 캠페인의 가시 노출을 수락받은 횟수. */
    fun frequency(visitorHash: String, campaignId: Long, day: LocalDate): String =
        "${PREFIX}freq:${DAY.format(day)}:$campaignId:$visitorHash"

    /** 캠페인의 그 시각 수락 지출(마이크로). */
    fun campaignHourSpend(campaignId: Long, hour: LocalDateTime): String =
        "${PREFIX}spend:cmp:$campaignId:${HOUR.format(hour)}"

    /** 광고주의 그 시각 수락 지출(마이크로) — 지갑 여유 계산용. */
    fun advertiserHourSpend(advertiserId: Long, hour: LocalDateTime): String =
        "${PREFIX}spend:adv:$advertiserId:${HOUR.format(hour)}"

    /** 지면의 그 시각 카운터(해시) — 필드 [FIELD_REQUESTS]·[FIELD_PAID_FILLED]. */
    fun placementHour(placementKey: String, hour: LocalDateTime): String =
        "${PREFIX}plc:${HOUR.format(hour)}:$placementKey"

    /** 그 시각 미등록 지면 키별 요청 수(해시, 필드 = 지면 키). */
    fun unregisteredHour(hour: LocalDateTime): String =
        "${PREFIX}unreg:${HOUR.format(hour)}"

    const val FIELD_REQUESTS = "requests"
    const val FIELD_PAID_FILLED = "paid_filled"

    /** 화면이 보고한 최종 채움 출처 필드 — `reported_paid`·`reported_adsense`·`reported_house`·`reported_empty`. */
    fun reportedFillField(source: FillSource): String = "reported_${source.name.lowercase()}"

    /** 한 시각의 미등록 지면 키 해시가 가질 수 있는 필드 수. 요청이 정하는 키라 상한 없이 두면 해시가 끝없이 자란다. */
    const val MAX_UNREGISTERED_FIELDS_PER_HOUR = 200

    /**
     * 토큰 하나의 일회성 표식. 수명은 토큰 수명보다 길어야 한다 — 짧으면 표식이 먼저 사라져 같은 토큰을 다시 받는다.
     * 그래서 토큰 수명에서 유도한다(2시간 + 1시간).
     */
    val ONE_TIME_MARKER_TTL: Duration = ServeTokenSigner.LIFETIME.plusHours(1)

    fun oneTimeMarker(kind: TokenKind, decisionId: String, placementKey: String): String =
        "${PREFIX}once:${kind.name}:$decisionId:$placementKey"

    /**
     * 그 시각의 소재×지면 수락 카운터(해시) — 시각 하나에 해시 하나라 집계가 시각마다 한 번에 읽는다.
     * 필드는 [creativeFieldPrefix] + `:` + [METRIC_IMPRESSIONS]·[METRIC_CLICKS]·[METRIC_SPEND].
     */
    fun creativeHour(hour: LocalDateTime): String = "${PREFIX}cr:${HOUR.format(hour)}"

    /** `{소재}:{캠페인}:{광고주}:{지면}` — 집계 행에 필요한 식별자를 필드 이름이 다 갖는다. */
    fun creativeFieldPrefix(creativeId: Long, campaignId: Long, advertiserId: Long, placementKey: String): String =
        "$creativeId:$campaignId:$advertiserId:$placementKey"

    const val METRIC_IMPRESSIONS = "imp"
    const val METRIC_CLICKS = "clk"
    const val METRIC_SPEND = "spend"

    /** 클릭 속도 제한 창의 방문자 클릭 수. 창이 끝난 뒤에도 조금 남도록 창 길이의 두 배를 수명으로 둔다. */
    fun clickRate(visitorHash: String, windowStart: LocalDateTime): String =
        "${PREFIX}clkrate:${MINUTE.format(windowStart)}:$visitorHash"

    val CLICK_RATE_TTL: Duration = Duration.ofMinutes(20)
}
