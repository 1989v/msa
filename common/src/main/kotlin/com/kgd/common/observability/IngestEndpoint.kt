package com.kgd.common.observability

import org.springframework.boot.actuate.endpoint.annotation.Endpoint
import org.springframework.boot.actuate.endpoint.annotation.ReadOperation
import java.time.Clock

/**
 * 이 프로세스가 담은 도메인들의 수집 배치 최신성.
 *
 * health 가 아니라 별도 엔드포인트인 이유는 배치가 낡은 것과 서비스가 트래픽을 받을 수 없는 것이
 * 다른 사실이기 때문이다. `HealthIndicator` 로 내면 기본 health 에 섞여 서비스 상태를 왜곡한다.
 */
@Endpoint(id = "ingest")
class IngestEndpoint(
    private val checks: List<IngestFreshness>,
    private val clock: Clock = Clock.systemUTC(),
) {
    @ReadOperation
    fun report(): Map<String, Any> {
        val jobs = checks.map { it.inspect(clock) }.sortedBy { it.job }
        return mapOf(
            "healthy" to jobs.none { it.state == IngestFreshness.State.STALE || it.state == IngestFreshness.State.NEVER },
            "jobs" to jobs,
        )
    }
}
