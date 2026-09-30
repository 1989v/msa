package com.kgd.search.domain.attraction.model

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import kotlin.math.ln
import kotlin.math.min

/**
 * 클릭 신호 — 최근 14일(KST 날짜) 관광지를 클릭한 고유 방문자 수와, 그것으로 정하는 순위 계수.
 *
 * 원천은 analytics 의 `attraction_popularity_daily.unique_clickers`(ADR-0095 §6)이고, 재색인이 날짜를
 * `uniqMerge` 로 합쳐 `uniqueClickers14d` 로 싣는다. 노출은 순위가 만든 결과라 쓰지 않는다.
 *
 * `visitor_id` 는 클라이언트가 보내는 값이라 바꿔 가며 부풀릴 수 있다. 그래서 이 계수는 작은 가중치로만 쓴다 —
 * 최소 표본 미만은 무시하고, 상한을 두고, 순위 반영은 스위치로 기본 꺼 둔다.
 *
 *     n < MIN_SAMPLE → 1.0
 *     그 외          → min(CAP, 1 + ALPHA · ln(n / MIN_SAMPLE))
 *
 * 로그를 쓰는 이유: 5명과 50명의 차이가 50명과 95명의 차이보다 크다. MIN_SAMPLE 에서 1.0 으로 시작해
 * 끊김 없이 오르므로 표본 문턱을 넘는 순간 순위가 튀지 않는다. 값을 바꾸면 재색인이 다시 계산해야 반영된다.
 */
object AttractionClickSignal {

    /** 최소 표본 — 14일 고유 클릭 방문자가 이보다 적으면 계수 1.0, 「많이 클릭한 곳」 표시도 없다. */
    const val MIN_SAMPLE = 5

    /** 계수 상한. 관련도를 30% 넘게 밀어 올리지 않는다. */
    const val CAP = 1.3

    /** 로그 기울기. 0.1 이면 약 100명(= 5 · e³)에서 상한에 닿는다. */
    const val ALPHA = 0.1

    /** 몇 날짜를 합치는가. 오늘(KST)은 아직 접히지 않아 빼고 어제까지 센다. */
    const val WINDOW_DAYS = 14L

    private val KST: ZoneId = ZoneId.of("Asia/Seoul")

    fun boost(uniqueClickers: Int?): Double {
        if (uniqueClickers == null || uniqueClickers < MIN_SAMPLE) return 1.0
        return min(CAP, 1.0 + ALPHA * ln(uniqueClickers.toDouble() / MIN_SAMPLE))
    }

    /** 상세의 「많이 클릭한 곳」 표시 여부. 화면(`placeAttributes.ts`)이 같은 기준을 쓴다. */
    fun isFrequentlyClicked(uniqueClickers: Int?): Boolean = uniqueClickers != null && uniqueClickers >= MIN_SAMPLE

    /** [now] 기준 합칠 날짜 범위 — KST 어제부터 거꾸로 [WINDOW_DAYS] 일. */
    fun windowOf(now: Instant): ClosedRange<LocalDate> {
        val yesterday = LocalDate.ofInstant(now, KST).minusDays(1)
        return yesterday.minusDays(WINDOW_DAYS - 1)..yesterday
    }
}
