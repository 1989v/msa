package com.kgd.settlement.application.seller.service

import com.kgd.settlement.application.seller.port.SettlementSellerRepositoryPort
import com.kgd.settlement.application.seller.usecase.SyncSettlementSellerUseCase
import com.kgd.settlement.domain.seller.model.SettlementSeller
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class SettlementSellerService(
    private val sellers: SettlementSellerRepositoryPort,
) : SyncSettlementSellerUseCase {

    @Transactional("settlementTransactionManager")
    override fun sync(seller: SettlementSeller) {
        if (seller.isNewerThan(sellers.find(seller.sellerId))) sellers.save(seller)
    }
}
