package com.kgd.seller.application.seller.port

import com.kgd.seller.domain.seller.model.SellerAdminAction

interface SellerAdminActionRepositoryPort {
    fun record(action: SellerAdminAction)
    fun findAllBySellerId(sellerId: Long): List<SellerAdminAction>
}
