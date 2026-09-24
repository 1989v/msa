package com.kgd.promotion.application.coupon.service

import com.kgd.promotion.application.coupon.port.CouponDefinitionRepositoryPort
import com.kgd.promotion.application.coupon.port.CouponEventPort
import com.kgd.promotion.application.coupon.usecase.CouponDefinitionPageView
import com.kgd.promotion.application.coupon.usecase.CouponDefinitionView
import com.kgd.promotion.application.coupon.usecase.ManageCouponDefinitionUseCase
import com.kgd.promotion.domain.coupon.model.CouponDefinition
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock

@Service
class CouponDefinitionService(
    private val definitions: CouponDefinitionRepositoryPort,
    private val events: CouponEventPort,
    @Qualifier("promotionClock") private val clock: Clock,
) : ManageCouponDefinitionUseCase {

    @Transactional("promotionTransactionManager")
    override fun create(command: ManageCouponDefinitionUseCase.Create): CouponDefinitionView {
        val created = definitions.create(
            CouponDefinition.create(
                name = command.name, type = command.type, amount = command.amount, rateBp = command.rateBp,
                maxDiscount = command.maxDiscount, minOrderAmount = command.minOrderAmount, validFrom = command.validFrom,
                validUntil = command.validUntil, issueLimit = command.issueLimit, bearer = command.bearer,
                sellerId = command.sellerId, createdBy = command.actorId, now = clock.instant(),
            ),
        )
        events.defined(created)
        return CouponDefinitionView.from(created)
    }

    @Transactional("promotionTransactionManager", readOnly = true)
    override fun list(page: Int, size: Int): CouponDefinitionPageView =
        definitions.findPage(page, size).let { p -> CouponDefinitionPageView(p.items.map(CouponDefinitionView::from), p.total) }
}
