package com.kgd.product.infrastructure.messaging

import com.kgd.product.application.product.port.ProductEventPort
import com.kgd.product.domain.product.model.Product
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.time.LocalDateTime

@Component
class ProductEventAdapter(
    private val kafkaTemplate: KafkaTemplate<String, Any>,
    @Value("\${kafka.topics.product-created}") private val createdTopic: String,
    @Value("\${kafka.topics.product-updated}") private val updatedTopic: String
) : ProductEventPort {

    private val log = LoggerFactory.getLogger(javaClass)

    override fun publishProductCreated(product: Product) {
        val event = ProductCreatedEvent(
            productId = product.id!!,
            name = product.name,
            price = product.price.amount,
            status = product.status.name
        )
        kafkaTemplate.send(createdTopic, product.id.toString(), event)
        log.info("Published ProductCreatedEvent: productId={}", product.id)
    }

    override fun publishProductUpdated(product: Product) {
        val event = ProductUpdatedEvent(
            productId = product.id!!,
            name = product.name,
            price = product.price.amount,
            status = product.status.name
        )
        kafkaTemplate.send(updatedTopic, product.id.toString(), event)
        log.info("Published ProductUpdatedEvent: productId={}", product.id)
    }
}

data class ProductCreatedEvent(
    val productId: Long,
    val name: String,
    val price: BigDecimal,
    val status: String,
    val eventTime: LocalDateTime = LocalDateTime.now()
)

data class ProductUpdatedEvent(
    val productId: Long,
    val name: String,
    val price: BigDecimal,
    val status: String,
    val eventTime: LocalDateTime = LocalDateTime.now()
)
