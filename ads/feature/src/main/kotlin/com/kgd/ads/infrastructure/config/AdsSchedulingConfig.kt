package com.kgd.ads.infrastructure.config

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Configuration
import org.springframework.scheduling.annotation.EnableScheduling

/**
 * ads 스케줄 작업(후보 인덱스 갱신·집계·정산)의 스위치.
 *
 * 호스트의 스케줄링은 outbox 자동 구성이 `outbox.polling.enabled` 에 묶어 켠다. 그 토글을 끄면
 * ads 작업도 함께 멈추므로, ads 가 스스로 `@EnableScheduling` 을 선언한다.
 *
 * ads 의 스케줄 작업 빈은 이 설정과 같은 조건(`ads.scheduling.enabled`, 기본 true)을 단다 —
 * 테스트는 끄고 작업을 직접 호출해 몇 번 도는지 통제한다. 스케줄러 풀 크기는 호스트 yml 의
 * `spring.task.scheduling.pool.size` 가 정한다(정산이 인덱스 갱신을 막지 않게 4).
 */
@Configuration(proxyBeanMethods = false)
@EnableScheduling
@ConditionalOnProperty(prefix = "ads.scheduling", name = ["enabled"], havingValue = "true", matchIfMissing = true)
class AdsSchedulingConfig
