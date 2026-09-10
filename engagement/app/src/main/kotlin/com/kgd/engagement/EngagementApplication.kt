package com.kgd.engagement

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

/**
 * ADR-0093 — engagement 모듈러 모놀리스: recommendation + experiment 도메인 폴드.
 *
 * 두 도메인은 **같은 JVM 에 있어도 HTTP 로 대화한다.** recommendation 이 실험 배정을 물을 때
 * `RecommendationExperimentClient` 가 그대로 Service 주소를 부른다 — in-process 호출로 바꾸면
 * 코드 결합이 생겨 재분리가 어려워진다(ADR-0058 불변식).
 */
@SpringBootApplication(
    scanBasePackages = [
        "com.kgd.recommendation",
        "com.kgd.experiment",
        "com.kgd.common.exception",
        "com.kgd.common.response",
    ],
)
class EngagementApplication

fun main(args: Array<String>) {
    runApplication<EngagementApplication>(*args)
}
