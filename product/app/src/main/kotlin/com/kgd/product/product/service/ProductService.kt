package com.kgd.product.application.product.service

import com.kgd.product.application.product.port.ProductEventPort
import com.kgd.product.application.product.usecase.CreateProductUseCase
import com.kgd.product.application.product.usecase.GetAllProductsUseCase
import com.kgd.product.application.product.usecase.GetProductUseCase
import com.kgd.product.application.product.usecase.UpdateProductUseCase
import com.kgd.product.domain.product.model.Money
import com.kgd.product.domain.product.model.Product
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Service

@Service
class ProductService(
    private val transactionalService: ProductTransactionalService,
    private val eventPort: ProductEventPort
) : CreateProductUseCase, GetProductUseCase, UpdateProductUseCase, GetAllProductsUseCase {

    override fun execute(command: CreateProductUseCase.Command): CreateProductUseCase.Result {
        val product = Product.create(
            name = command.name,
            price = Money(command.price),
            stock = command.stock
        )
        // Transaction commits when save() returns
        val saved = transactionalService.save(product)
        // Publish event AFTER transaction committed
        eventPort.publishProductCreated(saved)
        return CreateProductUseCase.Result(
            id = requireNotNull(saved.id) { "저장된 상품에 ID가 없습니다" },
            name = saved.name,
            price = saved.price.amount,
            stock = saved.stock,
            status = saved.status.name
        )
    }

    override fun execute(id: Long): GetProductUseCase.Result {
        val product = transactionalService.findById(id)
        return GetProductUseCase.Result(
            id = requireNotNull(product.id) { "저장된 상품에 ID가 없습니다" },
            name = product.name,
            price = product.price.amount,
            stock = product.stock,
            status = product.status.name
        )
    }

    override fun execute(command: UpdateProductUseCase.Command): UpdateProductUseCase.Result {
        val product = transactionalService.findById(command.id)
        product.update(
            name = command.name,
            price = command.price?.let { Money(it) }
        )
        // Transaction commits when save() returns
        val saved = transactionalService.save(product)
        // Publish event AFTER transaction committed
        eventPort.publishProductUpdated(saved)
        return UpdateProductUseCase.Result(
            id = requireNotNull(saved.id) { "저장된 상품에 ID가 없습니다" },
            name = saved.name,
            price = saved.price.amount,
            stock = saved.stock,
            status = saved.status.name
        )
    }

    override fun execute(query: GetAllProductsUseCase.Query): GetAllProductsUseCase.Result {
        val pageable = PageRequest.of(query.page, query.size, Sort.by("id").ascending())
        val page = transactionalService.findAll(pageable)
        return GetAllProductsUseCase.Result(
            products = page.content.map { product ->
                GetAllProductsUseCase.Result.ProductResult(
                    id = requireNotNull(product.id) { "저장된 상품에 ID가 없습니다" },
                    name = product.name,
                    price = product.price.amount,
                    status = product.status.name,
                    stock = product.stock,
                    createdAt = product.createdAt
                )
            },
            totalElements = page.totalElements,
            totalPages = page.totalPages
        )
    }
}
