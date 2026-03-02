package com.kgd.product.application.product.service

import com.kgd.product.application.product.port.ProductEventPort
import com.kgd.product.application.product.port.ProductRepositoryPort
import com.kgd.product.application.product.usecase.CreateProductUseCase
import com.kgd.product.application.product.usecase.GetProductUseCase
import com.kgd.product.application.product.usecase.UpdateProductUseCase
import com.kgd.product.domain.product.exception.ProductNotFoundException
import com.kgd.product.domain.product.model.Money
import com.kgd.product.domain.product.model.Product
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional
class ProductService(
    private val repositoryPort: ProductRepositoryPort,
    private val eventPort: ProductEventPort
) : CreateProductUseCase, GetProductUseCase, UpdateProductUseCase {

    override fun execute(command: CreateProductUseCase.Command): CreateProductUseCase.Result {
        val product = Product.create(
            name = command.name,
            price = Money(command.price),
            stock = command.stock
        )
        val saved = repositoryPort.save(product)
        eventPort.publishProductCreated(saved)
        return CreateProductUseCase.Result(
            id = requireNotNull(saved.id) { "저장된 상품에 ID가 없습니다" },
            name = saved.name,
            price = saved.price.amount,
            stock = saved.stock,
            status = saved.status.name
        )
    }

    @Transactional(readOnly = true)
    override fun execute(id: Long): GetProductUseCase.Result {
        val product = repositoryPort.findById(id) ?: throw ProductNotFoundException(id)
        return GetProductUseCase.Result(
            id = requireNotNull(product.id) { "저장된 상품에 ID가 없습니다" },
            name = product.name,
            price = product.price.amount,
            stock = product.stock,
            status = product.status.name
        )
    }

    override fun execute(command: UpdateProductUseCase.Command): UpdateProductUseCase.Result {
        val product = repositoryPort.findById(command.id) ?: throw ProductNotFoundException(command.id)
        product.update(
            name = command.name,
            price = command.price?.let { Money(it) }
        )
        val saved = repositoryPort.save(product)
        eventPort.publishProductUpdated(saved)
        return UpdateProductUseCase.Result(
            id = requireNotNull(saved.id) { "저장된 상품에 ID가 없습니다" },
            name = saved.name,
            price = saved.price.amount,
            stock = saved.stock,
            status = saved.status.name
        )
    }
}
