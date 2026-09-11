package com.kgd.blog.infrastructure.render

import org.springframework.boot.health.contributor.Health
import org.springframework.boot.health.contributor.HealthIndicator
import org.springframework.stereotype.Component

/**
 * 셸 페치가 깨졌다는 것을 **밖에서 볼 수 있게** 한다.
 *
 * 셸을 못 받아도 글은 200 으로 나간다(그래야 한다 — 통계가 본문을 막으면 안 되는 것과 같은 이유).
 * 그래서 응답 코드로는 알 수 없고, 남는 흔적은 warn 로그 한 줄뿐이다. 실제로 blog 가 content 로
 * 옮겨 간 뒤 NetworkPolicy 가 안 따라와 모든 글이 자산 link 21개 없이 나갔는데, 바깥에서 보이는
 * 신호가 하나도 없었다.
 *
 * **probe 는 건드리지 않는다.** readiness 그룹은 `readinessState` 만 포함하므로 여기서 DOWN 이
 * 나도 파드가 트래픽에서 빠지지 않는다 — 셸이 없다고 글을 안 내보내는 것은 더 나쁘다.
 * 이 값은 `/actuator/health` 와 어드민 시스템 대시보드에만 뜬다.
 */
@Component
class BlogShellHealthIndicator(
    private val provider: ShellHtmlProvider,
) : HealthIndicator {

    override fun health(): Health {
        val state = provider.state()
        val builder = when (state) {
            ShellHtmlProvider.ShellState.OK, ShellHtmlProvider.ShellState.UNKNOWN -> Health.up()
            ShellHtmlProvider.ShellState.STALE, ShellHtmlProvider.ShellState.MISSING -> Health.down()
        }
        return builder
            .withDetail("state", state.name)
            .withDetail("meaning", MEANING.getValue(state))
            .build()
    }

    private companion object {
        val MEANING = mapOf(
            ShellHtmlProvider.ShellState.UNKNOWN to "아직 글 요청이 없어 셸을 받은 적이 없다",
            ShellHtmlProvider.ShellState.OK to "portal-fe 셸을 정상적으로 받고 있다",
            ShellHtmlProvider.ShellState.STALE to "셸 페치 실패 — 마지막 정상본으로 서빙 중. 자산 해시가 옛것일 수 있다",
            ShellHtmlProvider.ShellState.MISSING to "셸을 한 번도 못 받았다 — 글이 SPA 없이 나간다. NetworkPolicy·portal-fe 확인",
        )
    }
}
