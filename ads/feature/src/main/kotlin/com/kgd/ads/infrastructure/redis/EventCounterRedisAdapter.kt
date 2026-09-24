package com.kgd.ads.infrastructure.redis

import com.kgd.ads.application.event.dto.AcceptanceBatch
import com.kgd.ads.application.event.dto.AcceptanceOutcome
import com.kgd.ads.application.event.port.EventCounterPort
import com.kgd.ads.domain.token.model.TokenKind
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.data.redis.core.script.RedisScript
import org.springframework.stereotype.Component
import java.time.Duration

/**
 * 이벤트 수락 — 스크립트 한 번이 일회성 표식·클릭 속도·예산을 확인하고 수락한 것만 카운터에 올린다.
 * 확인과 증가가 한 스크립트 안이라 동시에 들어온 요청이 같은 여유를 두 번 쓰지 못한다.
 *
 * 연결은 결정과 같은 ads 전용 연결(명령 250ms)이다. 실패는 종류와 무관하게 null — 이벤트를 받지 않는다.
 */
@Component
class EventCounterRedisAdapter(
    private val redis: AdsRedisConnection,
) : EventCounterPort {

    private val log = KotlinLogging.logger {}

    override fun accept(batch: AcceptanceBatch): List<AcceptanceOutcome>? {
        val keys = mutableListOf<String>()
        val keyIndex = mutableMapOf<String, Int>()
        fun ref(key: String): String = keyIndex.getOrPut(key) { keys += key; keys.size }.toString()

        val campaignSlots = batch.budgets.keys.withIndex().associate { (i, id) -> id to (i + 1) }
        val campaignArgs = batch.budgets.flatMap { (campaignId, budget) ->
            listOf(
                budget.dailyRemainingMicros.toString(),
                budget.totalRemainingMicros?.toString() ?: NO_LIMIT,
                budget.hourlyCapMicros.toString(),
                ref(AdsRedisKeys.campaignHourSpend(campaignId, batch.hour)),
                budget.unsettledHoursToday.size.toString(),
            ) + budget.unsettledHoursToday.map { ref(AdsRedisKeys.campaignHourSpend(campaignId, it)) } +
                budget.unsettledHoursEarlier.size.toString() +
                budget.unsettledHoursEarlier.map { ref(AdsRedisKeys.campaignHourSpend(campaignId, it)) }
        }
        val creativeKey = AdsRedisKeys.creativeHour(batch.hour)
        val eventArgs = batch.events.flatMap { event ->
            val ad = event.ad
            listOf(
                requireNotNull(campaignSlots[ad.campaignId]) { "예산 한도 없는 캠페인: ${ad.campaignId}" }.toString(),
                event.chargeMicros.toString(),
                ref(AdsRedisKeys.oneTimeMarker(event.kind, ad.decisionId, ad.placementKey)),
                ref(AdsRedisKeys.advertiserHourSpend(ad.advertiserId, batch.hour)),
                ref(creativeKey),
                AdsRedisKeys.creativeFieldPrefix(ad.creativeId, ad.campaignId, ad.advertiserId, ad.placementKey),
                if (event.kind == TokenKind.IMP) AdsRedisKeys.METRIC_IMPRESSIONS else AdsRedisKeys.METRIC_CLICKS,
                // 방문자 빈도는 가시 노출을 수락할 때만 센다
                if (event.kind == TokenKind.IMP) ref(AdsRedisKeys.frequency(ad.visitorHash, ad.campaignId, batch.hour.toLocalDate())) else "0",
                batch.clickRate?.takeIf { event.kind == TokenKind.CLK }?.let { ref(AdsRedisKeys.clickRate(it.visitorHash, it.windowStart)) } ?: "0",
            )
        }
        val fillArgs = batch.fills.flatMap { (placementKey, source) ->
            listOf(ref(AdsRedisKeys.placementHour(placementKey, batch.hour)), AdsRedisKeys.reportedFillField(source), "1")
        }
        val args = listOf(
            AdsRedisKeys.ONE_TIME_MARKER_TTL.toMillis().toString(),
            Duration.ofHours(AdsRedisKeys.COUNTER_TTL_HOURS).seconds.toString(),
            Duration.ofHours(AdsRedisKeys.VISITOR_FREQUENCY_TTL_HOURS).seconds.toString(),
            AdsRedisKeys.CLICK_RATE_TTL.seconds.toString(),
            (batch.clickRate?.limit ?: 0).toString(),
            batch.budgets.size.toString(),
            batch.events.size.toString(),
            batch.fills.size.toString(),
        ) + campaignArgs + eventArgs + fillArgs

        val codes = try {
            redis.template.execute(ACCEPT, keys, *args.toTypedArray())
        } catch (e: RuntimeException) {
            log.warn { "ads Redis 이벤트 수락 실패: ${e.javaClass.simpleName} ${e.message}" }
            return null
        }
        if (codes == null || codes.size != batch.events.size) {
            log.warn { "ads Redis 이벤트 수락 응답 이상: expected=${batch.events.size} actual=${codes?.size}" }
            return null
        }
        return codes.map { OUTCOMES[(it as Long).toInt()] }
    }

    private companion object {
        const val NO_LIMIT = "none"

        /** 스크립트가 돌려주는 번호 순서. */
        val OUTCOMES = listOf(AcceptanceOutcome.ACCEPTED, AcceptanceOutcome.DUPLICATE, AcceptanceOutcome.OVER_BUDGET, AcceptanceOutcome.RATE_LIMITED)

        /**
         * ARGV 머리 8개: 표식 TTL(ms) · 카운터 TTL(초) · 빈도 TTL(초) · 클릭 속도 TTL(초) · 클릭 속도 한도 · 캠페인 수 · 이벤트 수 · 채움 수.
         * 캠페인마다(가변): 일예산 남은 몫 · 총예산 남은 몫(없으면 `none`) · 시간당 상한 · 이번 시각 지출 키 ·
         *   오늘 미정산 키 수 + 키들 · 이전 날 미정산 키 수 + 키들.
         * 이벤트마다(9개): 캠페인 번호 · 청구액 · 표식 키 · 광고주 시각 지출 키 · 소재 시각 해시 키 · 필드 머리 · 지표 이름 ·
         *   빈도 키(없으면 0) · 클릭 속도 키(없으면 0).
         * 채움마다(3개): 지면 시각 해시 키 · 필드 · 증가량.
         * 키 자리는 KEYS 번호다. 반환은 이벤트마다 0 수락 · 1 중복 · 2 예산 초과 · 3 클릭 속도 초과.
         *
         * 표식은 판정과 무관하게 먼저 건다 — 예산 초과로 거절한 토큰을 다음 시각에 다시 내서 과금받지 못하게.
         * 청구액은 이번 시각 지출이 시간당 상한을, 오늘 지출이 일예산 남은 몫을, 전체 미정산 지출이 총예산 남은 몫을
         * 넘지 않을 때만 더한다. 모든 쓰기는 같은 자리에서 TTL 을 건다.
         */
        val ACCEPT: RedisScript<List<*>> = RedisScript.of(
            """
            local markerTtl = tonumber(ARGV[1])
            local counterTtl = tonumber(ARGV[2])
            local freqTtl = tonumber(ARGV[3])
            local rateTtl = tonumber(ARGV[4])
            local rateLimit = tonumber(ARGV[5])
            local campaignCount = tonumber(ARGV[6])
            local eventCount = tonumber(ARGV[7])
            local fillCount = tonumber(ARGV[8])
            local p = 9

            local function sumOf(n)
              local sum = 0
              for _ = 1, n do
                sum = sum + tonumber(redis.call('GET', KEYS[tonumber(ARGV[p])]) or '0')
                p = p + 1
              end
              return sum
            end

            local campaigns = {}
            for c = 1, campaignCount do
              local cmp = {}
              cmp.dailyLeft = tonumber(ARGV[p])
              cmp.totalLeft = tonumber(ARGV[p + 1])
              cmp.hourCap = tonumber(ARGV[p + 2])
              cmp.hourKey = KEYS[tonumber(ARGV[p + 3])]
              local todayCount = tonumber(ARGV[p + 4])
              p = p + 5
              cmp.hour = tonumber(redis.call('GET', cmp.hourKey) or '0')
              cmp.today = cmp.hour + sumOf(todayCount)
              local earlierCount = tonumber(ARGV[p])
              p = p + 1
              cmp.total = cmp.today + sumOf(earlierCount)
              campaigns[c] = cmp
            end

            local results = {}
            for e = 1, eventCount do
              local cmp = campaigns[tonumber(ARGV[p])]
              local charge = tonumber(ARGV[p + 1])
              local marker = KEYS[tonumber(ARGV[p + 2])]
              local advKey = KEYS[tonumber(ARGV[p + 3])]
              local crKey = KEYS[tonumber(ARGV[p + 4])]
              local field = ARGV[p + 5]
              local metric = ARGV[p + 6]
              local freqIndex = tonumber(ARGV[p + 7])
              local rateIndex = tonumber(ARGV[p + 8])
              p = p + 9

              if not redis.call('SET', marker, '1', 'NX', 'PX', markerTtl) then
                results[e] = 1
              else
                local rateOk = true
                if rateIndex > 0 then
                  local clicks = redis.call('INCR', KEYS[rateIndex])
                  redis.call('EXPIRE', KEYS[rateIndex], rateTtl)
                  rateOk = clicks <= rateLimit
                end
                if not rateOk then
                  results[e] = 3
                elseif cmp.hour + charge > cmp.hourCap
                    or cmp.today + charge > cmp.dailyLeft
                    or (cmp.totalLeft ~= nil and cmp.total + charge > cmp.totalLeft) then
                  results[e] = 2
                else
                  if charge > 0 then
                    redis.call('INCRBY', cmp.hourKey, charge)
                    redis.call('EXPIRE', cmp.hourKey, counterTtl)
                    redis.call('INCRBY', advKey, charge)
                    redis.call('EXPIRE', advKey, counterTtl)
                    redis.call('HINCRBY', crKey, field .. ':${AdsRedisKeys.METRIC_SPEND}', charge)
                    cmp.hour = cmp.hour + charge
                    cmp.today = cmp.today + charge
                    cmp.total = cmp.total + charge
                  end
                  redis.call('HINCRBY', crKey, field .. ':' .. metric, 1)
                  redis.call('EXPIRE', crKey, counterTtl)
                  if freqIndex > 0 then
                    redis.call('INCR', KEYS[freqIndex])
                    redis.call('EXPIRE', KEYS[freqIndex], freqTtl)
                  end
                  results[e] = 0
                end
              end
            end

            for f = 1, fillCount do
              local key = KEYS[tonumber(ARGV[p])]
              redis.call('HINCRBY', key, ARGV[p + 1], tonumber(ARGV[p + 2]))
              redis.call('EXPIRE', key, counterTtl)
              p = p + 3
            end
            return results
            """.trimIndent(),
            List::class.java,
        )
    }
}
