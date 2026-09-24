package com.kgd.promotion.infrastructure.messaging

import com.kgd.common.ops.DltKafka
import com.kgd.common.ops.DltOpsIssueRecorder
import com.kgd.promotion.infrastructure.config.PromotionOpsConfig
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component

/** DLT 로 떨어진 promotion 컨슈머의 레코드를 운영 이슈로 적재한다 — 어드민이 원 토픽으로 재발행한다 */
@Component
class PromotionDltConsumer(
    @Qualifier("promotionDltRecorder") private val recorder: DltOpsIssueRecorder,
) {
    @KafkaListener(
        topicPattern = DltKafka.TOPIC_PATTERN,
        groupId = PromotionOpsConfig.DLT_GROUP,
        containerFactory = "promotionDltListenerContainerFactory",
    )
    fun onDlt(record: ConsumerRecord<String?, String?>) {
        recorder.record(record)
    }
}
