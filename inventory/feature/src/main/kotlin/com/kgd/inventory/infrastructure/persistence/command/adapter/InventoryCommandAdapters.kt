package com.kgd.inventory.infrastructure.persistence.command.adapter

import com.kgd.inventory.application.reservation.port.CommandAnswer
import com.kgd.inventory.application.reservation.port.CommandAnswerRepositoryPort
import com.kgd.inventory.infrastructure.persistence.command.entity.InventoryCommandAnswerJpaEntity
import com.kgd.inventory.infrastructure.persistence.command.repository.InventoryCommandAnswerJpaRepository
import org.springframework.stereotype.Component

@Component
class CommandAnswerRepositoryAdapter(
    private val jpaRepository: InventoryCommandAnswerJpaRepository,
) : CommandAnswerRepositoryPort {
    override fun find(orderId: Long, commandKey: String): CommandAnswer? =
        jpaRepository.findByOrderIdAndCommandKey(orderId, commandKey)
            ?.let { CommandAnswer(it.orderId, it.commandKey, it.eventType, it.payload) }

    override fun save(answer: CommandAnswer) {
        // saveAndFlush — 같은 명령 동시 처리를 유니크 위반으로 여기서 끊어, 뒤 트랜잭션이 효과째 롤백되게 한다
        jpaRepository.saveAndFlush(
            InventoryCommandAnswerJpaEntity(
                orderId = answer.orderId, commandKey = answer.commandKey,
                eventType = answer.eventType, payload = answer.payload,
            ),
        )
    }
}
