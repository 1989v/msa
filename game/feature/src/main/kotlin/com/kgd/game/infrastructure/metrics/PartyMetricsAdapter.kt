package com.kgd.game.infrastructure.metrics

import com.kgd.game.application.party.port.PartyMetricsPort
import io.micrometer.core.instrument.MeterRegistry
import org.springframework.stereotype.Component

/**
 * 파티 관측 구현 (ADR-0092 SR-9).
 *
 * 처음에는 호스트 앱에 두려 했다 — 관측기를 호스트가 소유하니 자연스러워 보였고, 그러면
 * 이 모듈에 계측 의존을 안 붙여도 됐다. **레이어 게이트가 막았다**: 호스트가 `com.kgd.game`
 * 을 import 하는 것은 교차 서비스 import 라 합성 루트에만 허용된다(ADR-0083 ⑦).
 * 어댑터는 합성 루트가 아니라 코드이므로 여기 있어야 한다.
 *
 * **태그에 별칭도 방 코드도 안 넣는다.** 별칭은 실명이 들어올 수 있는 값이고, 방 코드는
 * 카디널리티가 무한이라 시계열이 폭발한다. 세는 것은 「무엇이 몇 번」뿐이다.
 */
@Component
class PartyMetricsAdapter(
    private val registry: MeterRegistry,
) : PartyMetricsPort {

    override fun scoringRejected(reason: String) {
        registry.counter("party.scoring.rejected", "reason", reason).increment()
    }

    override fun hashDiverged(count: Int) {
        // 갈린 좌석 수만큼 올린다 — 「한 명이 갈렸다」와 「둘이 갈렸다」는 다른 사건이다
        registry.counter("party.round.hash.diverged").increment(count.toDouble())
    }

    override fun roundVoided() = registry.counter("party.round.voided").increment()

    override fun roundSettled() = registry.counter("party.round.settled").increment()
}
