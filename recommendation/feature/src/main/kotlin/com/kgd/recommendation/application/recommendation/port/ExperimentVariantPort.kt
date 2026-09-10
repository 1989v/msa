package com.kgd.recommendation.application.recommendation.port

/** experiment 서비스의 bucket assignment. 실패는 null — 호출자가 기본 variant 를 쓴다 */
interface ExperimentVariantPort {
    fun getVariant(experimentId: Long, userId: Long): String?
}
