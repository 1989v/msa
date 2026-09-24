package com.kgd.product.application.product.service

import com.kgd.product.application.product.port.ProductEventPort
import com.kgd.product.application.product.usecase.CreateProductUseCase
import com.kgd.product.application.product.usecase.GetAllProductsUseCase
import com.kgd.product.application.product.usecase.GetProductUseCase
import com.kgd.product.application.product.usecase.ProductRequester
import com.kgd.product.application.product.usecase.UpdateProductUseCase
import com.kgd.product.domain.product.model.Money
import com.kgd.product.domain.product.model.Product
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 쓰기는 상품 저장과 이벤트(아웃박스 행)를 product_db 한 트랜잭션에 넣는다 — 저장만 되고 이벤트가
 * 빠지거나, 롤백됐는데 이벤트가 나가는 일이 없다. Kafka 로 옮기는 것은 아웃박스 릴레이 몫이다.
 */
@Service
class ProductService(
    private val transactionalService: ProductTransactionalService,
    private val eventPort: ProductEventPort,
    private val writeAuthorizer: ProductWriteAuthorizer,
) : CreateProductUseCase, GetProductUseCase, UpdateProductUseCase, GetAllProductsUseCase {

    @Transactional(transactionManager = "productTransactionManager")
    override fun execute(command: CreateProductUseCase.Command, requester: ProductRequester): CreateProductUseCase.Result {
        val sellerId = writeAuthorizer.authorizeCreate(requester)
        val saved = transactionalService.save(command.toDomain(sellerId))
        eventPort.publishProductCreated(saved)
        return saved.toCreateResult()
    }

    @Transactional(transactionManager = "productTransactionManager")
    override fun executeBulk(commands: List<CreateProductUseCase.Command>): List<CreateProductUseCase.Result> {
        // 배치 적재는 판매자 신원이 없다 — 플랫폼 기본 판매자 소유
        val saved = transactionalService.saveAll(commands.map { it.toDomain(Product.PLATFORM_SELLER_ID) })
        saved.forEach { eventPort.publishProductCreated(it) }
        return saved.map { it.toCreateResult() }
    }

    override fun execute(id: Long): GetProductUseCase.Result {
        val product = transactionalService.findById(id)
        return GetProductUseCase.Result(
            id = requireNotNull(product.id) { "저장된 상품에 ID가 없습니다" },
            name = product.name,
            price = product.price.amount,
            stock = product.stock,
            status = product.status.name,
            sellerId = product.sellerId,
            brand = product.brand,
            description = product.description,
            category = product.category,
            energyKcal = product.energyKcal,
            carbohydrateG = product.carbohydrateG,
            proteinG = product.proteinG,
            fatG = product.fatG,
            sugarG = product.sugarG,
            sodiumMg = product.sodiumMg,
            ingredients = product.ingredients,
            originCountry = product.originCountry,
            itemReportNo = product.itemReportNo
        )
    }

    @Transactional(transactionManager = "productTransactionManager")
    override fun execute(command: UpdateProductUseCase.Command, requester: ProductRequester): UpdateProductUseCase.Result {
        val product = transactionalService.findById(command.id)
        writeAuthorizer.authorizeUpdate(requester, product)
        product.update(
            name = command.name,
            price = command.price?.let { Money(it) },
            brand = command.brand,
            description = command.description,
            category = command.category,
            energyKcal = command.energyKcal,
            carbohydrateG = command.carbohydrateG,
            proteinG = command.proteinG,
            fatG = command.fatG,
            sugarG = command.sugarG,
            sodiumMg = command.sodiumMg,
            ingredients = command.ingredients,
            originCountry = command.originCountry,
            itemReportNo = command.itemReportNo
        )
        val saved = transactionalService.save(product)
        eventPort.publishProductUpdated(saved)
        return UpdateProductUseCase.Result(
            id = requireNotNull(saved.id) { "저장된 상품에 ID가 없습니다" },
            name = saved.name,
            price = saved.price.amount,
            stock = saved.stock,
            status = saved.status.name,
            sellerId = saved.sellerId,
            brand = saved.brand,
            description = saved.description,
            category = saved.category,
            energyKcal = saved.energyKcal,
            carbohydrateG = saved.carbohydrateG,
            proteinG = saved.proteinG,
            fatG = saved.fatG,
            sugarG = saved.sugarG,
            sodiumMg = saved.sodiumMg,
            ingredients = saved.ingredients,
            originCountry = saved.originCountry,
            itemReportNo = saved.itemReportNo
        )
    }

    override fun execute(query: GetAllProductsUseCase.Query): GetAllProductsUseCase.Result {
        val pageable = PageRequest.of(query.page, query.size, Sort.by("id").ascending())
        val page = transactionalService.findAll(pageable, query.sellerId)
        return GetAllProductsUseCase.Result(
            products = page.content.map { product ->
                GetAllProductsUseCase.Result.ProductResult(
                    id = requireNotNull(product.id) { "저장된 상품에 ID가 없습니다" },
                    name = product.name,
                    price = product.price.amount,
                    status = product.status.name,
                    stock = product.stock,
                    createdAt = product.createdAt,
                    sellerId = product.sellerId,
                    brand = product.brand,
                    description = product.description,
                    category = product.category,
                    energyKcal = product.energyKcal,
                    carbohydrateG = product.carbohydrateG,
                    proteinG = product.proteinG,
                    fatG = product.fatG,
                    sugarG = product.sugarG,
                    sodiumMg = product.sodiumMg,
                    ingredients = product.ingredients,
                    originCountry = product.originCountry,
                    itemReportNo = product.itemReportNo
                )
            },
            totalElements = page.totalElements,
            totalPages = page.totalPages
        )
    }

    private fun CreateProductUseCase.Command.toDomain(sellerId: Long): Product = Product.create(
        name = name,
        price = Money(price),
        stock = stock,
        sellerId = sellerId,
        brand = brand,
        description = description,
        category = category,
        energyKcal = energyKcal,
        carbohydrateG = carbohydrateG,
        proteinG = proteinG,
        fatG = fatG,
        sugarG = sugarG,
        sodiumMg = sodiumMg,
        ingredients = ingredients,
        originCountry = originCountry,
        itemReportNo = itemReportNo
    )

    private fun Product.toCreateResult() = CreateProductUseCase.Result(
        id = requireNotNull(id) { "저장된 상품에 ID가 없습니다" },
        name = name,
        price = price.amount,
        stock = stock,
        status = status.name,
        sellerId = sellerId,
        brand = brand,
        description = description,
        category = category,
        energyKcal = energyKcal,
        carbohydrateG = carbohydrateG,
        proteinG = proteinG,
        fatG = fatG,
        sugarG = sugarG,
        sodiumMg = sodiumMg,
        ingredients = ingredients,
        originCountry = originCountry,
        itemReportNo = itemReportNo
    )
}
