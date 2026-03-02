package com.kgd.search.infrastructure.messaging

import com.kgd.search.application.product.port.ProductIndexPort
import com.kgd.search.domain.product.model.ProductDocument
import org.slf4j.LoggerFactory
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.time.LocalDateTime

@Component
class ProductIndexingConsumer(
    private val productIndexPort: ProductIndexPort
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @KafkaListener(
        topics = ["product.item.created", "product.item.updated"],
        groupId = "search-indexer",
        containerFactory = "productEventListenerContainerFactory"
    )
    fun consume(event: ProductIndexEvent) {
        log.info("Received product index event: productId={}", event.productId)
        productIndexPort.indexProduct(
            ProductDocument(
                id = event.productId.toString(),
                name = event.name,
                price = event.price,
                status = event.status
            )
        )
    }
}

data class ProductIndexEvent(
    val productId: Long = 0,
    val name: String = "",
    val price: BigDecimal = BigDecimal.ZERO,
    val status: String = "",
    val eventTime: LocalDateTime = LocalDateTime.now()
)
