package com.kgd.product.application.product.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.product.application.product.port.ProductEventPort
import com.kgd.product.application.product.port.ProductRepositoryPort
import com.kgd.product.application.product.usecase.ProductRequester
import com.kgd.product.application.product.usecase.RepublishProductsUseCase
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

private val log = KotlinLogging.logger {}

@Service
class ProductRepublishService(
    private val products: ProductRepositoryPort,
    private val events: ProductEventPort,
) : RepublishProductsUseCase {

    /** 상품 저장과 같은 방식으로 아웃박스 행을 product_db 한 트랜잭션에 쓴다 — Kafka 로 옮기는 것은 릴레이 몫 */
    @Transactional(transactionManager = "productTransactionManager")
    override fun execute(requester: ProductRequester): Int {
        if (!requester.isAdmin) throw BusinessException(ErrorCode.FORBIDDEN, "상품 이벤트 재발행은 어드민 전용입니다: userId=${requester.userId}")
        var page = 0
        var published = 0
        while (true) {
            val slice = products.findAllIncludingInactive(PageRequest.of(page, PAGE_SIZE, Sort.by("id").ascending()))
            slice.content.forEach { events.publishProductUpdated(it) }
            published += slice.numberOfElements
            if (!slice.hasNext()) break
            page++
        }
        log.info { "상품 이벤트 재발행: count=$published actor=${requester.userId}" }
        return published
    }

    private companion object {
        const val PAGE_SIZE = 100
    }
}
