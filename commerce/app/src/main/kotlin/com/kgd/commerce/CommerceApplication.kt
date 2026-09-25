package com.kgd.commerce

import org.springframework.beans.factory.config.BeanPostProcessor
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.context.annotation.Bean
import org.springframework.core.env.Environment
import org.springframework.kafka.annotation.EnableKafka
import org.springframework.kafka.config.AbstractKafkaListenerContainerFactory
import org.springframework.scheduling.annotation.EnableScheduling

// ADR-0058: commerce 모듈러 모놀리스 — inventory+warehouse+fulfillment+order 도메인 폴드
// (도메인별 datasource/EMF, 스키마 유지).
// ADR-0093: member·wishlist 는 account 호스트로 옮겼고, product(카탈로그 SSOT)가 들어왔다 —
// 사가 참여자인데 혼자 밖에 있던 것을 안으로 들였다.
// ADR-0093 ②: deal(혜택 링크 허브)도 커머스 성격이라 여기로. 전용 스키마 deal_db 를 갖는다.
// ADR-0099: seller(마켓플레이스 판매자) — 전용 스키마 seller_db. payment(결제) — 전용 스키마 payment_db.
// promotion(쿠폰·포인트·TCC 보류) — 전용 스키마 promotion_db. settlement(원장·정산) — 전용 스키마 settlement_db.
@SpringBootApplication(scanBasePackages = ["com.kgd.inventory", "com.kgd.warehouse", "com.kgd.fulfillment", "com.kgd.order", "com.kgd.product", "com.kgd.deal", "com.kgd.seller", "com.kgd.payment", "com.kgd.promotion", "com.kgd.settlement", "com.kgd.common.exception", "com.kgd.common.response"])
@EnableScheduling
// 호스트 전체 설정이라 호스트에 둔다. Boot 4 는 Kafka 자동설정이 별도 모듈이고 이 호스트엔 없어서, 이것이 없으면
// 폴드된 모든 도메인의 @KafkaListener 가 하나도 등록되지 않는데 컴파일·기동은 통과한다(리스너 레지스트리 빈이 없다).
// 한 도메인 설정에 두면 그 도메인을 빼는 순간 호스트 전체의 리스너가 꺼진다.
@EnableKafka
class CommerceApplication {
    companion object {
        /**
         * `spring.kafka.listener.auto-startup` 을 도메인마다 손으로 만든 리스너 팩토리 전부에 적용한다.
         * Boot 의 Kafka 자동설정이 없어 이 속성은 원래 아무 팩토리에도 닿지 않는다. 기본은 true(운영 그대로).
         * 후처리기라 정적으로 둔다 — 인스턴스 빈이면 설정 클래스를 너무 일찍 만든다.
         */
        @JvmStatic
        @Bean
        fun kafkaListenerAutoStartup(environment: Environment): BeanPostProcessor = object : BeanPostProcessor {
            override fun postProcessBeforeInitialization(bean: Any, beanName: String): Any {
                if (bean is AbstractKafkaListenerContainerFactory<*, *, *>) {
                    bean.setAutoStartup(environment.getProperty("spring.kafka.listener.auto-startup", "true").toBoolean())
                }
                return bean
            }
        }
    }
}

fun main(args: Array<String>) {
    runApplication<CommerceApplication>(*args)
}
