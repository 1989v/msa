package com.kgd.common.observability

import java.time.Clock
import java.time.Duration
import java.time.Instant

/**
 * 예정된 수집 배치 하나가 값을 남기고 있는지를 적재된 데이터의 나이로 판정한다.
 *
 * 배치의 종료 코드가 아니라 적재 결과를 보므로 성공한 채 아무것도 쓰지 않은 경우도 드러난다.
 * 도메인이 `@Bean` 으로 등록하면 [IngestEndpoint] 가 모아 `/actuator/ingest` 로 낸다.
 */
class IngestFreshness(
    /** 수집을 수행하는 CronJob 이름 */
    val job: String,

    /** cron 표기. 판정에 쓰지 않고 응답에만 싣는다 */
    val schedule: String,

    /** 이 나이를 넘기면 낡은 것으로 본다. 연속 실패를 몇 번까지 허용할지로 정한다 */
    val maxAge: Duration,

    private val lastIngestedAt: () -> Instant?,
) {
    fun inspect(clock: Clock = Clock.systemUTC()): Report {
        val latest = runCatching(lastIngestedAt).getOrElse {
            return Report(job, schedule, State.UNKNOWN, null, it.message ?: it::class.simpleName)
        }
        if (latest == null) return Report(job, schedule, State.NEVER, null, null)

        val age = Duration.between(latest, clock.instant())
        val state = if (age > maxAge) State.STALE else State.FRESH
        return Report(job, schedule, state, age.toHours(), null)
    }

    enum class State {
        /** 최신값이 maxAge 안에 있다 */
        FRESH,

        /** 값은 있으나 낡았다 */
        STALE,

        /** 한 번도 적재된 적이 없다 */
        NEVER,

        /** 조회가 실패해 판정할 수 없다 */
        UNKNOWN,
    }

    data class Report(
        val job: String,
        val schedule: String,
        val state: State,
        val ageHours: Long?,
        val error: String?,
    )
}
