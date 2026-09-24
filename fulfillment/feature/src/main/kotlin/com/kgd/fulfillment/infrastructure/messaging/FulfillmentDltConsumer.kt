package com.kgd.fulfillment.infrastructure.messaging

import com.kgd.common.ops.DltKafka
import com.kgd.common.ops.DltOpsIssueRecorder
import com.kgd.fulfillment.infrastructure.config.FulfillmentOpsConfig
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component

/** DLT 로 떨어진 fulfillment 컨슈머의 레코드를 운영 이슈로 적재한다 — 어드민이 원 토픽으로 재발행한다 */
@Component
class FulfillmentDltConsumer(
    @Qualifier("fulfillmentDltRecorder") private val recorder: DltOpsIssueRecorder,
) {
    @KafkaListener(
        topicPattern = DltKafka.TOPIC_PATTERN,
        groupId = FulfillmentOpsConfig.DLT_GROUP,
        containerFactory = "fulfillmentDltListenerContainerFactory",
    )
    fun onDlt(record: ConsumerRecord<String?, String?>) {
        recorder.record(record)
    }
}
