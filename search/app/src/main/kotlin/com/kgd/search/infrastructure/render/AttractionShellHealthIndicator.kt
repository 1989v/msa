package com.kgd.search.infrastructure.render

import com.kgd.search.infrastructure.render.AttractionShellProvider.ShellState
import org.springframework.boot.health.contributor.Health
import org.springframework.boot.health.contributor.HealthIndicator
import org.springframework.stereotype.Component

/**
 * 셸 받기가 깨졌다는 것을 밖에서 보이게 한다. 셸이 없어도 관광지 페이지는 200 으로 나가서
 * 응답 코드로는 알 수 없다 (블로그 `BlogShellHealthIndicator` 와 같은 이유).
 *
 * probe 는 건드리지 않는다 — readiness 그룹은 `readinessState` 만 본다(application.yml).
 * 셸이 없다고 파드를 트래픽에서 빼면 JSON 검색 API 까지 멈춘다.
 */
@Component
class AttractionShellHealthIndicator(
    private val provider: AttractionShellProvider,
) : HealthIndicator {

    override fun health(): Health {
        val state = provider.state()
        val builder = when (state) {
            ShellState.OK, ShellState.UNKNOWN -> Health.up()
            ShellState.STALE, ShellState.MISSING -> Health.down()
        }
        return builder
            .withDetail("state", state.name)
            .withDetail("meaning", MEANING.getValue(state))
            .build()
    }

    private companion object {
        val MEANING = mapOf(
            ShellState.UNKNOWN to "아직 관광지 렌더 요청이 없어 셸을 받은 적이 없다",
            ShellState.OK to "portal-fe 셸을 정상적으로 받고 있다",
            ShellState.STALE to "셸 받기 실패 — 마지막 정상본으로 서빙 중. 자산 해시가 옛것일 수 있다",
            ShellState.MISSING to "셸을 한 번도 못 받았다 — 관광지 페이지가 SPA 없이 나간다. NetworkPolicy·portal-fe 확인",
        )
    }
}
