package com.kgd.common.quota

/**
 * 외부 API 호출 장부 (ADR-0082).
 *
 * 소비 시점 규칙: **예약은 요청 전송 직전, 확정은 응답과 무관하게.**
 * 성공·빈결과·실패·타임아웃 넷 다 제공자 쿼터를 실제로 썼다.
 * **실패를 반납하지 않는다** — 반납하면 장애 시 무한 재시도가 된다.
 */
interface ExternalApiQuotaLedger {

    /**
     * [cost] 만큼 예약한다.
     *
     * @return 호출해도 되면 true. 한도를 넘으면 false — 호출 자체를 하지 않는다.
     *   한도가 없는 provider([ExternalApiProvider.enforced] false)는 세기만 하고 항상 true.
     */
    fun tryAcquire(provider: ExternalApiProvider, cost: Long = 1): Boolean

    /** 오늘 사용분. 관측용 — 이 값으로 분기하지 말고 [tryAcquire] 를 쓴다(경합에 안전하지 않다). */
    fun used(provider: ExternalApiProvider): Long

    /** 오늘 남은 양. 한도 없는 provider 는 null. */
    fun remaining(provider: ExternalApiProvider): Long? =
        provider.dailyLimit?.let { (it - used(provider)).coerceAtLeast(0) }
}

/** 한도를 넘겨 호출이 차단됐다. 배치는 다음 회차로 넘기고, 요청 경로면 애초에 부르면 안 된다. */
class ExternalApiQuotaExceededException(
    val provider: ExternalApiProvider,
) : RuntimeException("외부 API 일일 한도 초과 — provider=${provider.key}, limit=${provider.dailyLimit}")
