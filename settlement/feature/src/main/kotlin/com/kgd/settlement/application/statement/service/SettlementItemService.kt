package com.kgd.settlement.application.statement.service

import com.kgd.settlement.application.statement.port.SettlementItemRepositoryPort
import com.kgd.settlement.application.statement.usecase.RegisterSettlementItemUseCase
import com.kgd.settlement.domain.statement.model.SettlementItem
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/** 구매 확정 라인과 (판매자 마지막 라인이면) 배송비를 정산 대상으로 적는다. 같은 키는 한 번만 */
@Service
class SettlementItemService(
    private val items: SettlementItemRepositoryPort,
) : RegisterSettlementItemUseCase {

    @Transactional("settlementTransactionManager")
    override fun register(command: RegisterSettlementItemUseCase.PurchaseConfirmed) {
        listOfNotNull(
            command.line?.let {
                SettlementItem.line(command.orderId, it.orderItemId, it.sellerId, it.netSales, it.commission, command.confirmedAt)
            },
            command.shipping?.let { SettlementItem.shipping(command.orderId, it.sellerId, it.fee, command.confirmedAt) },
        ).filterNot { items.existsByKey(it.key) }.forEach(items::save)
    }
}
