package com.kgd.settlement.infrastructure.messaging

import com.kgd.common.ops.DltKafka
import com.kgd.common.ops.DltOpsIssueRecorder
import com.kgd.settlement.infrastructure.config.SettlementOpsConfig
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component

/** DLT 로 떨어진 settlement 컨슈머의 레코드를 운영 이슈로 적재한다 — 어드민이 원 토픽으로 재발행한다 */
@Component
class SettlementDltConsumer(
    @Qualifier("settlementDltRecorder") private val recorder: DltOpsIssueRecorder,
) {
    @KafkaListener(
        topicPattern = DltKafka.TOPIC_PATTERN,
        groupId = SettlementOpsConfig.DLT_GROUP,
        containerFactory = "settlementDltListenerContainerFactory",
    )
    fun onDlt(record: ConsumerRecord<String?, String?>) {
        recorder.record(record)
    }
}
