package com.kgd.payment.infrastructure.pg.mock

/**
 * 모의 PG 가 승인·조회에 어떻게 답할지. 운영은 [approve](항상 승인) 하나뿐이고,
 * 테스트가 이 타입의 빈을 등록하면 그것으로 바뀐다(거절 · 타임아웃 뒤 N번째 조회에서 승인 · 타임아웃 뒤 거절).
 */
interface MockPgScenario {
    fun onAuthorize(orderNo: String, amount: Long): Outcome

    /** 타임아웃으로 남은 거래를 [inquiryCount] 번째로 조회할 때 */
    fun onInquire(orderNo: String, inquiryCount: Int): Outcome

    enum class Outcome {
        APPROVE,
        DECLINE,

        /** 승인 호출: 응답 없음(결과 미상) · 조회: 아직 결론 없음 */
        TIMEOUT,
    }

    companion object {
        fun approve(): MockPgScenario = fixed(Outcome.APPROVE, Outcome.APPROVE)
        fun decline(): MockPgScenario = fixed(Outcome.DECLINE, Outcome.DECLINE)
        fun timeoutThenDecline(): MockPgScenario = fixed(Outcome.TIMEOUT, Outcome.DECLINE)
        fun timeoutForever(): MockPgScenario = fixed(Outcome.TIMEOUT, Outcome.TIMEOUT)

        fun timeoutThenApproveOnInquiry(n: Int): MockPgScenario = object : MockPgScenario {
            override fun onAuthorize(orderNo: String, amount: Long) = Outcome.TIMEOUT
            override fun onInquire(orderNo: String, inquiryCount: Int) =
                if (inquiryCount >= n) Outcome.APPROVE else Outcome.TIMEOUT
        }

        private fun fixed(authorize: Outcome, inquire: Outcome): MockPgScenario = object : MockPgScenario {
            override fun onAuthorize(orderNo: String, amount: Long) = authorize
            override fun onInquire(orderNo: String, inquiryCount: Int) = inquire
        }
    }
}
