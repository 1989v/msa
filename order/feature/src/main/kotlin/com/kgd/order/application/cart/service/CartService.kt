package com.kgd.order.application.cart.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.order.application.cart.port.CartRepositoryPort
import com.kgd.order.application.cart.usecase.CartLineView
import com.kgd.order.application.cart.usecase.CartView
import com.kgd.order.application.cart.usecase.ManageCartUseCase
import com.kgd.order.application.readmodel.port.ProductViewRepositoryPort
import com.kgd.order.application.readmodel.port.SellerViewRepositoryPort
import com.kgd.order.domain.cart.model.CartItem
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class CartService(
    private val carts: CartRepositoryPort,
    private val products: ProductViewRepositoryPort,
    private val sellers: SellerViewRepositoryPort,
) : ManageCartUseCase {

    @Transactional("orderTransactionManager", readOnly = true)
    override fun get(memberId: String): CartView = view(memberId)

    @Transactional("orderTransactionManager")
    override fun put(memberId: String, productId: Long, quantity: Int): CartView {
        products.findById(productId) ?: throw BusinessException(ErrorCode.NOT_FOUND, "상품(id=$productId)을 찾을 수 없습니다")
        carts.save(CartItem(memberId, productId, quantity))
        return view(memberId)
    }

    @Transactional("orderTransactionManager")
    override fun remove(memberId: String, productId: Long): CartView {
        carts.delete(memberId, productId)
        return view(memberId)
    }

    @Transactional("orderTransactionManager")
    override fun clear(memberId: String) = carts.deleteAll(memberId)

    private fun view(memberId: String): CartView {
        val items = carts.findAllByMemberId(memberId)
        val productById = products.findAllByIds(items.map { it.productId }).associateBy { it.productId }
        val sellerById = sellers.findAllByIds(productById.values.map { it.sellerId }.toSet()).associateBy { it.sellerId }
        return CartView(
            items.map { item ->
                val product = productById[item.productId]
                CartLineView(
                    productId = item.productId,
                    quantity = item.quantity,
                    productName = product?.name,
                    price = product?.price,
                    sellerId = product?.sellerId,
                    onSale = product != null && product.isOnSale && sellerById[product.sellerId]?.isSellable == true,
                )
            },
        )
    }
}
