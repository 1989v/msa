package com.kgd.seller.application.seller.service

import com.kgd.common.exception.NotFoundException
import com.kgd.seller.application.seller.port.SellerAdminActionRepositoryPort
import com.kgd.seller.application.seller.port.SellerRepositoryPort
import com.kgd.seller.application.seller.usecase.GetMySellerApplicationUseCase
import com.kgd.seller.application.seller.usecase.SellerView
import com.kgd.seller.domain.seller.model.SellerAdminActionType
import com.kgd.seller.domain.seller.model.SellerStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class SellerApplicationQueryService(
    private val sellers: SellerRepositoryPort,
    private val actions: SellerAdminActionRepositoryPort,
) : GetMySellerApplicationUseCase {

    @Transactional("sellerTransactionManager", readOnly = true)
    override fun execute(memberId: String): GetMySellerApplicationUseCase.MySellerApplication {
        // 재신청은 새 행이라 id 가 가장 큰 행이 가장 최근 신청이다
        val latest = sellers.findAllByMemberId(memberId).maxByOrNull { requireNotNull(it.id) }
            ?: throw NotFoundException("SellerApplication")
        // 정지 사유는 판매자 행이 아니라 조치 이력에만 있다
        val suspendReason = if (latest.status == SellerStatus.SUSPENDED) {
            actions.findAllBySellerId(requireNotNull(latest.id))
                .filter { it.action == SellerAdminActionType.SUSPEND }
                .maxByOrNull { it.createdAt }
                ?.reason
        } else {
            null
        }
        return GetMySellerApplicationUseCase.MySellerApplication(SellerView.from(latest), suspendReason)
    }
}
