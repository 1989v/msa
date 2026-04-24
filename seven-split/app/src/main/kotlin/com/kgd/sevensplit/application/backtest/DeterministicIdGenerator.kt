package com.kgd.sevensplit.application.backtest

import java.util.Random
import java.util.UUID

/**
 * DeterministicIdGenerator — seed 기반 결정론적 UUID 생성기.
 *
 * `UUID.randomUUID()` 는 `SecureRandom` 을 사용해 비결정적이다. 백테스트 엔진의
 * [OrderId], [com.kgd.sevensplit.domain.event.DomainEvent.eventId] 는 동일 seed
 * 에서 동일한 순서로 발급되어야 결과 재현이 가능하다 (TG-05.6).
 *
 * 내부적으로 [java.util.Random] 을 seed 로 초기화해 2 x long → UUID 바이트로 매핑한다.
 * 이 클래스는 **단일 스레드** 에서만 사용되며, 엔진 루프가 직렬이므로 문제 없음.
 */
class DeterministicIdGenerator(seed: Long) {
    private val random: Random = Random(seed)

    fun nextUuid(): UUID {
        val most = random.nextLong()
        val least = random.nextLong()
        return UUID(most, least)
    }
}
