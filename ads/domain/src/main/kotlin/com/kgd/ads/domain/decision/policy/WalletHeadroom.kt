package com.kgd.ads.domain.decision.policy

import java.time.Duration
import java.time.LocalDateTime

/**
 * 결정 시점의 광고주 지갑 여유.
 *
 * 스냅샷 잔액에는 「정산 완료 시각」까지의 지출이 이미 빠져 있다. 그 뒤 시각들의 (광고주, 시각) 지출을
 * 빼면 지금 쓸 수 있는 몫이 나온다 — 시각 키라 이미 정산된 지출을 두 번 빼지 않는다.
 * 정산이 멈춰 미정산이 [MAX_UNSETTLED] 를 넘으면 그 광고주는 후보에서 뺀다 — 정산이 따라잡기 전까지 청구 못 할 지출이 쌓이지 않게.
 */
sealed interface WalletHeadroom {
    data class Available(val micros: Long) : WalletHeadroom {
        fun canAfford(chargeMicros: Long): Boolean = micros >= chargeMicros
    }

    data object StaleSettlement : WalletHeadroom

    companion object {
        val MAX_UNSETTLED: Duration = Duration.ofHours(6)

        /**
         * @param settledThroughHour 이 시각(시작 시각)까지 정산됐다. 한 번도 정산되지 않았으면 null —
         *   그때는 가장 이른 지출 시각부터 미정산으로 센다.
         * @param spendByHour (광고주, KST 시각) 지출. 키는 시각의 시작.
         */
        fun of(
            snapshotBalanceMicros: Long,
            settledThroughHour: LocalDateTime?,
            spendByHour: Map<LocalDateTime, Long>,
            now: LocalDateTime,
        ): WalletHeadroom {
            val unsettled = spendByHour.filterKeys { settledThroughHour == null || it.isAfter(settledThroughHour) }
            val unsettledSince = settledThroughHour?.plusHours(1)
                ?: unsettled.filterValues { it > 0 }.keys.minOrNull()
            if (unsettledSince != null && Duration.between(unsettledSince, now) > MAX_UNSETTLED) return StaleSettlement
            return Available(snapshotBalanceMicros - unsettled.values.sum())
        }
    }
}
