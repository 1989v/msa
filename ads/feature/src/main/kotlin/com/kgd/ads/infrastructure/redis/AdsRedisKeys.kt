package com.kgd.ads.infrastructure.redis

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
}
